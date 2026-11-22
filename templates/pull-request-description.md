<!-- Runner template. Remove these comments and all placeholders before publication.
Use tiptip-all:pr-description for the structure and tiptip-all:plain-english for the prose.
Read the actual diff, approved plan and current test output. Do not invent results or references.
Title: type(scope): short description. Add a known Jira key only when applicable. Keep it under 72 characters.
Remove sections that do not apply. Keep Local Verification and How to Review on every code PR.
-->

## Reference

- Work: <issue or ticket link>
- Intent and approved plan: <links>
- ADR: <link, when required by the workflow>

## What's New

<State the user-visible result in one or two short sentences. Describe the previous and new behavior.>

## Why

<Explain the problem and why this change solves it.>

## Changes

- <Describe one meaningful change and its purpose. Do not repeat the file list.>

## Impact Areas

- <List the affected API, UI, data, configuration or documentation. Remove areas that do not change.>

## Local Verification

- Tested commit: `<full candidate SHA>`
- Runner release: `<image digest and policy revision>`
- Test run: `<YYYY-MM-DD HH:MM WIB>`
- Mode: `<full | fast>`
- Mode reason: <why this scope selects this mode>
- Gate: `<approved profile; exit status>`

| Check | Command | Result | Evidence |
| --- | --- | --- | --- |
| <lint, types, unit, integration, browser, migration or security check> | `<actual command>` | <actual result and test counts> | <output below, uploaded image, or accessible report link> |

<details>
<summary>Local test output</summary>

```text
<Paste the relevant output from this run. Include actual counts and failures/skips. Mask secrets and personal data.>
```

</details>

## Coverage by Test Layer

| Layer | Coverage | Results | Gaps or exclusions |
| --- | --- | --- | --- |
| Unit | <measured line % and branch %; source scope> | <passed/failed/skipped> | <uncovered changed behavior> |
| Integration/API | <completed/required scenarios> | <passed/failed/skipped> | <missing contracts/services> |
| Component/non-functional UI | <named checks completed/selected> | <actual results> | <limits; not functional regression> |
| Functional UI | <completed/required journeys and viewport/theme/role cases> | <actual results> | <not run in fast mode, or justified N/A> |

Do not combine code and scenario coverage into one percentage.

**Not run:** <None, or name each check and why it did not run. A required check that did not run blocks publication.>

### Browser Verification

<!-- Keep for changes with an applicable UI journey. Otherwise state justified N/A or an approved fast-mode omission. -->

- Playwright command and locked version: `<actual command; version>`
- Application and fixtures: <test environment, readiness and synthetic data>
- Matrix: <browser/version, viewport, role, theme and relevant states>
- Scenarios: <completed/required; passed, failed, skipped and retry/flaky counts>
- Evidence: <accessible report, screenshots and supported failure traces from this tested SHA>
- Limits: <gaps, exclusions or approved alternative verification>

An exploratory MCP session or screenshots alone do not replace the automated test result.

## Screenshots / Recordings

<!-- Keep this section for visual changes. Capture synthetic data after the page settles.
Pass these image files to the supported gh --attach option. It replaces the paths with uploaded URLs.
Remove a before image if it is not applicable. Do not invent a before state.
-->

| Before | After |
| --- | --- |
| ![Previous behavior](./evidence/before.png) | ![New behavior](./evidence/after.png) |

<Name the tested viewport, theme, role and relevant state.>

## How to Review

1. <Name the behavior or design decision to inspect first.>
2. <Name the regression test, contract or screenshot that proves the result.>

## Risk and Rollback

<State the affected behavior and how to reverse the change. Name any data or migration limits.>

## Checklist

- [ ] The required local checks passed on the tested commit.
- [ ] The tests cover the changed behavior.
- [ ] The description and evidence match the current PR head.
- [ ] The diff and evidence contain no secrets or personal data.
- [ ] The required documentation and ADR are included.
- [ ] A human has reviewed the change and approved the merge.

<!-- The publisher may check only facts proved by current evidence.
The human-review item stays unchecked until an actual human review occurs.
Do not paste Plain English rewrite statistics or model commentary into the PR.
-->
