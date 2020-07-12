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

type MaybePromisify<T> = {
  [K in keyof T]: T[K] | Promise<T[K]>;
};

async function allPromises<T extends object>(obj: MaybePromisify<T>): Promise<T> {
  return _.zipObject(_.keys(obj), await Promise.all(_.values(obj))) as T;
}

export class Plugin {
  private basePath: string;

  public constructor(
    basePath: string,
    private name: string,
    private snapshot: boolean,
    private humanVersion: string,
    private longVersion: number,
    private website?: string
  ) {
    this.basePath = basePath.endsWith("/") ? basePath.substring(0, basePath.length - 1) : basePath;
  }

  public async getXml(): Promise<string> {
    return xml.serialise({
      plugin: xml.convertForXml(await this.getData()),
    });
  }

  public async getData(): Promise<PluginData> {
    /* eslint-disable @typescript-eslint/camelcase */
    return await allPromises<PluginData>({
      _attr: {
        name: this.name,
        version_human: this.humanVersion,
        version_long: this.longVersion,
        website: this.website,
      },
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
      versions: this.getVersions(),
    });
    /* eslint-enable @typescript-eslint/camelcase */
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

  public async getVersions(): Promise<Version[]> {
    return await this.readFileIfExistsOrElse(
      "dev/versions.json",
      async (versionsFile) => {
        const versions: VersionsFile = JSON.parse(versionsFile);
        if (!this.snapshot) {
          if (versions[this.longVersion] === undefined) {
            throw new Error(
              `versions.json doesn't contain an entry for the current version ${this.longVersion}`
            );
          }
          if (versions[this.longVersion] !== this.humanVersion) {
            throw new Error(
              `The versions.json entry for ${this.longVersion}, ${
                versions[this.longVersion]
              }, doesn't match the tag version ${this.humanVersion}`
            );
          }
        }
        return await Promise.all(
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
        );
      },
      []
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
    let contents;
    try {
      contents = await this.readFile(file);
    } catch (e) {
      if (e.code === "ENOENT") {
        return orElse;
      }
      throw e;
    }
    return await ifPresent(contents);
  }
}
