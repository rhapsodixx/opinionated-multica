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

## Playwright as the final browser check

Use Playwright when a change affects a browser journey and the journey can run in an isolated test environment.
Include backend changes whose effects need UI verification. Record the decision and required journeys in the approved test plan.
Run static checks, unit tests and integration/API tests first. Then run the applicable Playwright regression profile before PR/MR publication.
This final check adds to the earlier tests. It does not replace them or the failed regression test required by TDD.

For a UI change, define the journey, user-visible assertions, synthetic fixtures and browser/viewport/role/state matrix before implementation.
Use a running test application and disposable test services. Give each parallel task isolated data and a browser context.
Prefer user-facing locators and assertions that wait for the expected state. Avoid fixed sleeps as the main synchronization method.
Start with Chromium and one browser worker on constrained machines. Expand the approved matrix when product risks require other browsers.
Do not reduce the required matrix because a runner lacks capacity; route the task to a capable runner.

| Layer | Shared requirement | Ownership |
| --- | --- | --- |
| Automated tests | Version-locked Playwright package, matching browser revisions, assertions and declared local command | Repository test profile and lockfile |
| Agent skill | Plan journeys, reuse drivers, run tests, inspect failures and collect evidence | Shared runner policy and approved browser-verification skill release |
| Playwright MCP | Same pinned definition on every runner; invoke when useful for exploration, reproduction or screenshots | Shared MCP catalog; isolated session and task-scoped access |

Keep the Playwright test package local to the repository. Use Node/TypeScript or Python bindings to match existing tests.
Ronda should reuse its confirmed Python Playwright smokes before adding another harness.
The image supplies browser OS dependencies; install the browser revisions required by the locked package into a versioned, architecture-specific cache.
Do not install an unpinned global Playwright or use `@latest` in the shared MCP definition.
Keep MCP dependencies separate so their version cannot silently change the repository's test package or browser revision.

An MCP session helps the agent investigate and operate a browser. It does not replace the repeatable test command or its exit status.
Publish discovered regressions as repository tests when feasible. Do not use personal browser profiles or production authentication state.
Share MCP definitions across runners, not credentials, browser sessions or test state.
The native browser skill, MCP package pin and headless delivery still require certification; this policy does not claim they are installed.

Record the full tested SHA, command, app readiness, browser version, selected matrix and passed/failed/skipped scenario counts.
Keep a machine-readable report and relevant synthetic-data screenshots. Retain failure traces and retry history when the test harness supports them.
Treat flaky retries as visible evidence, not a clean first-attempt pass. Apply the repository's approved retry policy.
Review screenshots for visual changes; successful page loads or screenshots alone do not prove functional behavior.
Report journey coverage as completed/required scenarios, separately from unit line/branch coverage.

Full mode includes the complete declared UI profile. Fast mode may omit it only for an approved eligible scope and must disclose that omission.
If the repository has no UI, report N/A with a reason. If a required UI environment is unavailable, report Not run and block publication.
When automation is genuinely infeasible, obtain an approved plan for alternate verification before implementation; do not invent a pass or silently waive a suite.

References: [browser versions](https://playwright.dev/docs/browsers), [assertions](https://playwright.dev/docs/test-assertions),
[traces](https://playwright.dev/docs/trace-viewer-intro) and [Playwright MCP](https://github.com/microsoft/playwright-mcp).

## Evidence validation

The product publication adapter must validate evidence mechanically before it publishes a code PR/MR.
This is an acceptance requirement; the preparation helper does not yet implement that adapter.
Finding a JSON file or reading a claimed pass is insufficient.

- Match the full tested commit SHA to the candidate commit and PR/MR head.
- Verify a clean source worktree before and after the run. Record tracked changes and untracked source files.
- Declare generated report paths separately. Excluding reports must not hide source changes.
- Match the approved repository profile revision, runner image/policy release and selected mode to the actual run.
- Validate the mode reason and the required layers against the approved impact policy.
- Read actual command results, exit statuses, counts, failures, skips and timeouts.
- Reject missing, empty, failed or unavailable required suites. Detect missing expected results rather than trusting a summary flag.
- Read measured coverage output and scenario denominators. Compare them with the approved baseline and thresholds.
- Resolve artifact references and confirm they contain the expected logs, coverage, screenshots or traces from that run.
- Reject stale or inconsistent evidence. Re-run relevant checks after candidate, source, profile or integration changes.

Use a small versioned evidence schema with required fields and consistent result values.
Keep raw output available through local paths or an approved artifact store; no hosted store is required.
Artifact checks should compare recorded content digests where available. A digest binds content but does not prove test adequacy.
Human review still assesses whether the checks prove the intended behavior.

Baseline failures stay visible with their owners and acceptance limits. Do not convert them to passes or hide them through mode changes.
Use [repository readiness](repository-readiness.md) to select correction examples, boundary checks and complex transition tests.

## This repository's checks

```bash
uv sync --locked
uv run --locked python scripts/check.py full
uv run --locked python scripts/check.py fast
```

Full runs Python and Node unit tests, both CLI integration suites and shell syntax checks.
Fast runs both unit suites and shell syntax checks; it names both omitted integration suites.
The summary reports the actual mode and excluded integration layer.
Coverage.py measures `runner_setup.py`, the image-install helper and the Node-result parser.
Node's native coverage measures `lib/*.mjs`. CLI entry points have separate behavior tests.
The Python combined coverage floor is 85%. Node floors are 85% lines/functions and 80% branches.
These helper thresholds are not rules for future product repositories.
An empty Node integration selection, TODO-only results or incomplete pass counts cannot report success.

There is no app UI here. Functional UI is **N/A: no UI in this repository**.
No image build, Multica login, live service, scan or product UI test runs during these checks.
The runner image, native plugin delivery and real product regressions need their own later acceptance.

Reports stay under `reports/<mode>/`: raw local logs, coverage JSON/XML and `summary.json`.
Use sanitized summaries in PR bodies. Do not upload private paths, tokens, account state or production evidence.
