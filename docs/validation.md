# Preparation validation

Validated locally on 22 November 2026. These checks cover this repository's setup helpers.
They do not certify a runner image or a deployed Multica installation.

| Mode | Unit | CLI integration | Shell syntax | Measured helper line / branch coverage |
| --- | --- | --- | --- | --- |
| Full | 14 passed, no skips | 3 passed, no skips | Passed | 100% / 100% |
| Fast | 14 passed, no skips | Not run | Passed | 100% / 100% |

Coverage scope: `runner_setup.py`, 77 statements and 32 branches. CLI and shell behavior have separate integration tests.
The startup test uses a fake Docker executable. It checks preview behavior, token permissions and stdin delivery without a login or deployment.
Functional UI coverage is N/A because this repository has no UI. Product UI acceptance remains pending.

Commands:

```bash
uv run --locked python scripts/check.py full
uv run --locked python scripts/check.py fast
```

Independent review identified missing explicit daemon concurrency and loose tool-version matching.
Both have regression tests and fixes. The prepared runner permits one daemon task at a time.
The version doctor rejects dependency-version matches and prereleases that differ from a stable pin.

The laptop has no Docker Compose plugin. Compose schema validation and real image/startup acceptance remain pending.
Gitleaks 8.30.1 scanned all 29 staged public files and found no leaks.
No container, VM, Multica service or product code was changed during these checks.
