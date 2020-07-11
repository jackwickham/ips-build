import {promises as fs} from "fs";
import * as path from "path";
import * as glob from "@actions/glob";
import _ from "lodash";
import {
  ResourceContents,
  Uninstall,
  SettingsCode,
  XmlString,
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
import {objectToXml} from "./xml";
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
    private humanVersion: string,
    private longVersion: number,
    private website?: string
  ) {
    this.basePath = basePath.endsWith("/") ? basePath.substring(0, basePath.length - 1) : basePath;
  }

  public async getXml(): Promise<string> {
    return objectToXml(
      {
        plugin: await this.getData(),
      },
      "plugin"
    );
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

  private async getHooks(): Promise<Hook[]> {
    const hooks: HooksFile = JSON.parse(await this.readFile("dev", "hooks.json"));
    return Promise.all(
      _.map(hooks, async (hook, key) => ({
        hook: {
          _attr: {
            type: hook.type,
            class: hook.class,
            filename: key,
          },
          _cdata: await this.readFile("hooks", `${key}.php`),
        },
      }))
    );
  }

  private async getSettings(): Promise<Setting[]> {
    return await this.readFileIfExistsOrElse(
      "dev/settings.json",
      async (file) => {
        const settings: SettingsFile = JSON.parse(file);
        return settings.map((setting) => ({
          setting: {
            key: setting.key,
            default: setting.default,
          },
        }));
      },
      []
    );
  }

  private async getTasks(): Promise<Task[]> {
    return await this.readFileIfExistsOrElse(
      "dev/tasks.json",
      async (file) => {
        const tasks: TasksFile = JSON.parse(file);
        return await Promise.all(
          _.map(tasks, async (frequency, key) => ({
            task: {
              _attr: {key, frequency},
              _cdata: await this.readFile("tasks", `${key}.php`),
            },
          }))
        );
      },
      []
    );
  }

  private async getWidgets(): Promise<Widget[]> {
    return await this.readFileIfExistsOrElse(
      "dev/widgets.json",
      async (file) => {
        const widgets: WidgetsFile = JSON.parse(file);
        return await Promise.all(
          _.map(widgets, async (data, key) => {
            const contents = (await this.readFile("tasks", `${key}.php`))
              .replace(
                /namespace IPS\\plugins\\[^\\]+\\widgets/g,
                "namespace IPS\\plugins\\<{LOCATION>\\widgets"
              )
              .replace(/public \$plugin = '\d+';/g, "public $plugin = '<ID>';")
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

  private async getHtmlFiles(): Promise<HtmlFile[]> {
    const resources = await this.getResources("html", "phtml");
    return resources.map((contents) => ({
      html: contents,
    }));
  }

  private async getCssFiles(): Promise<CssFile[]> {
    const resources = await this.getResources("css", "css");
    return resources.map((contents) => ({
      css: contents,
    }));
  }

  private async getJsFiles(): Promise<JsFile[]> {
    const resources = await this.getResources("js", "js");
    return resources.map((contents) => ({
      js: contents,
    }));
  }

  private async getResourceFiles(): Promise<ResourceFile[]> {
    const resources = await this.getResources("resources", "html", true);
    return resources.map((contents) => ({
      resources: contents,
    }));
  }

  private async getResources(
    key: string,
    suffix: string,
    negate = false
  ): Promise<ResourceContents[]> {
    const globber = await glob.create(`${negate ? "!" : ""}${this.basePath}/${key}/**/*.${suffix}`);
    const files = await globber.glob();

    return await Promise.all(
      files.map(async (filename) => {
        const rawContents = await fs.readFile(filename);
        const result: ResourceContents = [
          {
            _attr: {
              filename,
            },
          },
          rawContents.toString("base64"),
        ];
        return result;
      })
    );
  }

  private async getLang(): Promise<LangWord[]> {
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
                    js: false,
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
                    js: true,
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

  private async getVersions(): Promise<Version[]> {
    return await this.readFileIfExistsOrElse(
      "dev/versions.json",
      async (versionsFile) => {
        const versions: VersionsFile = JSON.parse(versionsFile);
        return await Promise.all(
          _.map(versions, async (human, long) => {
            const upgradeFile: Partial<XmlString> =
              (await this.getFileIfExistsAsCdata(
                "dev",
                "setup",
                long === "10000" ? "install.php" : `${long}.php`
              )) || {};
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

  private async getUninstall(): Promise<Uninstall | undefined> {
    return await this.getFileIfExistsAsCdata("uninstall.php");
  }

  private async getSettingsCode(): Promise<SettingsCode | undefined> {
    return await this.getFileIfExistsAsCdata("settings.php");
  }

  private async getFileIfExistsAsCdata(...file: string[]): Promise<XmlString | undefined> {
    if (await this.fileExists(...file)) {
      return {
        _cdata: await this.readFile(...file),
      };
    }
    return undefined;
  }

  private async readFile(...file: string[]): Promise<string> {
    return fs.readFile(path.join(this.basePath, ...file), {encoding: "utf8"});
  }

  private async readFileIfExistsOrElse<T>(
    file: string,
    ifPresent: (f: string) => T | Promise<T>,
    orElse: T
  ): Promise<T> {
    if (await this.fileExists(file)) {
      return await ifPresent(await this.readFile(file));
    }
    return orElse;
  }

  private async fileExists(...file: string[]): Promise<boolean> {
    return fs
      .access(path.join(this.basePath, ...file))
      .then(() => true)
      .catch(() => false);
  }
}
