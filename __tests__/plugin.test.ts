import {Plugin} from "../src/plugin";
import {mocked} from "ts-jest/utils";
import * as importedGlob from "@actions/glob";

let files: {[filename: string]: string};
let globFiles: string[];

function setFile(path: string, contents: string) {
  files[path] = contents;
}

jest.mock("fs", () => ({
  promises: {
    readFile: jest.fn(async (path: string, charset?: string) => {
      const file = files[path];
      if (file) {
        if (charset) {
          return file;
        } else {
          return Buffer.from(file);
        }
      }
      const err: any = new Error(`Error: ENOENT: no such file or directory: ${path} (stubbed)`);
      err.code = "ENOENT";
      err.errno = -2;
      throw err;
    }),
  },
}));

jest.mock("@actions/glob");
const glob = mocked(importedGlob, true);

beforeEach(() => {
  files = {};
  globFiles = [];
  glob.create.mockImplementation(
    async () =>
      ({
        glob: async () => globFiles,
      } as importedGlob.Globber)
  );
});

test("should read all hooks", async () => {
  setFile(
    "dev/hooks.json",
    JSON.stringify({
      myCodeHook: {
        type: "C",
        class: "\\IPS\\Test",
      },
      myThemeHook: {
        type: "S",
        class: "\\IPS\\Theme\\class_test",
      },
    })
  );
  setFile("hooks/myCodeHook.php", "code hook");
  setFile("hooks/myThemeHook.php", "theme hook");

  const plugin = new Plugin("", "", false, "", 0, "");
  expect(await plugin.getHooks()).toEqual([
    {
      hook: {
        _attr: {
          type: "C",
          class: "\\IPS\\Test",
          filename: "myCodeHook",
        },
        _cdata: "code hook",
      },
    },
    {
      hook: {
        _attr: {
          type: "S",
          class: "\\IPS\\Theme\\class_test",
          filename: "myThemeHook",
        },
        _cdata: "theme hook",
      },
    },
  ]);
});

test("should support having no settings", async () => {
  const plugin = new Plugin("", "", false, "", 0, "");
  expect(await plugin.getSettings()).toEqual([]);
});

test("should read all settings", async () => {
  setFile(
    "dev/settings.json",
    JSON.stringify([
      {
        key: "setting 1",
        default: "5",
      },
      {
        key: "setting 2",
        default: "",
      },
    ])
  );

  const plugin = new Plugin("", "", false, "", 0, "");
  expect(await plugin.getSettings()).toEqual([
    {
      setting: [
        {
          key: "setting 1",
        },
        {
          default: "5",
        },
      ],
    },
    {
      setting: [
        {
          key: "setting 2",
        },
        {
          default: "",
        },
      ],
    },
  ]);
});

test("should support having no tasks", async () => {
  const plugin = new Plugin("", "", false, "", 0, "");
  expect(await plugin.getTasks()).toEqual([]);
});

test("should read all tasks", async () => {
  setFile(
    "dev/tasks.json",
    JSON.stringify({
      task1: "PT1M",
      task2: "P1Y",
    })
  );
  setFile("tasks/task1.php", "task 1");
  setFile("tasks/task2.php", "task 2");

  const plugin = new Plugin("", "", false, "", 0, "");
  expect(await plugin.getTasks()).toEqual([
    {
      task: {
        _attr: {
          key: "task1",
          frequency: "PT1M",
        },
        _cdata: "task 1",
      },
    },
    {
      task: {
        _attr: {
          key: "task2",
          frequency: "P1Y",
        },
        _cdata: "task 2",
      },
    },
  ]);
});

test("should support having no widgets", async () => {
  const plugin = new Plugin("", "", false, "", 0, "");
  expect(await plugin.getWidgets()).toEqual([]);
});

test("should read all widgets", async () => {
  setFile(
    "dev/widgets.json",
    JSON.stringify({
      myWidget: {
        class: "\\IPS\\Widget",
        restrict: ["test", "otherTest"],
      },
    })
  );
  setFile("widgets/myWidget.php", "my widget");
  const plugin = new Plugin("", "", false, "", 0, "");
  expect(await plugin.getWidgets()).toEqual([
    {
      widget: {
        _attr: {
          key: "myWidget",
          class: "\\IPS\\Widget",
          restrict: "test,otherTest",
        },
        _cdata: "my widget",
      },
    },
  ]);
});

test("should replace install-specific constants in widgets", async () => {
  setFile(
    "dev/widgets.json",
    JSON.stringify({
      myWidget: {},
    })
  );
  setFile(
    "widgets/myWidget.php",
    "<?php\n" +
      "namespace IPS\\plugins\\test\\widgets;\n" +
      "class MyWidget {\n" +
      "    public $plugin = '34';\n" +
      "    public $app = '';\n" +
      "}\n"
  );

  const plugin = new Plugin("", "", false, "", 0, "");
  expect(await plugin.getWidgets()).toEqual([
    {
      widget: {
        _attr: {
          key: "myWidget",
        },
        _cdata:
          "<?php\n" +
          "namespace IPS\\plugins\\<{LOCATION}>\\widgets;\n" +
          "class MyWidget {\n" +
          "    public $plugin = '<{ID}>';\n" +
          "    \n" +
          "}\n",
      },
    },
  ]);
});

test("should load all html files", async () => {
  setFile("/path/to/dev/html/dir/1.phtml", "file 1");
  setFile("/path/to/dev/html/2.phtml", "file 2");
  globFiles = ["/path/to/dev/html/dir/1.phtml", "/path/to/dev/html/2.phtml"];

  const plugin = new Plugin("/path/to/", "", false, "", 0, "");
  expect(await plugin.getHtmlFiles()).toEqual([
    {
      html: [
        {
          _attr: {
            filename: "dir/1.phtml",
          },
        },
        Buffer.from("file 1", "utf-8").toString("base64"),
      ],
    },
    {
      html: [
        {
          _attr: {
            filename: "2.phtml",
          },
        },
        Buffer.from("file 2", "utf-8").toString("base64"),
      ],
    },
  ]);
  expect(glob.create).toHaveBeenCalledWith("/path/to/dev/html/**/*.phtml");
});

test("should load all css files", async () => {
  setFile("/path/to/dev/css/dir/1.css", "file 1");
  globFiles = ["/path/to/dev/css/dir/1.css"];

  const plugin = new Plugin("/path/to/", "", false, "", 0, "");
  expect(await plugin.getCssFiles()).toEqual([
    {
      css: [
        {
          _attr: {
            filename: "dir/1.css",
          },
        },
        Buffer.from("file 1", "utf-8").toString("base64"),
      ],
    },
  ]);
  expect(glob.create).toHaveBeenCalledWith("/path/to/dev/css/**/*.css");
});

test("should load all js files", async () => {
  setFile("/path/to/dev/js/dir/1.js", "file 1");
  globFiles = ["/path/to/dev/js/dir/1.js"];

  const plugin = new Plugin("/path/to/", "", false, "", 0, "");
  expect(await plugin.getJsFiles()).toEqual([
    {
      js: [
        {
          _attr: {
            filename: "dir/1.js",
          },
        },
        Buffer.from("file 1", "utf-8").toString("base64"),
      ],
    },
  ]);
  expect(glob.create).toHaveBeenCalledWith("/path/to/dev/js/**/*.js");
});

test("should load all resource files", async () => {
  setFile("/path/to/dev/resources/dir/1.png", "file 1");
  globFiles = ["/path/to/dev/resources/dir/1.png"];

  const plugin = new Plugin("/path/to/", "", false, "", 0, "");
  expect(await plugin.getResourceFiles()).toEqual([
    {
      resources: [
        {
          _attr: {
            filename: "dir/1.png",
          },
        },
        Buffer.from("file 1", "utf-8").toString("base64"),
      ],
    },
  ]);
  expect(glob.create).toHaveBeenCalledWith("/path/to/dev/resources/**/*.*\n!**/index.html");
});

test("should support no lang files", async () => {
  const plugin = new Plugin("", "", false, "", 0, "");
  expect(await plugin.getLang()).toEqual([]);
});

test("should read words from lang.php", async () => {
  setFile(
    "dev/lang.php",
    "<?php\n" +
      "$lang = array(\n" +
      "'word1' => 'translation1',\n" +
      "'word2' => 'translation2'\n" +
      "];"
  );
  const plugin = new Plugin("", "", false, "", 0, "");
  expect(await plugin.getLang()).toEqual([
    {
      word: [
        {
          _attr: {
            key: "word1",
            js: 0,
          },
        },
        "translation1",
      ],
    },
    {
      word: [
        {
          _attr: {
            key: "word2",
            js: 0,
          },
        },
        "translation2",
      ],
    },
  ]);
});

test("should read words from jslang.php", async () => {
  setFile("dev/jslang.php", "<?php\n" + "$lang = array(\n" + "'word1' => 'translation1',\n" + "];");
  const plugin = new Plugin("", "", false, "", 0, "");
  expect(await plugin.getLang()).toEqual([
    {
      word: [
        {
          _attr: {
            key: "word1",
            js: 1,
          },
        },
        "translation1",
      ],
    },
  ]);
});

test("should read versions from versions.json", async () => {
  setFile(
    "dev/versions.json",
    JSON.stringify({
      "10000": "1.0.0",
      "10001": "1.0.1",
      "10100": "1.1.0",
    })
  );
  setFile("dev/setup/install.php", "install file");
  setFile("dev/setup/10100.php", "upgrade file");

  const plugin = new Plugin("", "", true, "2.0.0+11", 2000011, "");
  expect(await plugin.getVersions()).toEqual([
    {
      version: {
        _attr: {
          long: "10000",
          human: "1.0.0",
        },
        _cdata: "install file",
      },
    },
    {
      version: {
        _attr: {
          long: "10001",
          human: "1.0.1",
        },
      },
    },
    {
      version: {
        _attr: {
          long: "10100",
          human: "1.1.0",
        },
        _cdata: "upgrade file",
      },
    },
  ]);
});

test("should validate that the current version is present in versions.json", async () => {
  setFile(
    "dev/versions.json",
    JSON.stringify({
      "10000": "1.0.0",
      "10001": "1.0.1",
    })
  );

  const plugin = new Plugin("", "", false, "2.0.0", 2000000, "");
  await expect(plugin.getVersions()).rejects.toThrow();
});

test("should validate that the current version matches the version in versions.json", async () => {
  setFile(
    "dev/versions.json",
    JSON.stringify({
      "10000": "1.0.0",
      "2000000": "2.1.0",
    })
  );

  const plugin = new Plugin("", "", false, "2.0.0", 2000000, "");
  await expect(plugin.getVersions()).rejects.toThrow();
});

test("should continue when the version is present in versions.json", async () => {
  setFile(
    "dev/versions.json",
    JSON.stringify({
      "2000000": "2.0.0",
    })
  );

  const plugin = new Plugin("", "", false, "2.0.0", 2000000, "");
  expect(await plugin.getVersions()).toEqual([
    {
      version: {
        _attr: {
          long: "2000000",
          human: "2.0.0",
        },
      },
    },
  ]);
});

test("should fail if there is an install.php file but no version 10000", async () => {
  setFile(
    "dev/versions.json",
    JSON.stringify({
      "1000000": "1.0.0",
    })
  );
  setFile("dev/setup/install.php", "setup file");

  const plugin = new Plugin("", "", false, "1.0.0", 1000000, "");
  await expect(plugin.getVersions()).rejects.toThrow();
});

test("should support having no uninstall code", async () => {
  const plugin = new Plugin("", "", false, "", 0, "");
  expect(await plugin.getUninstall()).toBeUndefined();
});

test("should read uninstall code", async () => {
  setFile("dev/uninstall.php", "my uninstall code");
  const plugin = new Plugin("", "", false, "", 0, "");
  expect(await plugin.getUninstall()).toEqual({
    _cdata: "my uninstall code",
  });
});

test("should support having no settings code", async () => {
  const plugin = new Plugin("", "", false, "", 0, "");
  expect(await plugin.getSettingsCode()).toBeUndefined();
});

test("should read settings code", async () => {
  setFile("dev/settings.php", "my settings code");
  const plugin = new Plugin("", "", false, "", 0, "");
  expect(await plugin.getSettingsCode()).toEqual({
    _cdata: "my settings code",
  });
});
