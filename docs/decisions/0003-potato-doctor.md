# ADR-0003: Inspect readiness without changing the environment

## Status

Selected design, 23 November 2026. The owner approved the proposed doctor command in chat.

## Context

The installer checks Docker and exact image tool versions. It does not inspect a product repository or expose one readiness report.
The pilot needs repeatable diagnostics across Colima, Linux worker machines and multiple repository languages.

## Decision

Add `potato doctor` to the existing dependency-free Node CLI.
Share daemon/Compose discovery with setup and reuse the existing Python image version doctor for explicit probes.
Inspect approved repository profiles instead of guessing full/fast commands or running package scripts automatically.
Keep status, remedies and exit semantics identical in text and JSON output.
Distinguish configuration readiness from unperformed operational checks.
Required failed or unchecked checks prevent an overall ready result.
Leave native extension, authentication and connectivity acceptance unchecked until real runtime checks exist.

Default inspection is read-only. Probes require `--probe` and use only an approved checkout and existing image.
Ship the CLI inside the image. Use `--repo-only` there so repository diagnostics require no Docker socket.
Do not install, repair hooks, start services, log in, read tokens or call a model automatically.
Keep actual code verification in the repository's local gate and existing evidence workflow.

## Alternatives

- Infer commands from scripts and call them: cannot establish approved scope and may execute untrusted lifecycle code.
- Build a second image doctor in JavaScript: duplicates the tool contract and risks drift.
- Treat config presence as operational proof: hides missing browser, credential or native extension acceptance.

## Consequences

Product repositories need a reviewed profile. Declaration checks do not prove commands, lock resolution or hook behavior.
Explicit browser probes execute installed dependencies and must run inside the intended isolated runtime.
Bundle reports remain incomplete while native runtime acceptance is unavailable.
The setup CLI remains independently usable for preparation and never claims that preparation certifies a deployed runner.
