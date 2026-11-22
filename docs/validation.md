# Potato setup validation

Validated locally on 22 November 2026. These checks cover setup tooling, not a deployed Multica installation.

| Mode | Python unit | Python CLI integration | Node unit | Node CLI integration |
| --- | --- | --- | --- | --- |
| Full | 33 passed | 4 passed | 12 passed | 5 passed |
| Fast | 33 passed | Not run | 12 passed | Not run |

No selected tests failed, skipped, remained TODO or were cancelled. Bash syntax checks passed.

| Measured source | Line coverage | Branch coverage |
| --- | --- | --- |
| Python setup/image helpers and Node-result parser | 99.47% | 98.57% |
| Node installer and terminal helpers (`lib/*.mjs`) | 100% | 89.41% |

CLI entry points have separate behavior tests. Coverage does not establish that a real image or product test passed.
Functional product UI coverage is N/A because this repository contains setup helpers, not a product UI.

The full command runs both language unit and integration suites. Fast mode explicitly omits both integration suites:

```bash
uv sync --locked
uv run --locked python scripts/check.py full
uv run --locked python scripts/check.py fast
```

The npm tarball contains the Docker build inputs and excludes local bytecode/private fixtures.
A local `npm exec --offline --package=<tarball> -- potato --plan` smoke passed without Docker calls or bundle writes.
The pinned GitHub archive npx entry point also passed plan-mode smoke at commit `05e2c89add4a2946a5eb4bca970bd1c438a54128`.

The image catalog's 21 downloaded official artifacts matched their pinned SHA-256 hashes for amd64/arm64.
The official base manifest and signed Debian snapshot metadata were checked. This verifies sources, not executable compatibility.

Independent review found path interpolation/quoting, Colima mount placement, legacy architecture detection,
rootless UID mapping, partial-output retry, package inclusion, host-runtime and incomplete-test-result gaps.
Regression tests and fixes cover the important findings. Output paths with literal shell syntax remain literal.

Docker Compose 5.8.0 accepts the prepared configuration. Colima is stopped, so a real Docker image build,
nonroot version doctor, daemon startup and private skill/plugin/MCP acceptance remain unverified.
No VM, runner service or production application was started or changed. No npm or image publication occurred.
