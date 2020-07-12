import * as core from "@actions/core";
import * as artifact from "@actions/artifact";
import {promises as fs} from "fs";
import * as path from "path";
import {Plugin} from "./plugin";
import {getVersion} from "./versions";

async function run(): Promise<void> {
  try {
    const basePath: string = path.resolve(
      core.getInput("path") || "",
      process.env["GITHUB_WORKSPACE"]!
    );
    const version = await getVersion(basePath);
    const name = core.getInput("name", {required: true});

    const xmlPath = path.join(basePath, "plugin.xml");

    core.info(`Building ${name} version ${version.human} (${version.long})`);

    const plugin = new Plugin(
      basePath,
      name,
      version.snapshot,
      version.human,
      version.long,
      core.getInput("website")
    );
    await fs.writeFile(xmlPath, await plugin.getXml(), "utf8");

    await artifact
      .create()
      .uploadArtifact(`${name}.xml`, [path.join(basePath, "plugin.xml")], basePath);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
