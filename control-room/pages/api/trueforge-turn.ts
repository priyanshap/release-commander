import type { NextApiRequest, NextApiResponse } from "next";

const TRUEFORGE_URL =
  process.env.TRUEFORGE_URL || "http://localhost:8790";

const RELEASE_PROMPT = `Run the Release Commander verification workflow against this exact candidate:

Repository:
https://github.com/priyanshap/release-commander.git

Branch:
demo/broken-release

Use the sandbox execution capability.

1. Clone the repository into /tmp/release-commander.
2. Checkout exactly demo/broken-release.
3. Confirm the checked-out branch.
4. Inspect release.config.json and scripts/release_verify.py.
5. Run exactly:
python3 scripts/release_verify.py
6. Report the actual output and exit result.
7. If RELEASE BLOCKED is returned, identify the exact blocker.
8. Produce the exact remediation diff.
9. DO NOT modify any file yet.
10. DO NOT push, merge, tag, deploy, or modify GitHub remotely.
11. Stop before remediation and require explicit human approval.

Never fabricate tool output.`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method not allowed");
  }

  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required" });
  }

  try {
    const response = await fetch(
      `${TRUEFORGE_URL}/api/v1/sessions/${sessionId}/turns`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          input: [
            {
              type: "user.message",
              content: RELEASE_PROMPT,
            },
          ],
          previous_turn_id: "auto",
          stream: true,
        }),
      }
    );

    if (!response.ok || !response.body) {
      const text = await response.text();
      return res.status(response.status).send(text);
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    const reader = response.body.getReader();

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      res.write(Buffer.from(value));
    }

    res.end();
  } catch (error) {
    console.error("TrueForge turn failed:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: "Unable to execute TrueForge turn",
      });
    }

    res.end();
  }
}
