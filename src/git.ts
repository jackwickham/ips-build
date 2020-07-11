import * as exec from "@actions/exec";

export async function getVersion(path: string): Promise<string> {
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
