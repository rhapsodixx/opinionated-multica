# Intent: Potato doctor

The owner approved a doctor command after reviewing the machine, runner and repository checking proposal.
This task implements that approved scope. It does not deploy Multica or publish the npm package.

## Acceptance

- Expose machine, prepared-bundle and repository diagnostics through text and JSON output.
- Reuse existing Docker/Compose and image version checks; inspect approved repository profiles without running their commands.
- Detect missing dependencies, configuration drift, unsafe paths, insufficient declared capacity and failed explicit browser probes.
- Keep required unchecked results visible and block an overall ready result.
- Add explicit image/browser probes with bounded execution. Never install, log in or start services automatically.
- Verify rejection paths, no default filesystem writes, package contents and the complete local test profile with coverage.

## Plan and review

Write failing command and behavior tests, implement diagnostics, integrate setup checks, document the contract, then run the full profile.
Review readiness claims, command execution boundaries and the final diff before PR publication.
Human merge review remains required. The [ADR](../decisions/0003-potato-doctor.md) records the design and limits.
