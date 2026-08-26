import type { NextApiRequest, NextApiResponse } from "next";

const TRUEFORGE_URL =
  process.env.TRUEFORGE_URL || "http://localhost:8790";

const APPROVAL_MESSAGE = `APPROVE & APPLY PATCH.

Human approval is explicitly granted for the remediation you just proposed.

Proceed only with the previously proposed sandbox remediation:

1. Change only release.config.json in the sandbox clone:
   "allowProductionRelease": false
   to:
   "allowProductionRelease": true

2. Do not modify any other file.
3. Do not push, merge, commit, tag, deploy, or modify the remote GitHub repository.
4. Run exactly:
   python3 scripts/release_verify.py
5. Report the actual command output and exit result.
6. Show the final diff.
7. Finish with exactly one release verdict:
   SAFE TO SHIP
   or
   RELEASE BLOCKED

Never fabricate verification output.`;

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
              content: APPROVAL_MESSAGE,
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
    console.error("TrueForge approval turn failed:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: "Unable to resume TrueForge workflow",
      });
    }

    res.end();
  }
}
