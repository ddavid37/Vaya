// Unit tests for Part 2 telemetry failure modes claimed in DECISIONS.md.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import {
  decideMileage,
  isMetricsDelayed,
  isTripAssemblyEvent,
  vinAtTime,
} from "../lib/mileage";
import { naturalKeyFor } from "../lib/telemetry-keys";

describe("mileage decision (never average)", () => {
  it("prefers monotonic odometer delta and discards tripDistance without averaging", () => {
    const d = decideMileage({
      startOdo: 100,
      endOdo: 110.5,
      tripDistance: 10.0,
    });
    assert.equal(d.source, "ODOMETER_DELTA");
    assert.equal(d.trustedMiles, 10.5);
    assert.notEqual(d.trustedMiles, (10.5 + 10) / 2);
    assert.ok(
      (d.discardedInputs.tripDistance as { value: number }).value === 10.0,
    );
  });

  it("TX-480041-style impossible odometer trusts tripDistance", () => {
    const d = decideMileage({
      startOdo: 9682.3,
      endOdo: 9563.9,
      tripDistance: 26.9,
    });
    assert.equal(d.impossibleOdo, true);
    assert.equal(d.source, "TRIP_DISTANCE");
    assert.equal(d.trustedMiles, 26.9);
  });

  it("uses tripDistance when odometer incomplete (REST-shaped gaps)", () => {
    const d = decideMileage({
      startOdo: null,
      endOdo: null,
      tripDistance: 37.7,
    });
    assert.equal(d.source, "TRIP_DISTANCE");
    assert.equal(d.trustedMiles, 37.7);
  });
});

describe("device moved / assignment intervals", () => {
  it("resolves VIN from open interval after vinChange boundary", () => {
    const intervals = [
      {
        vin: "JM1BPBLM4P1000333",
        startedAt: new Date("2026-07-01T00:00:00Z"),
        endedAt: new Date("2026-07-17T14:02:00Z"),
      },
      {
        vin: "3FMCR9B65PR000444",
        startedAt: new Date("2026-07-17T14:02:00Z"),
        endedAt: null,
      },
    ];
    assert.equal(
      vinAtTime(intervals, new Date("2026-07-10T12:00:00Z")),
      "JM1BPBLM4P1000333",
    );
    assert.equal(
      vinAtTime(intervals, new Date("2026-07-17T15:00:00Z")),
      "3FMCR9B65PR000444",
    );
  });
});

describe("out of signal / delayed metrics", () => {
  it("flags metrics delivered more than 36h after trip end", () => {
    const end = new Date("2026-07-09T12:00:00Z");
    const burst = new Date("2026-07-11T16:20:00Z");
    assert.equal(isMetricsDelayed(end, burst), true);
    assert.equal(isMetricsDelayed(end, new Date("2026-07-09T13:00:00Z")), false);
  });
});

describe("duplicates / idempotent raw keys", () => {
  it("natural keys differ when the same TX is redelivered later", () => {
    const a = naturalKeyFor({
      deliveredAt: "2026-07-06T16:52:24Z",
      source: "webhook",
      event: "tripEnd",
      data: { imei: "x", transactionId: "TX-480036", timestamp: "2026-07-06T16:50:00Z" },
    });
    const b = naturalKeyFor({
      deliveredAt: "2026-07-06T23:12:00Z",
      source: "webhook",
      event: "tripEnd",
      data: { imei: "x", transactionId: "TX-480036", timestamp: "2026-07-06T16:50:00Z" },
    });
    assert.notEqual(a, b);
  });
});

describe("sparse GPS / non-trip events", () => {
  it("does not treat tripData, mil, or battery as trip assembly events", () => {
    assert.equal(isTripAssemblyEvent("tripData"), false);
    assert.equal(isTripAssemblyEvent("mil"), false);
    assert.equal(isTripAssemblyEvent("battery"), false);
    assert.equal(isTripAssemblyEvent("tripStart"), true);
    assert.equal(isTripAssemblyEvent("trip"), true);
  });

  it("feed tripData lines never carry a transactionId used for trips", () => {
    const lines = readFileSync(resolve("be/data/feed.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l) as { event: string; data: { transactionId?: string } });
    const tripData = lines.filter((e) => e.event === "tripData");
    assert.ok(tripData.length > 0);
    for (const e of tripData) {
      assert.equal(e.data.transactionId, undefined);
      assert.equal(isTripAssemblyEvent(e.event), false);
    }
  });
});

describe("feed evidence smoke checks", () => {
  it("includes vinChange and TX-480041 impossible odo in the fixture", () => {
    const lines = readFileSync(resolve("be/data/feed.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    assert.ok(lines.some((e: { event: string }) => e.event === "vinChange"));
    const start = lines.find(
      (e: { event: string; data: { transactionId?: string } }) =>
        e.event === "tripStart" && e.data.transactionId === "TX-480041",
    );
    const end = lines.find(
      (e: { event: string; data: { transactionId?: string } }) =>
        e.event === "tripEnd" && e.data.transactionId === "TX-480041",
    );
    assert.ok(start && end);
    const s = start.data.start.odometer as number;
    const en = end.data.end.odometer as number;
    assert.ok(en < s);
  });
});
