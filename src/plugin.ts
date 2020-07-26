import * as crypto from "crypto";
import {promises as fs} from "fs";
import * as path from "path";
import * as glob from "@actions/glob";
import _ from "lodash";
import {
  ResourceContents,
  Uninstall,
  SettingsCode,
  PluginData,
  Hook,
  Setting,
  Task,
  Widget,
  HtmlFile,
  CssFile,
  JsFile,
  ResourceFile,
  LangWord,
  Version,
  HooksFile,
  SettingsFile,
  TasksFile,
  WidgetsFile,
  VersionsFile,
} from "./ips-types";
import * as xml from "./xml";
import {parsePhpAssociativeArray} from "./php";
import {getGitVersion, isSnapshot} from "./versions";

type MaybePromisify<T> = {
  [K in keyof T]: T[K] | Promise<T[K]>;
};

async function allPromises<T extends object>(obj: MaybePromisify<T>): Promise<T> {
  return _.zipObject(_.keys(obj), await Promise.all(_.values(obj))) as T;
}

const INSTALL_PHP_44 = "bbf8db70ada6957e837f3633beb0532a";
const INSTALL_PHP_45 = "8c377d7437144f4356d2f1e0fad0ea6f";

export class Plugin {
  private basePath: string;

  public constructor(basePath: string, private name: string, private website?: string) {
    this.basePath = basePath.endsWith("/") ? basePath.substring(0, basePath.length - 1) : basePath;
  }

  public async getXml(): Promise<string> {
    return xml.serialise({
      plugin: xml.convertForXml(await this.getData()),
    });
  }

  public async getData(): Promise<PluginData> {
    const versionInfoPromise = this.getVersions();
    /* eslint-disable @typescript-eslint/naming-convention */
    /* eslint-disable github/no-then */
    return await allPromises<PluginData>({
      _attr: allPromises({
        name: this.name,
        version_human: versionInfoPromise.then((v) => v.humanVersion),
        version_long: versionInfoPromise.then((v) => v.longVersion),
        website: this.website,
      }),
      hooks: this.getHooks(),
      settings: this.getSettings(),
      uninstall: this.getUninstall(),
      settingsCode: this.getSettingsCode(),
      tasks: this.getTasks(),
      widgets: this.getWidgets(),
      htmlFiles: this.getHtmlFiles(),
      cssFiles: this.getCssFiles(),
      jsFiles: this.getJsFiles(),
      resourcesFiles: this.getResourceFiles(),
      lang: this.getLang(),
      versions: versionInfoPromise.then((v) => v.versions),
    });
    /* eslint-enable github/no-then */
    /* eslint-enable @typescript-eslint/naming-convention */
  }

  public async getHooks(): Promise<Hook[]> {
    const hooks: HooksFile = JSON.parse(await this.readFile("dev/hooks.json"));
    return Promise.all(
      _.map(hooks, async (hook, key) => ({
        hook: {
          _attr: {
            type: hook.type,
            class: hook.class,
            filename: key,
          },
          _cdata: await this.readFile(`hooks/${key}.php`),
        },
      }))
    );
  }

  public async getSettings(): Promise<Setting[]> {
    return await this.readFileIfExistsOrElse(
      "dev/settings.json",
      async (file) => {
        const settings: SettingsFile = JSON.parse(file);
        return settings.map((setting) => ({
          setting: [
            {
              key: setting.key,
            },
            {
              default: setting.default,
            },
          ],
        }));
      },
      []
    );
  }

  public async getTasks(): Promise<Task[]> {
    return await this.readFileIfExistsOrElse(
      "dev/tasks.json",
      async (file) => {
        const tasks: TasksFile = JSON.parse(file);
        return await Promise.all(
          _.map(tasks, async (frequency, key) => ({
            task: {
              _attr: {key, frequency},
              _cdata: await this.readFile(`tasks/${key}.php`),
            },
          }))
        );
      },
      []
    );
  }

  public async getWidgets(): Promise<Widget[]> {
    return await this.readFileIfExistsOrElse(
      "dev/widgets.json",
      async (file) => {
        const widgets: WidgetsFile = JSON.parse(file);
        return await Promise.all(
          _.map(widgets, async (data, key) => {
            const contents = (await this.readFile(`widgets/${key}.php`))
              .replace(
                /namespace IPS\\plugins\\[^\\]+\\widgets/g,
                "namespace IPS\\plugins\\<{LOCATION}>\\widgets"
              )
              .replace(/public \$plugin = '\d+';/g, "public $plugin = '<{ID}>';")
              .replace("public $app = '';", "");
            return {
              widget: {
                _attr: {
                  key,
                  ..._.mapValues(data, (val) => (_.isArray(val) ? val.join(",") : val)),
                },
                _cdata: contents,
              },
            };
          })
        );
      },
      []
    );
  }

  public async getHtmlFiles(): Promise<HtmlFile[]> {
    const resources = await this.getResources("html", "phtml");
    return resources.map((contents) => ({
      html: contents,
    }));
  }

  public async getCssFiles(): Promise<CssFile[]> {
    const resources = await this.getResources("css", "css");
    return resources.map((contents) => ({
      css: contents,
    }));
  }

  public async getJsFiles(): Promise<JsFile[]> {
    const resources = await this.getResources("js", "js");
    return resources.map((contents) => ({
      js: contents,
    }));
  }

  public async getResourceFiles(): Promise<ResourceFile[]> {
    const resources = await this.getResources("resources", "*", "!**/index.html");
    return resources.map((contents) => ({
      resources: contents,
    }));
  }

  private async getResources(
    key: string,
    suffix: string,
    ...extraGlobs: string[]
  ): Promise<ResourceContents[]> {
    extraGlobs.unshift(`${this.basePath}/dev/${key}/**/*.${suffix}`);
    const globber = await glob.create(extraGlobs.join("\n"));
    const files = await globber.glob();

    return await Promise.all(
      files.map(async (filename) => {
        const rawContents = await fs.readFile(filename);
        const result: ResourceContents = [
          {
            _attr: {
              filename: path.relative(path.join(this.basePath, "dev", key), filename),
            },
          },
          rawContents.toString("base64"),
        ];
        return result;
      })
    );
  }

  public async getLang(): Promise<LangWord[]> {
    return _.flatten(
      await Promise.all([
        this.readFileIfExistsOrElse(
          "dev/lang.php",
          (file) => {
            const words = parsePhpAssociativeArray(file);
            return _.map<object, LangWord>(words, (value, key) => ({
              word: [
                {
                  _attr: {
                    key,
                    js: 0,
                  },
                },
                value,
              ],
            }));
          },
          []
        ),
        this.readFileIfExistsOrElse(
          "dev/jslang.php",
          async (file) => {
            const words = parsePhpAssociativeArray(file);
            return _.map<object, LangWord>(words, (value, key) => ({
              word: [
                {
                  _attr: {
                    key,
                    js: 1,
                  },
                },
                value,
              ],
            }));
          },
          []
        ),
      ])
    );
  }

  public async getVersions(): Promise<{
    versions: Version[];
    humanVersion: string;
    longVersion: number;
  }> {
    const gitVersionPromise = getGitVersion(this.basePath);
    return await this.readFileIfExistsOrElseGet(
      "dev/versions.json",
      async (versionsFile) => {
        const versions: VersionsFile = JSON.parse(versionsFile);
        const gitVersion = await gitVersionPromise;
        const snapshot = isSnapshot(gitVersion);

        let longVersion: number;
        if (_.isEmpty(versions)) {
          if (!snapshot && gitVersion !== "0.0.0") {
            throw new Error(`Running on tag ${gitVersion}, but no versions found in versions.json`);
          }
          longVersion = 0;
        } else if (snapshot) {
          longVersion = parseInt(_.max(_.keys(versions))!, 10);
        } else {
          const maybeLongVersion = _.findKey(versions, (v) => v === gitVersion);
          if (maybeLongVersion === undefined) {
            throw new Error(
              `versions.json doesn't contain an entry for the current version ${gitVersion}`
            );
          }
          longVersion = parseInt(maybeLongVersion, 10);
        }
        if (!_.isEmpty(versions) && !versions["10000"]) {
          await this.readFileIfExistsOrElse(
            "dev/setup/install.php",
            (installFile) => {
              const normalised = installFile.replace(/\r\n/g, "\n");
              const hash = crypto
                .createHash("md5")
                .update(normalised)
                .digest("hex");
              if (hash !== INSTALL_PHP_44 && hash !== INSTALL_PHP_45) {
                throw new Error(
                  "File dev/setup/install.php exists and is modified, but you have no version with long id 10000"
                );
              }
            },
            undefined
          );
        }
        return {
          versions: await Promise.all(
            _.map(versions, async (human, long) => {
              const upgradeFile = await this.readFileIfExistsOrElse<{_cdata?: string}>(
                `dev/setup/${long === "10000" ? "install.php" : `${long}.php`}`,
                (contents) => ({_cdata: contents}),
                {}
              );
              return {
                version: {
                  ...upgradeFile,
                  _attr: {
                    human,
                    long,
                  },
                },
              };
            })
          ),
          humanVersion: gitVersion,
          longVersion,
        };
      },
      async () => ({
        versions: [],
        humanVersion: await gitVersionPromise,
        longVersion: 0,
      })
    );
  }

  public async getUninstall(): Promise<Uninstall | undefined> {
    return await this.readFileIfExistsOrElse(
      "dev/uninstall.php",
      (contents) => ({
        _cdata: contents,
      }),
      undefined
    );
  }

  public async getSettingsCode(): Promise<SettingsCode | undefined> {
    return await this.readFileIfExistsOrElse(
      "dev/settings.php",
      (contents) => ({
        _cdata: contents,
      }),
      undefined
    );
  }

  private async readFile(file: string): Promise<string> {
    return fs.readFile(path.join(this.basePath, file), {encoding: "utf8"});
  }

  private async readFileIfExistsOrElse<T>(
    file: string,
    ifPresent: (f: string) => T | Promise<T>,
    orElse: T
  ): Promise<T> {
    return this.readFileIfExistsOrElseGet(file, ifPresent, () => orElse);
  }

  private async readFileIfExistsOrElseGet<T>(
    file: string,
    ifPresent: (f: string) => T | Promise<T>,
    orElse: () => T | Promise<T>
  ): Promise<T> {
    let contents;
    try {
      contents = await this.readFile(file);
    } catch (e) {
      if (e.code === "ENOENT") {
        return await orElse();
      }
      throw e;
    }
    return await ifPresent(contents);
  }
}
