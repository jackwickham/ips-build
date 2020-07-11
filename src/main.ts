import * as core from "@actions/core";
import * as fs from "fs";
import * as path from "path";
import {Plugin} from "./plugin";
import {getVersion} from "./git";

async function run(): Promise<void> {
  try {
    const basePath: string =
      core.getInput("path") ||
      process.env["GITHUB_WORKSPACE"] ||
      "/var/www/html/ips/plugins/notificationtoast";
    const humanVersion = await getVersion(basePath);
    const longVersion = toLongVersion(humanVersion);
    const name = core.getInput("name");

    core.debug(`Building ${name} version ${humanVersion} (${longVersion})`);

    const plugin = new Plugin(
      basePath,
      core.getInput("name"),
      humanVersion,
      longVersion,
      core.getInput("website")
    );

    fs.writeFileSync(path.join(basePath, "plugin.xml"), await plugin.getXml(), "utf8");
  } catch (error) {
    core.setFailed(error.message);
  }
}

function toLongVersion(humanVersion: string): number {
  const re = /^v?(\d+)\.(\d+)\.(\d+)(?:-(\d+)-g[a-f0-9]+)?$/;
  const matches = re.exec(humanVersion);
  if (matches === null) {
    throw new Error("Tag did not match expected format \\d+.\\d+.\\d+");
  }
  const longVersion =
    parseInt(matches[1]) * 100 * 100 * 100 +
    parseInt(matches[2]) * 100 * 100 +
    parseInt(matches[3]) * 100 +
    (matches[4] ? parseInt(matches[4]) : 0);
  return longVersion;
}

run();
