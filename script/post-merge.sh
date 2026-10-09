#!/usr/bin/env bash
set -euo pipefail

# Run from the project root even when invoked from another directory.
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Restore exactly the checked-in dependencies; never prompt or alter the lockfile.
npm ci --no-audit --no-fund --include=dev
npm run check

# Schema initialization only. Fictional-history adjustments and fee processing
# require explicit authorization and must never run as part of a merge hook.
npx --no-install tsx script/migrate-fees.ts
npm run build
