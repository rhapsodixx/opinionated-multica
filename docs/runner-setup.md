# Set up a Potato runner

Potato builds the shared-tool image and reuses the Python helpers to prepare a runner bundle.
Use `bash setup.sh` or the npx command in the README. Login and startup remain explicit.
Tests use fake Docker commands; private extensions and real runtime acceptance are separate work.

## Image contract

The versioned build assets are `runner/Dockerfile` and `config/toolchain.json`.
Build and certify one image before fleet rollout. See [toolchain pins and image acceptance](image-toolchain.md).
The public image does not contain private skills, plugins or credentials.

The image must provide:

- Linux, Bash, Python 3.12+, Git, jq and every tool in `config/runner-release.example.json`.
- The approved Node/Bun, Go and Python toolchains, language servers and browser OS dependencies.
- Claude Code at `/usr/local/bin/claude`, with support for the main/subagent prompt-file flags.
  Combining Multica prompt flags with their file form needs a compatible CLI (documented from 2.1.283).
- A non-root user with UID/GID 10001 and a writable `/home/runner`.
- Operator-supplied approved native plugins/skills and runtime MCP configuration, without baked-in credentials.
- Reproducible tool/plugin pins and a successful version doctor plus headless skill/hook/MCP acceptance.

For fleet use, reference the certified image by registry digest. A local build may use its immutable `sha256:` image ID.
Potato records the local ID and every exact tool version automatically.
For manual preparation, fill every tool's exact `major.minor.patch` version in a private copy of the release example.
The source of truth is the certified image/release, not the laptop's versions.
Do not copy personal HOME, private local rules or credentials into the image.

## Generate a bundle

Create the approved release file outside Git. Then run:

```bash
python3 scripts/prepare-runner.py \
  --release private/runner-release.json \
  --output bundles/worker-01 \
  --server https://multica.example.test \
  --workspace engineering \
  --token-file /secure/path/multica-token \
  --cpus 2 --memory 4g
```

The tool validates the pins and writes `compose.json`, policy, settings, launch scripts and file hashes.
It does not read the token, contact a server, pull an image or start Docker.
The one-command installer stages the bundle beside its destination, validates it, then publishes it.
A failed attempt removes its own staging files and can be retried at the same destination.
Use an output path shared with the Docker VM; on Colima this is normally under your home directory.
Compose bind sources are relative to the bundle, so literal dollar signs in a path are not interpolated.
Repeat manual preparation with identical inputs safely. If files differ, it refuses to overwrite them; use a new bundle directory.
`compose.json` uses JSON syntax accepted by Compose. Potato validates it automatically.
Manual setup can use `docker compose -f <bundle>/compose.json config --quiet` or the standalone `docker-compose` form.

Each bundle directory is a distinct Compose project with its own persistent runner HOME.
Use unique worker directory names. Never copy one runner's login state to another.
The generated service permits one daemon task at a time and has resource limits, dropped capabilities, log rotation and no published port or host Docker socket.
Increase concurrency only after the pilot measures resource peaks; keep that change in a reviewed runner release.
The VM still needs suitable network and disk capacity; the defaults are preparation values, not measured product build sizing.

## Credentials and startup, later

On the selected worker VM, create the token file with owner-only permissions, using a dedicated runner identity.
Provide the coding engine and Git host credentials through their supported login/secret process, not through this public repository.
Use repository-scoped Git writes where available. No protection endpoint is queried or required.

```bash
bash bundles/worker-01/start-runner.sh --plan
bash bundles/worker-01/start-runner.sh --apply
```

`--apply` validates Compose, sends the token through stdin to the CLI, and starts the foreground daemon under Compose supervision.
The script never puts a token in command arguments. It leaves the daemon profile and workspaces in this worker's named volume.
The image contract and actual Multica login/workspace/Claude behavior still need a real-VM acceptance test before use.

Run the doctor inside the image with this repository available:

```bash
python3 scripts/doctor-runner.py --release /path/to/approved-release.json
```

It prints expected/observed tool versions and exits nonzero when a tool is missing, fails or has the wrong version.
It does not prove plugin delivery or test quality; those need separate conformance tests.

## Lifecycle

Drain jobs before replacing an image. Back up runner identity and coordinator state privately.
Keep the previous approved release. Do not prune shared Docker state while another job runs.
Remove only owned workspaces, test services and temporary data. Never remove a named volume as an incidental update.
