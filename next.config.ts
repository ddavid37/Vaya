// Next.js app configuration.

import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Parent ~/package-lock.json made Turbopack pick the wrong root (SSR/client mismatch).
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
