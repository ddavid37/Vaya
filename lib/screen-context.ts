// Map current route → human screen/view context for the global AI chat.

export type ScreenContext = {
  pathname: string;
  search: string;
  part: "Marketplace (Part 1)" | "Telemetry (Part 2)";
  screen: string;
  purpose: string;
};

export function screenContextFromLocation(
  pathname: string,
  search = "",
): ScreenContext {
  const path = pathname || "/";
  const part =
    path.startsWith("/ops/disputes") || path.startsWith("/ops/signals")
      ? ("Telemetry (Part 2)" as const)
      : ("Marketplace (Part 1)" as const);

  if (path === "/" || path === "") {
    return {
      pathname: path,
      search,
      part,
      screen: "Marketplace",
      purpose:
        "Browse bookable vehicles and commit (one live commitment per car).",
    };
  }
  if (path.startsWith("/mine")) {
    return {
      pathname: path,
      search,
      part,
      screen: "My cars",
      purpose:
        "Driver’s own subscriptions: early end, ledger, monthly total.",
    };
  }
  if (path === "/ops" || path === "/ops/") {
    return {
      pathname: path,
      search,
      part,
      screen: "Fleet truth",
      purpose:
        "Ops fleet board: live commitments, conflicts, early-end actions.",
    };
  }
  if (path.startsWith("/ops/conflicts")) {
    return {
      pathname: path,
      search,
      part,
      screen: "Conflicts",
      purpose:
        "Quarantine / decisions about dirty seed or dual-live rows.",
    };
  }
  if (path.startsWith("/ops/disputes")) {
    return {
      pathname: path,
      search,
      part,
      screen: "Mileage review",
      purpose:
        "Telemetry disputes: IMEI trips, trusted miles, fuel health, critical metrics, manual confirm, AI summary. COMPLETE can show red when flagged (e.g. duplicate_trip_end).",
    };
  }
  if (path.startsWith("/ops/signals")) {
    return {
      pathname: path,
      search,
      part,
      screen: "Driving signals",
      purpose:
        "Avg speed / hard accel-brake sketch from tripMetrics; vehicle scanning placeholders.",
    };
  }

  return {
    pathname: path,
    search,
    part,
    screen: "Unknown",
    purpose: "General Vaya app screen.",
  };
}
