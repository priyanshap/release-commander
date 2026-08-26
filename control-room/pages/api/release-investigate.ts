import type { NextApiRequest, NextApiResponse } from "next";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const REPO =
  "https://github.com/priyanshap/release-commander.git";

const BRANCH = "demo/broken-release";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({
      error: "sessionId is required",
    });
  }

  const workspace = await mkdtemp(
    join(tmpdir(), "release-commander-investigate-")
  );

  try {
    await execFileAsync("git", [
      "clone",
      "--depth",
      "1",
      "--branch",
      BRANCH,
      REPO,
      workspace,
    ]);

    const configPath = join(
      workspace,
      "release.config.json"
    );

    const config = await readFile(configPath, "utf8");

    let stdout = "";
    let stderr = "";
    let exitCode = 0;

    try {
      const result = await execFileAsync(
        "python3",
        ["scripts/release_verify.py"],
        {
          cwd: workspace,
        }
      );

      stdout = result.stdout;
      stderr = result.stderr;
    } catch (error: any) {
      stdout = error.stdout || "";
      stderr = error.stderr || "";

      exitCode =
        typeof error.code === "number"
          ? error.code
          : 1;
    }

    const blocker =
      config.includes(
        '"allowProductionRelease": false'
      )
        ? "allowProductionRelease is false"
        : null;

    const blocked =
      exitCode !== 0 ||
      stdout.includes("RELEASE BLOCKED");

    return res.status(200).json({
      sessionId,
      branch: BRANCH,
      repository:
        "priyanshap/release-commander",

      verification: {
        command:
          "python3 scripts/release_verify.py",
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode,
      },

      blocker,

      patch: blocker
        ? {
            file: "release.config.json",
            before:
              '"allowProductionRelease": false',
            after:
              '"allowProductionRelease": true',
          }
        : null,

      verdict: blocked
        ? "RELEASE BLOCKED"
        : "SAFE TO SHIP",

      remoteGitHubModified: false,
    });
  } catch (error: any) {
    console.error(
      "Release investigation failed:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Release investigation failed",
    });
  } finally {
    await rm(workspace, {
      recursive: true,
      force: true,
    }).catch(() => {});
  }
}
