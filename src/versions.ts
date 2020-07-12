import * as exec from "@actions/exec";

export interface Version {
  long: number;
  human: string;
}

export async function getVersion(path: string): Promise<Version> {
  const gitVersion = await getGitVersion(path);
  return {
    human: gitVersion,
    long: toLongVersion(gitVersion),
  };
}

export async function getGitVersion(path: string): Promise<string> {
  let output = "";
  const options = {
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString();
      },
    },
    cwd: path,
  };

  if ((await exec.exec("git", ["describe", "--tags"], options)) !== 0 || !output) {
    throw new Error(
      "Failed to find a git tag. Make sure the repo is tagged and was checked out with fetch-depth: 0."
    );
  }

  return output.trim();
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
