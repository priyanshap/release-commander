import type { NextApiRequest, NextApiResponse } from "next";

const TRUEFORGE_URL =
  process.env.TRUEFORGE_URL || "http://localhost:8790";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const response = await fetch(`${TRUEFORGE_URL}/api/v1/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent: {
          name: "release-commander",
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(201).json({
      sessionId: data.data.id,
      agent: data.data.agent,
    });
  } catch (error) {
    console.error("TrueForge connection failed:", error);

    return res.status(500).json({
      error: "Unable to connect to local TrueForge server",
    });
  }
}
