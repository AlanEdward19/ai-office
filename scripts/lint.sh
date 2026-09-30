#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# ESLint only; no prettier script in package.json yet.
npm run lint
