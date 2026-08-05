import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the workspace root so a stray lockfile elsewhere on the machine
  // doesn't get misdetected as the project root.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
