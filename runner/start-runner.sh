#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")" && pwd)
case ${1:---plan} in
  --plan)
    echo 'Plan: validate Compose, read the token through stdin, log in, then start this runner.'
    echo 'Run this script with --apply only on the selected worker VM.'
    exit 0 ;;
  --apply) ;;
  *) echo 'Usage: start-runner.sh [--plan|--apply]' >&2; exit 2 ;;
esac
command -v node >/dev/null 2>&1 || { echo 'Install Node 22.8+ before startup.' >&2; exit 2; }
token=$(node -e 'const fs=require("node:fs");process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1],"utf8")).token_file)' "$root/bundle.json")
[[ -s "$token" && -r "$token" ]] || { echo 'Token file is missing, empty or unreadable.' >&2; exit 2; }
node -e 'const fs=require("node:fs");if(fs.statSync(process.argv[1]).mode & 0o077){console.error("Token file must use owner-only permissions.");process.exit(2)}' "$token"
if docker compose version >/dev/null 2>&1; then
  compose=(docker compose)
elif docker-compose version >/dev/null 2>&1; then
  compose=(docker-compose)
else
  echo 'Install Docker Compose before starting the runner.' >&2; exit 2
fi
"${compose[@]}" -f "$root/compose.json" config --quiet
"${compose[@]}" -f "$root/compose.json" run --rm --no-deps -T runner \
  multica --profile runner login --token < "$token"
"${compose[@]}" -f "$root/compose.json" up -d
