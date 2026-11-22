# Local tests, coverage and modes

Every automated run records its scope, mode, results and coverage. Run locally before PR/MR publication.
No hosted workflow or Git-host protection API is required.

## Coverage by layer

| Layer | Required evidence |
| --- | --- |
| Unit | Passed/failed/skipped counts; measured line and branch coverage; changed behavior and uncovered branches |
| Integration/API | Selected and completed scenarios against the approved contract matrix; relevant service/DB versions; result per scenario |
| Component/non-functional UI | Named component/type/build/accessibility/layout checks; result and limits. Do not label these functional UI regression |
| Functional UI | Completed/required user-journey cases and the browser/viewport/theme/role/state matrix; screenshots/traces; failures and not-run cases |
| Security/migrations | Named scans and apply/recovery/compatibility cases; actual output and limits |

Code coverage and scenario coverage are different. Do not average them into one platform percentage.
For example, 91% unit branch coverage and 12/15 UI scenarios are separate results, not a combined score.
If a layer has no applicable behavior, say N/A and why. If it should apply but did not run, say Not run and block a required suite.
Use each repo's approved baseline and thresholds. Do not invent an 80% platform-wide target or improve coverage by deleting assertions.

## Full regression

Run the complete approved repository regression profile: unit, integration/API, applicable component/non-functional checks,
functional UI journeys, builds, security and migrations. Include cross-repo contract tests when the task spans repositories.

Full mode means the full **declared profile**, not every possible test. Report a missing capability instead of claiming complete coverage.
Changes to UI behavior, contracts, authentication, migrations, runtime/dependencies or unknown-impact paths select full mode by default.

## Fast mode

Use fast mode only for reviewed small/non-code changes or paths proven eligible by the repo's impact policy.
It may run unit tests, lint/types, builds or a smaller component/non-functional UI set.
It normally excludes functional UI regression. List that exclusion in the report and PR body.
Do not choose by line count alone. An unknown path or insufficient impact evidence selects full mode.
Release/integration work uses full mode. A required failed or skipped test cannot be waived by changing the mode.

The future product adapter selects the mode from approved repo rules. The preparation helper's own test command accepts an explicit mode;
it does not claim to implement product impact analysis.

## This repository's checks

```bash
uv sync --locked
uv run --locked python scripts/check.py full
uv run --locked python scripts/check.py fast
```

Full runs unit tests, CLI integration tests and shell syntax checks. Fast runs unit tests and shell syntax checks.
The summary reports the actual mode and excluded integration layer.
Coverage.py measures the shared `runner_setup.py` module; CLI processes have separate behavior tests.
The local combined line/branch coverage floor is 85% for that helper, not a rule for future product repositories.

There is no app UI here. Functional UI is **N/A: no UI in this repository**.
No image build, Multica login, live service, scan or product UI test runs during these checks.
The runner image, native plugin delivery and real product regressions need their own later acceptance.

Reports stay under `reports/<mode>/`: raw local logs, coverage JSON/XML and `summary.json`.
Use sanitized summaries in PR bodies. Do not upload private paths, tokens, account state or production evidence.
