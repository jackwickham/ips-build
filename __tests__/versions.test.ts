import * as importedExec from "@actions/exec";
import {getVersion, getGitVersion} from "../src/versions";

jest.mock("@actions/exec");
const exec = jest.mocked(importedExec);

test("should handle being directly on a tag", async () => {
  const version = "1.2.3";
  mockExec(version);

  expect(await getVersion(".")).toEqual({
    human: version,
    long: 1020300,
    snapshot: false,
  });
  expect(exec.exec).toHaveBeenCalledTimes(1);
  expect(exec.exec.mock.calls[0][0]).toEqual("git");
  expect(exec.exec.mock.calls[0][1]).toEqual(["describe", "--tags"]);
});

test("should handle being offset from a tag", async () => {
  const version = "1.2.3-4-g2414721";
  mockExec(version);

  expect(await getVersion(".")).toEqual({
    human: version,
    long: 1020304,
    snapshot: true,
  });
});

test("should handle tags starting with v", async () => {
  const version = "v1.2.3";
  mockExec(version);

  expect(await getVersion(".")).toEqual({
    human: "1.2.3",
    long: 1020300,
    snapshot: false,
  });
});

test("should throw if the tag has invalid data at the start", async () => {
  const version = "w1.2.3";
  mockExec(version);

  await expect(getVersion(".")).rejects.toThrow();
});

test("should throw if the tag has invalid data at the end", async () => {
  const version = "1.2.3-z";
  mockExec(version);

  await expect(getVersion(".")).rejects.toThrow();
});

test("should throw if the tag would overflow the version", async () => {
  const version = "1.2.3-102-g1234";
  mockExec(version);

  await expect(getVersion(".")).rejects.toThrow();
});

test("should throw if exec fails", async () => {
  exec.exec.mockResolvedValue(1);

  await expect(getVersion(".")).rejects.toThrow();
});

test("should be more lenient when just getting the raw version", async () => {
  const version = "v1.2.3.4-b5";
  mockExec(version);

  expect(await getGitVersion(".")).toEqual("1.2.3.4-b5");
});

test("should throw when getting the raw version if it's invalid", async () => {
  const version = "not a version";
  mockExec(version);

  await expect(getGitVersion(".")).rejects.toThrow();
});

function mockExec(version: string) {
  exec.exec.mockImplementation(
    async (_commandLine: string, _args?: string[], options?: importedExec.ExecOptions) => {
      options!.listeners!.stdout!(Buffer.from(`${version}\n`));
      return 0;
    }
  );
}
