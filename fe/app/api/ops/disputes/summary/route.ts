// POST: build an ops summary of device activity from assembled trip + feed metrics (OpenAI).

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  scoreDrivingHealth,
  scoreVinDrivingHealth,
} from "@/lib/driving-health";
import {
  aggregateDriveSignals,
  metricsByTransactionId,
} from "@/lib/trip-metrics-from-raw";
import { usageLevelFromHealth, usageOverallLine } from "@/lib/usage-level";

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

  const metricRows =
    trips.length > 0
      ? await db.telemetryRaw.findMany({
          where: {
            event: { in: ["tripEnd", "trip", "tripMetrics"] },
            transactionId: { in: trips.map((t) => t.transactionId) },
          },
          select: { event: true, transactionId: true, payload: true },
        })
      : [];
  const metricsMap = metricsByTransactionId(metricRows);
  const signals = aggregateDriveSignals(metricsMap.values());

  const trustedSum = trips.reduce((sum, t) => {
    const m = num(t.mileageDecision?.trustedMiles);
    return sum + (m ?? 0);
  }, 0);

  const healthCounts = { healthy: 0, fair: 0, poor: 0, unknown: 0 };
  const tripFacts = trips.map((t) => {
    const miles = num(t.mileageDecision?.trustedMiles);
    const m = metricsMap.get(t.transactionId);
    const health = scoreDrivingHealth({
      miles,
      fuelConsumed: m?.fuelConsumed ?? null,
      averageDriveSpeed: m?.averageDriveSpeed ?? null,
      hardBrakingCounts: m?.hardBrakingCounts ?? null,
      hardAccelerationCounts: m?.hardAccelerationCounts ?? null,
      totalIdlingTime: m?.totalIdlingTime ?? null,
      tripTime: m?.tripTime ?? null,
      assemblyStatus: t.assemblyStatus,
      flags: t.flags,
    });
    healthCounts[health.health] += 1;
    return {
      transactionId: t.transactionId,
      vin: t.vin,
      startAt: t.startAt?.toISOString() ?? null,
      endAt: t.endAt?.toISOString() ?? null,
      assemblyStatus: t.assemblyStatus,
      flags: t.flags,
      trustedMiles: miles,
      mileageSource: t.mileageDecision?.source ?? null,
      fuelConsumed: m?.fuelConsumed ?? null,
      averageDriveSpeed: m?.averageDriveSpeed ?? null,
      hardBrakingCounts: m?.hardBrakingCounts ?? null,
      hardAccelerationCounts: m?.hardAccelerationCounts ?? null,
      totalIdlingTime: m?.totalIdlingTime ?? null,
      tripTime: m?.tripTime ?? null,
      drivingHealth: health.health,
      drivingHealthCalculation: health.calculation,
    };
  });

  const deviceHealth = scoreVinDrivingHealth(
    trips.map((t) => {
      const miles = num(t.mileageDecision?.trustedMiles);
      const m = metricsMap.get(t.transactionId);
      return {
        miles,
        fuelConsumed: m?.fuelConsumed ?? null,
        averageDriveSpeed: m?.averageDriveSpeed ?? null,
        hardBrakingCounts: m?.hardBrakingCounts ?? null,
        hardAccelerationCounts: m?.hardAccelerationCounts ?? null,
        totalIdlingTime: m?.totalIdlingTime ?? null,
        tripTime: m?.tripTime ?? null,
        assemblyStatus: t.assemblyStatus,
        flags: t.flags,
      };
    }),
  );
  const level = usageLevelFromHealth(
    deviceHealth.health,
    deviceHealth.avgPoints,
  );
  const overallLine = usageOverallLine(level);

  const facts = {
    imei,
    period: {
      from: body.from ?? null,
      to: body.to ?? null,
    },
    usageLevel: level,
    overallDrivingHealth: deviceHealth.health,
    overallDrivingHealthCalculation: deviceHealth.calculation,
    assignments: assignments.map((a) => ({
      vin: a.vin,
      startedAt: a.startedAt.toISOString(),
      endedAt: a.endedAt?.toISOString() ?? null,
      open: a.endedAt == null,
    })),
    tripCount: trips.length,
    trustedMilesSum: Number(trustedSum.toFixed(1)),
    driveSignals: {
      meanAverageDriveSpeedMph: signals.avgSpeed,
      hardBrakingCountsSum: signals.hardBrakeSum,
      hardAccelerationCountsSum: signals.hardAccelSum,
      fuelConsumedSum: signals.fuelSum,
      tripsWithSpeed: signals.samplesWithSpeed,
      tripsWithFuel: signals.samplesWithFuel,
    },
    drivingHealthCounts: healthCounts,
    vehicleScanning: {
      status: "placeholder",
      note: "Before/after vehicle scanning tests are available on Signals; treat as not yet completed unless facts say otherwise.",
    },
    trips: tripFacts,
  };

  const system = [
    "You write ops summaries for a car-subscription telemetry Mileage review screen.",
    "Use ONLY the JSON facts. Do not invent miles, speeds, counts, VINs, or scan results.",
    "Write 3 to 5 short sentences (still concise) for an ops reader.",
    "You MUST explicitly consider and mention in every summary:",
    "(1) averageDriveSpeed,",
    "(2) hardBrakingCounts,",
    "(3) hardAccelerationCounts,",
    "(4) composite driving health that INCLUDES dataHealth (flags/assembly) — use overallDrivingHealth and overallDrivingHealthCalculation;",
    "(5) fuel efficiency where present,",
    "(6) vehicle scanning tests (placeholder if so).",
    "The overall color (green/yellow/orange/red) MUST match overall driving health, not data-only flags.",
    "Also mention trusted miles when present.",
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
      max_tokens: 320,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Summarize this device activity, covering speed/braking/accel, fuel health, and scanning, then the required overall line:\n${JSON.stringify(facts)}`,
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

  // Soft guarantee: if model skipped a required theme, append a factual clause.
  const lower = summary.toLowerCase();
  const missing: string[] = [];
  if (!lower.includes("speed") && !lower.includes("averagedrivespeed")) {
    missing.push(
      signals.avgSpeed != null
        ? `Mean averageDriveSpeed ${signals.avgSpeed} mph`
        : "averageDriveSpeed unavailable",
    );
  }
  if (!lower.includes("brak")) {
    missing.push(`hardBrakingCounts sum ${signals.hardBrakeSum}`);
  }
  if (!lower.includes("accel")) {
    missing.push(`hardAccelerationCounts sum ${signals.hardAccelSum}`);
  }
  if (!lower.includes("fuel") && !lower.includes("health")) {
    missing.push(
      `fuelConsumed sum ${signals.fuelSum}; health counts ${JSON.stringify(healthCounts)}`,
    );
  }
  if (!lower.includes("scan")) {
    missing.push(
      "Vehicle scanning tests remain placeholder (see Signals)",
    );
  }
  if (missing.length > 0) {
    summary = `${summary.replace(/\s+$/, "")} Also noted: ${missing.join("; ")}.`;
  }

  return NextResponse.json({ summary, level });
}
