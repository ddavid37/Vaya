// POST: global contextual AI chat for any Vaya screen (OpenAI).

import { NextResponse } from "next/server";
import type { ScreenContext } from "@/lib/screen-context";

export const dynamic = "force-dynamic";

type Msg = { role: "user" | "assistant"; content: string };

type Body = {
  message?: string;
  history?: Msg[];
  context?: ScreenContext;
};

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set in .env" },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = body.message?.trim() ?? "";
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const ctx = body.context;
  const history = (body.history ?? []).slice(-8);

  const system = [
    "You are Vaya’s in-app ops/product assistant for a car-subscription take-home demo.",
    "Answer briefly and clearly (usually 2–6 sentences). Prefer facts about how THIS app works.",
    "You can see which screen the user is on — tailor the answer to that context.",
    "Do not invent DB rows, miles, or payments. If unsure, say what the UI/code typically does.",
    "Key product facts:",
    "- Part 1 Marketplace vs Part 2 Telemetry are separate header modes.",
    "- Fleet truth = live commitment lock; Conflicts = seed quarantine.",
    "- Mileage review: COMPLETE can be red when flagged (e.g. duplicate_trip_end) — intentional.",
    "- Feed VINs ≠ seed marketplace VINs (parallel dataset).",
    "- Driver on trips is usually unknown; fuel health from fuelConsumed; metrics from tripMetrics.",
    ctx
      ? `Current UI context: part=${ctx.part}; screen=${ctx.screen}; path=${ctx.pathname}${ctx.search || ""}; purpose=${ctx.purpose}`
      : "Current UI context: unknown.",
  ].join("\n");

  const messages = [
    { role: "system" as const, content: system },
    ...history.map((m) => ({
      role: m.role,
      content: m.content.slice(0, 2000),
    })),
    { role: "user" as const, content: message.slice(0, 2000) },
  ];

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 400,
      messages,
    }),
  });

  if (!openaiRes.ok) {
    const detail = await openaiRes.text();
    console.error("OpenAI chat error", openaiRes.status, detail.slice(0, 500));
    return NextResponse.json(
      { error: "OpenAI request failed", status: openaiRes.status },
      { status: 502 },
    );
  }

  const payload = (await openaiRes.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const reply = payload.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    return NextResponse.json(
      { error: "Empty reply from model" },
      { status: 502 },
    );
  }

  return NextResponse.json({ reply, context: ctx ?? null });
}
