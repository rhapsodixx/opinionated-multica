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
token=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["token_file"])' "$root/bundle.json")
[[ -s "$token" && -r "$token" ]] || { echo 'Token file is missing, empty or unreadable.' >&2; exit 2; }
python3 - "$token" <<'PY'
import os, stat, sys
if stat.S_IMODE(os.stat(sys.argv[1]).st_mode) & 0o077:
    sys.exit('Token file must not grant group or other access. Use owner-only permissions.')
PY
docker compose -f "$root/compose.json" config --quiet
docker compose -f "$root/compose.json" run --rm --no-deps -T runner \
  multica --profile runner login --token < "$token"
docker compose -f "$root/compose.json" up -d
