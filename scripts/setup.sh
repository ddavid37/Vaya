#!/usr/bin/env bash
set -euo pipefail
npm install
docker compose up -d db
echo "Waiting for Postgres..."
until docker compose exec -T db pg_isready -U vaya -d vaya >/dev/null 2>&1; do sleep 1; done
npx prisma migrate deploy
npm run db:seed
echo "Setup complete. Run: npm run dev"
