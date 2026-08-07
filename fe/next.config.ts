// Next.js app configuration (UI lives in fe/; domain code in be/).

import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import path from "path";

const repoRoot = path.join(__dirname, "..");
// Keep secrets in repo-root `.env` while the Next project dir is `fe/`.
loadEnvConfig(repoRoot);

const nextConfig: NextConfig = {
  // Allow imports from ../be (lib, auth, etc.).
  experimental: {
    externalDir: true,
  },
  // Repo root so Turbopack sees fe/ + be/ (and the real package-lock.json).
  turbopack: {
    root: repoRoot,
  },
};

export default nextConfig;
