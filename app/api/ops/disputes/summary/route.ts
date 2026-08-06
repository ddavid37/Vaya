// POST: build a 1–3 sentence ops summary of device activity from assembled trip facts (OpenAI).

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateUsage, usageOverallLine } from "@/lib/usage-level";

export const dynamic = "force-dynamic";

type Body = {
  imei?: string;
  from?: string;
  to?: string;
};

function num(v: { toString(): string } | null | undefined): number | null {
  if (v == null) return null;
  return Number(v.toString());
}

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

  const imei = body.imei?.trim() ?? "";
  if (!imei) {
    return NextResponse.json({ error: "imei is required" }, { status: 400 });
  }

  const from = body.from ? new Date(body.from) : null;
  const to = body.to ? new Date(body.to) : null;

  const [assignments, trips] = await Promise.all([
    db.deviceVehicleAssignment.findMany({
      where: { imei },
      orderBy: { startedAt: "asc" },
    }),
    db.trip.findMany({
      where: {
        imei,
        ...(from || to
          ? {
              startAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      include: { mileageDecision: true },
      orderBy: { startAt: "asc" },
    }),
  ]);

  const trustedSum = trips.reduce((sum, t) => {
    const m = num(t.mileageDecision?.trustedMiles);
    return sum + (m ?? 0);
  }, 0);

  const level = rateUsage(trips);
  const overallLine = usageOverallLine(level);

  const facts = {
    imei,
    period: {
      from: body.from ?? null,
      to: body.to ?? null,
    },
    usageLevel: level,
    assignments: assignments.map((a) => ({
      vin: a.vin,
      startedAt: a.startedAt.toISOString(),
      endedAt: a.endedAt?.toISOString() ?? null,
      open: a.endedAt == null,
    })),
    tripCount: trips.length,
    trustedMilesSum: Number(trustedSum.toFixed(1)),
    trips: trips.map((t) => ({
      transactionId: t.transactionId,
      vin: t.vin,
      startAt: t.startAt?.toISOString() ?? null,
      endAt: t.endAt?.toISOString() ?? null,
      assemblyStatus: t.assemblyStatus,
      flags: t.flags,
      trustedMiles: num(t.mileageDecision?.trustedMiles),
      mileageSource: t.mileageDecision?.source ?? null,
      rationale: t.mileageDecision?.rationale ?? null,
    })),
  };

  const system = [
    "You write short ops summaries for a car-subscription telemetry review screen.",
    "Use ONLY the JSON facts provided. Do not invent miles, VINs, trips, or causes.",
    "Write 1 to 3 sentences in plain English for an ops reader.",
    "Mention device (IMEI), VIN assignment changes if any, trusted miles, and notable flagged trips.",
    `End with exactly this sentence (same wording): "${overallLine}"`,
    "Feed VINs are a parallel dataset — do not claim marketplace subscription status.",
  ].join(" ");

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 220,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Summarize this device activity in 1–3 sentences, then the required overall line:\n${JSON.stringify(facts)}`,
        },
      ],
    }),
  });

  if (!openaiRes.ok) {
    const detail = await openaiRes.text();
    console.error("OpenAI error", openaiRes.status, detail.slice(0, 500));
    return NextResponse.json(
      { error: "OpenAI request failed", status: openaiRes.status },
      { status: 502 },
    );
  }

  const payload = (await openaiRes.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  let summary = payload.choices?.[0]?.message?.content?.trim() ?? "";
  if (!summary) {
    return NextResponse.json(
      { error: "Empty summary from model" },
      { status: 502 },
    );
  }

  if (!summary.toLowerCase().includes(`use of the car is ${level}`)) {
    summary = `${summary.replace(/\s+$/, "")} ${overallLine}`;
  }

  return NextResponse.json({ summary, level });
}
