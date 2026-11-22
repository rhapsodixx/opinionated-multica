# ADR-0002: Build Potato tools in an image and prepare runners explicitly

## Status

Selected design, 22 November 2026. The owner approved image build and bundle preparation, with login and startup kept explicit.
The framework is Potato; the coordinator remains Multica. The existing repository URL remains in use.

## Context

The earlier scripts only prepared a bundle from an existing release. They did not install the common tools.
A repeatable npx/shell entry point must supply those tools while preserving the pinned-container runner model.

## Decision

Use one dependency-free Node CLI through npx and a Bash wrapper. Require Node 22.8+, Docker and Compose on the setup host.
Build the version-pinned Linux image, verify every tool, then stage and validate a bundle before publishing it locally.
Keep temporary bind files beside the selected output on a Docker-shared path.
Use native architecture detection with legacy builders and account for rootless Docker's UID mapping.
Keep project dependencies and browser revisions locked per repository.

Never read login tokens during setup. Do not start a VM, log in, start a runner or publish a package/image automatically.
Use a local immutable image ID during preparation. Certify and publish one image digest before fleet rollout.
Private skills/plugins/MCP configuration and actual runtime conformance remain separate acceptance work.

## Alternatives

- Install all language runtimes on the host: creates conflicts and drift outside the container model.
- Wrap only bundle preparation: leaves the tools missing.
- Publish an npm package now: requires a separate publication decision; the GitHub package form works without it.

## Consequences

The operator needs the documented host prerequisites and a running engine. Potato does not repair host package managers or VM configuration.
Downloads and compilation can take time and disk space. A successful unit suite does not certify a real image build.
The shared image must pass real build, version and extension acceptance before use by the product team.
