// Ingest data/feed.jsonl into telemetry_raw (idempotent) and apply IMEI↔VIN assignment side effects.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";

const db = new PrismaClient();

type FeedLine = {
  deliveredAt: string;
  source: string;
  event: string;
  data: Record<string, unknown>;
  endpoint?: string;
};

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function asDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Deterministic idempotency key — distinguishes redelivered duplicates by deliveredAt. */
export function naturalKeyFor(line: FeedLine): string {
  const d = line.data ?? {};
  const parts = [
    line.source,
    line.event,
    line.deliveredAt,
    asString(d.imei) ?? "",
    asString(d.transactionId) ?? "",
    asString(d.timestamp) ?? asString(d.startTime) ?? "",
    line.endpoint ?? "",
  ];
  const base = parts.join("|");
  // Extra hash of payload so two identical envelopes with different bodies still diverge.
  const digest = createHash("sha256")
    .update(JSON.stringify(line.data))
    .digest("hex")
    .slice(0, 12);
  return `${base}|${digest}`;
}

function eventAtFor(line: FeedLine): Date | null {
  const d = line.data ?? {};
  return (
    asDate(d.timestamp) ??
    asDate(d.startTime) ??
    asDate(d.endTime) ??
    asDate(line.deliveredAt)
  );
}

function vinFromLine(line: FeedLine): string | null {
  const d = line.data ?? {};
  if (line.event === "vinChange") return asString(d.newVin);
  return asString(d.vin);
}

async function ensureDevice(imei: string, seenAt: Date) {
  await db.device.upsert({
    where: { imei },
    create: { imei, firstSeenAt: seenAt, lastSeenAt: seenAt },
    update: { lastSeenAt: seenAt },
  });
}

async function openAssignment(args: {
  imei: string;
  vin: string;
  at: Date;
  openedBy: string;
}) {
  const open = await db.deviceVehicleAssignment.findFirst({
    where: { imei: args.imei, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (open) {
    if (open.vin === args.vin) return open;
    await db.deviceVehicleAssignment.update({
      where: { id: open.id },
      data: { endedAt: args.at, closedBy: args.openedBy },
    });
  }
  return db.deviceVehicleAssignment.create({
    data: {
      imei: args.imei,
      vin: args.vin,
      startedAt: args.at,
      openedBy: args.openedBy,
    },
  });
}

async function applyVinChange(args: {
  imei: string;
  oldVin: string | null;
  newVin: string;
  at: Date;
  naturalKey: string;
}) {
  const open = await db.deviceVehicleAssignment.findFirst({
    where: { imei: args.imei, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (open) {
    await db.deviceVehicleAssignment.update({
      where: { id: open.id },
      data: { endedAt: args.at, closedBy: args.naturalKey },
    });
  } else if (args.oldVin) {
    // No open row (e.g. cold start) — record a closed historical interval if useful? Skip.
  }
  await db.deviceVehicleAssignment.create({
    data: {
      imei: args.imei,
      vin: args.newVin,
      startedAt: args.at,
      openedBy: args.naturalKey,
    },
  });
}

async function applySideEffects(line: FeedLine, naturalKey: string) {
  const d = line.data ?? {};
  const imei = asString(d.imei);
  if (!imei) return;

  const at = eventAtFor(line) ?? new Date(line.deliveredAt);
  await ensureDevice(imei, at);

  if (line.event === "vinChange") {
    const newVin = asString(d.newVin);
    if (!newVin) return;
    await applyVinChange({
      imei,
      oldVin: asString(d.oldVin),
      newVin,
      at,
      naturalKey,
    });
    return;
  }

  const vin = vinFromLine(line);
  if (vin) {
    await openAssignment({ imei, vin, at, openedBy: naturalKey });
  }
}

async function main() {
  const path = resolve(process.cwd(), "data/feed.jsonl");
  const lines = readFileSync(path, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as FeedLine);

  // Destructive reload of telemetry only — marketplace untouched.
  await db.$transaction([
    db.mileageDecision.deleteMany(),
    db.trip.deleteMany(),
    db.telemetryRaw.deleteMany(),
    db.deviceVehicleAssignment.deleteMany(),
    db.device.deleteMany(),
  ]);

  let inserted = 0;
  // Process in delivery order so assignments follow the stream.
  const ordered = [...lines].sort(
    (a, b) =>
      new Date(a.deliveredAt).getTime() - new Date(b.deliveredAt).getTime(),
  );

  for (const line of ordered) {
    const naturalKey = naturalKeyFor(line);
    const imei = asString(line.data?.imei);
    const transactionId = asString(line.data?.transactionId);
    const deliveredAt = new Date(line.deliveredAt);
    const eventAt = eventAtFor(line);

    if (imei) await ensureDevice(imei, eventAt ?? deliveredAt);

    try {
      await db.telemetryRaw.create({
        data: {
          naturalKey,
          deliveredAt,
          source: line.source,
          event: line.event,
          imei,
          transactionId,
          eventAt,
          payload: line as unknown as Prisma.InputJsonValue,
        },
      });
      inserted += 1;
      await applySideEffects(line, naturalKey);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        // Idempotent skip — should not happen after truncate, but safe for re-entry.
        continue;
      }
      throw e;
    }
  }

  const [devices, raw, assignments] = await Promise.all([
    db.device.count(),
    db.telemetryRaw.count(),
    db.deviceVehicleAssignment.count(),
  ]);

  console.log(
    JSON.stringify(
      {
        feedLines: lines.length,
        inserted,
        devices,
        telemetryRaw: raw,
        assignments,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
