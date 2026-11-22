# Repository guide

Read INTENT.md and docs/strategy.md before changing this project.

- `bin/potato.mjs` and `lib/` own the npx/shell setup flow; Node 22.8+ and built-in tests, no runtime npm dependencies.
- `lib/doctor.mjs` owns readiness diagnostics; `lib/system.mjs` shares bounded command execution and Docker/Compose discovery.
- Doctor inspects `.potato/repository.json` without executing its declared commands. Live image/browser probes require `--probe`.
- `runner/Dockerfile` and `config/toolchain.json` own the shared tool image and source pins.
- `runner_setup.py` validates release metadata and prepares local runner bundles.
- `runner/` contains runner policy and startup assets. Keep engine-specific instructions there.
- `scripts/` contains preparation, diagnostic and local-check entry points.
- `templates/` contains the shared PR description. `docs/` contains the strategy and test policy.
- Use Python 3.12 or later. Product helpers use the standard library; coverage is a test dependency.
- Run `uv sync --locked`, then `uv run --locked python scripts/check.py full` for code or runner-policy changes.
- Fast mode is for an approved small/non-code scope; report its omitted test layers.
- Test behavior and failure paths. Do not start containers or contact SaaS during unit/integration tests.
- Keep secrets, private plugin packages, personal settings, host facts and generated bundles out of Git.
- This project requires no hosted workflow or Git-host protection API. Do not add one as a prerequisite.
- Keep this file and CLAUDE.md engine-agnostic. Runner operating policy belongs in `runner/multica-claude.local.md`.
