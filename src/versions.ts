import {exec} from "@actions/exec";

export interface Version {
  long: number;
  human: string;
  snapshot: boolean;
}

const versionRegex = /^v?((\d+)\.(\d+)\.(\d+)(?:-(\d+)-g[a-f0-9]+)?)$/;

export async function getVersion(path: string): Promise<Version> {
  const gitVersion = await getGitVersion(path);

  const matches = versionRegex.exec(gitVersion);
  if (matches === null) {
    throw new Error("Tag did not match expected format \\d+.\\d+.\\d+");
  }
  const humanVersion = matches[1];
  if (
    matches[2].length > 2 ||
    matches[3].length > 2 ||
    matches[4].length > 2 ||
    matches[5]?.length > 2
  ) {
    throw new Error(
      `Version ${humanVersion} would overflow the long version number. You should probably tag a release.`
    );
  }
  const longVersion =
    parseInt(matches[2]) * 100 * 100 * 100 +
    parseInt(matches[3]) * 100 * 100 +
    parseInt(matches[4]) * 100 +
    (matches[5] ? parseInt(matches[5]) : 0);

  return {
    human: humanVersion,
    long: longVersion,
    snapshot: matches[5] !== undefined,
  };
}

async function getGitVersion(path: string): Promise<string> {
  let output = "";
  const options = {
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString();
      },
    },
    cwd: path,
  };

  if ((await exec("git", ["describe", "--tags"], options)) !== 0 || !output) {
    throw new Error(
      "Failed to find a git tag. Make sure the repo is tagged and was checked out with fetch-depth: 0."
    );
  }

  return output.trim();
}
