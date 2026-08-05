import { createSubscription, SubscriptionError } from "@/lib/subscriptions";
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.driverId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Sign in with Google to commit" },
      { status: 401 },
    );
  }

  const body = (await req.json()) as {
    vehicleId?: string;
    planId?: string;
  };

  if (!body.vehicleId || !body.planId) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "vehicleId, planId required" },
      { status: 400 },
    );
  }

  try {
    const result = await createSubscription({
      driverId: session.driverId,
      vehicleId: body.vehicleId,
      planId: body.planId,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof SubscriptionError) {
      const status =
        e.code === "VEHICLE_NOT_AVAILABLE"
          ? 409
          : e.code === "NOT_FOUND"
            ? 404
            : 400;
      return NextResponse.json({ code: e.code, message: e.message }, { status });
    }
    console.error(e);
    return NextResponse.json(
      { code: "INTERNAL", message: "Unexpected error" },
      { status: 500 },
    );
  }
}
