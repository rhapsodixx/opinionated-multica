"""Prepare local runner configuration. Never install tools or start services here."""

import hashlib
import json
import math
import re
import subprocess
from pathlib import Path
from urllib.parse import urlsplit

ASSETS = Path(__file__).parent / "runner"
TOOL_COMMANDS = {
    "claude": ["claude", "--version"],
    "multica": ["multica", "--version"],
    "node": ["node", "--version"],
    "bun": ["bun", "--version"],
    "go": ["go", "version"],
    "python": ["python3", "--version"],
    "uv": ["uv", "--version"],
    "git": ["git", "--version"],
    "gopls": ["gopls", "version"],
    "gitleaks": ["gitleaks", "version"],
    "golangci-lint": ["golangci-lint", "version"],
    "govulncheck": ["govulncheck", "-version"],
    "gh": ["gh", "--version"],
    "jq": ["jq", "--version"],
}


def validate_release(document):
    if (not isinstance(document, dict) or type(document.get("schema")) is not int
            or document["schema"] != 1):
        raise ValueError("release schema must be 1")
    image = document.get("image")
    if not isinstance(image, str) or not re.fullmatch(r"[\w./:-]+@sha256:[0-9a-f]{64}", image):
        raise ValueError("image must use an immutable @sha256 digest")
    tools = document.get("tools")
    if not isinstance(tools, dict) or set(tools) != set(TOOL_COMMANDS):
        raise ValueError("release must pin every tool listed in runner_setup.TOOL_COMMANDS")
    if any(not isinstance(v, str) or not re.fullmatch(r"\d+\.\d+\.\d+", v)
           for v in tools.values()):
        raise ValueError("every tool needs an exact major.minor.patch version")
    return document


def doctor(document):
    validate_release(document)
    results = []
    for name, command in TOOL_COMMANDS.items():
        try:
            result = subprocess.run(command, capture_output=True, text=True, timeout=15)
            output = (result.stdout + result.stderr)[:2048]
            # Most tools print their own version first. govulncheck prints Go first.
            version_output = output
            if name == "govulncheck":
                scanner = re.search(r"(?m)^Scanner:\s*govulncheck@v([^\s]+)", output)
                version_output = scanner[1] if scanner else ""
            version = re.search(r"\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?", version_output)
            ok = (result.returncode == 0 and version is not None
                  and version[0] == document["tools"][name])
            detail = output.splitlines()[0] if output.splitlines() else "no version output"
        except (OSError, subprocess.TimeoutExpired) as error:
            ok, detail = False, type(error).__name__
        results.append({"tool": name, "expected": document["tools"][name],
                        "ok": ok, "detail": detail})
    return results


def prepare(document, output, server, workspace, token_file, *, cpus=2, memory="4g"):
    validate_release(document)
    url = urlsplit(server)
    if (url.scheme not in {"http", "https"} or not url.hostname or url.username
            or url.password or url.query or url.fragment or url.path not in {"", "/"}
            or (url.scheme == "http" and url.hostname not in {"localhost", "127.0.0.1", "::1"})):
        raise ValueError("server must be an HTTPS origin, or a loopback HTTP origin")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,63}", workspace):
        raise ValueError("workspace must be a slug, not credentials or free text")
    if not isinstance(cpus, (int, float)) or not math.isfinite(cpus) or cpus <= 0:
        raise ValueError("cpus must be positive and finite")
    if not re.fullmatch(r"[1-9]\d*[mg]", memory):
        raise ValueError("memory must be a positive size such as 4096m or 4g")
    output = Path(output).absolute()
    if output.is_symlink():
        raise ValueError("output must not be a symlink")
    output = output.resolve()
    token_file = Path(token_file).resolve()
    names = ["multica-claude.local.md", "claude-settings.json", "claude-launcher.sh",
             "entrypoint.sh", "start-runner.sh"]
    files = {name: (ASSETS / name).read_bytes() for name in names}
    mounts = [{"type": "volume", "source": "runner-home", "target": "/home/runner"}]
    for name in names[:4]:
        mounts.append({"type": "bind", "source": str(output / name),
                       "target": "/etc/opinionated-multica/" + name, "read_only": True})
    service = {
        "image": document["image"], "init": True, "user": "10001:10001",
        "entrypoint": ["/bin/bash", "/etc/opinionated-multica/entrypoint.sh"],
        "environment": {"HOME": "/home/runner", "CLAUDE_CONFIG_DIR": "/home/runner/.claude",
                        "MULTICA_SERVER_URL": server.rstrip("/"),
                        "MULTICA_WORKSPACE": workspace,
                        "MULTICA_DAEMON_MAX_CONCURRENT_TASKS": "1",
                        "MULTICA_CLAUDE_PATH": "/etc/opinionated-multica/claude-launcher.sh",
                        "CLAUDE_REAL": "/usr/local/bin/claude", "DISABLE_AUTOUPDATER": "1"},
        "volumes": mounts, "cpus": cpus, "mem_limit": memory, "pids_limit": 512,
        "cap_drop": ["ALL"], "security_opt": ["no-new-privileges:true"],
        "restart": "unless-stopped",
        "logging": {"driver": "json-file", "options": {"max-size": "10m", "max-file": "3"}},
    }
    files["compose.json"] = (json.dumps({"services": {"runner": service},
                                        "volumes": {"runner-home": {}}}, indent=2) + "\n").encode()
    files["release.json"] = (json.dumps(document, indent=2) + "\n").encode()
    metadata = {"token_file": str(token_file), "files_sha256": {
        name: hashlib.sha256(content).hexdigest() for name, content in files.items()}}
    files["bundle.json"] = (json.dumps(metadata, indent=2) + "\n").encode()
    # Check every destination first. A changed operator file must never be overwritten.
    for name, content in files.items():
        path = output / name
        if path.is_symlink() or (path.exists() and (not path.is_file() or path.read_bytes() != content)):
            raise FileExistsError(f"refusing to overwrite {path}; choose a new bundle directory")
    output.mkdir(parents=True, exist_ok=True)
    for name, content in files.items():
        path = output / name
        if not path.exists():
            with path.open("xb") as file:
                file.write(content)
            path.chmod(0o755 if name.endswith(".sh") else 0o644)
    return output
