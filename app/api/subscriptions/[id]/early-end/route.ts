import { auth } from "@/auth";
import { NextResponse } from "next/server";
import {
  earlyEndSubscription,
  SubscriptionError,
} from "@/lib/subscriptions";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json()) as {
    mode?: "SCHEDULE" | "IMMEDIATE";
    endDate?: string;
  };

  if (body.mode !== "SCHEDULE" && body.mode !== "IMMEDIATE") {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "mode must be SCHEDULE or IMMEDIATE" },
      { status: 400 },
    );
  }

  // Signed-in drivers may only early-end their own subs (My cars).
  // Ops stays open without Google for the fleet pilot.
  const session = await auth();
  if (session?.driverId) {
    const sub = await db.subscription.findUnique({
      where: { id },
      select: { driverId: true },
    });
    if (!sub) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Subscription not found" },
        { status: 404 },
      );
    }
    if (sub.driverId !== session.driverId) {
      return NextResponse.json(
        { code: "FORBIDDEN", message: "Not your subscription" },
        { status: 403 },
      );
    }
  }

  try {
    const result = await earlyEndSubscription({
      subscriptionId: id,
      mode: body.mode,
      endDate: body.endDate,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof SubscriptionError) {
      const status = e.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ code: e.code, message: e.message }, { status });
    }
    console.error(e);
    return NextResponse.json(
      { code: "INTERNAL", message: "Unexpected error" },
      { status: 500 },
    );
  }
}
