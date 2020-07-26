import * as core from "@actions/core";
import * as artifact from "@actions/artifact";
import {promises as fs} from "fs";
import * as path from "path";
import {Plugin} from "./plugin";

async function run(): Promise<void> {
  try {
    const basePath: string = path.resolve(
      core.getInput("path") || "",
      process.env["GITHUB_WORKSPACE"]!
    );
    const name = core.getInput("name", {required: true});
    const type = core.getInput("type", {required: true});

    const xmlPath = path.join(basePath, `${name}.xml`);

    if (type === "plugin") {
      const plugin = new Plugin(basePath, name, core.getInput("website"));
      await fs.writeFile(xmlPath, await plugin.getXml(), "utf8");
    } else {
      throw new Error(`Type ${type} is not supported`);
    }

    await artifact.create().uploadArtifact(`${name}`, [xmlPath], basePath);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
