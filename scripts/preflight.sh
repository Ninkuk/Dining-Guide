#!/usr/bin/env bash
# Pre-commit preflight: auto-fix what's fixable, then verify everything CI checks.
# If this passes locally, CI will pass too.
set -euo pipefail

step() {
  printf "\n==> %s\n" "$1"
}

step "Format (prettier --write)"
npx prettier --write .

step "Lint (eslint --fix)"
npx eslint --fix .

step "Typecheck (tsc --noEmit)"
npx tsc --noEmit

step "Tests (vitest run)"
npx vitest run

printf "\nPreflight passed. Ready to commit.\n"
