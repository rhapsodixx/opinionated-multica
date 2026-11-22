#!/usr/bin/env python3
"""Install the reviewed Linux toolchain during docker build, never at startup."""

import argparse
import hashlib
import json
import os
import platform
from pathlib import Path
import shutil
import stat
import subprocess
import tarfile
import tempfile
from urllib.request import Request, urlopen
import zipfile


def download(source, destination):
    """Publish a download only after its pinned SHA-256 matches."""
    request = Request(source["url"], headers={"User-Agent": "potato-runner-build/0.1"})
    digest = hashlib.sha256()
    partial = destination.with_suffix(destination.suffix + ".partial")
    try:
        with urlopen(request, timeout=120) as response, partial.open("xb") as output:
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
                digest.update(chunk)
        if digest.hexdigest() != source["sha256"]:
            raise ValueError(f"SHA-256 mismatch for {source['url']}")
        partial.replace(destination)
    finally:
        partial.unlink(missing_ok=True)
    return destination


def binary(archive, name, destination):
    """Extract only the named regular binary, without trusting archive paths."""
    if zipfile.is_zipfile(archive):
        with zipfile.ZipFile(archive) as package:
            matches = [item for item in package.infolist()
                       if not item.is_dir() and Path(item.filename).name == name
                       and stat.S_IFMT(item.external_attr >> 16) in {0, stat.S_IFREG}]
            if len(matches) != 1:
                raise ValueError(f"expected one {name} in {archive}")
            with package.open(matches[0]) as source, destination.open("wb") as output:
                shutil.copyfileobj(source, output)
    else:
        with tarfile.open(archive) as package:
            matches = [item for item in package.getmembers()
                       if item.isfile() and Path(item.name).name == name]
            if len(matches) != 1:
                raise ValueError(f"expected one {name} in {archive}")
            with package.extractfile(matches[0]) as source, destination.open("wb") as output:
                shutil.copyfileobj(source, output)
    destination.chmod(0o755)


def tree(archive, destination):
    destination.mkdir()
    with tarfile.open(archive) as package:
        package.extractall(destination, filter="data")
    children = list(destination.iterdir())
    if len(children) != 1 or not children[0].is_dir():
        raise ValueError(f"expected one root directory in {archive}")
    return children[0]


def install(config, architecture, *, prefix=Path("/usr/local")):
    if architecture not in config["platforms"]:
        raise ValueError("supported image architectures: amd64, arm64")
    sources = config["platforms"][architecture]
    prefix = Path(prefix)
    (prefix / "bin").mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="potato-image-") as temporary:
        work = Path(temporary)
        # Verify the vendor manifests too. The pinned binary hashes must agree.
        manifest = json.loads(download(config["manifests"]["claude"], work / "claude.json").read_text())
        claude_arch = "linux-x64" if architecture == "amd64" else "linux-arm64"
        if (manifest["version"] != config["tools"]["claude"]
                or manifest["platforms"][claude_arch]["checksum"] != sources["claude"]["sha256"]):
            raise ValueError("Claude pin disagrees with its official manifest")
        multica_sums = download(config["manifests"]["multica"], work / "multica-sums.txt").read_text()
        checksums = {line.split()[1].lstrip("*"): line.split()[0]
                     for line in multica_sums.splitlines() if len(line.split()) == 2}
        multica_filename = sources["multica"]["url"].rsplit("/", 1)[1]
        if checksums.get(multica_filename) != sources["multica"]["sha256"]:
            raise ValueError("Multica pin disagrees with its official checksums")
        for name, source in sources.items():
            print(f"Installing {name} {config['tools'][name]} ({architecture})", flush=True)
            archive = download(source, work / name)
            if name == "node":
                shutil.copytree(tree(archive, work / "node-tree"), prefix,
                                dirs_exist_ok=True, symlinks=True)
            elif name == "go":
                shutil.copytree(tree(archive, work / "go-tree"), prefix / "go", symlinks=True)
            elif name in {"claude", "jq"}:
                shutil.copyfile(archive, prefix / "bin" / name)
                (prefix / "bin" / name).chmod(0o755)
            elif name == "uv":
                for executable in ["uv", "uvx"]:
                    binary(archive, executable, prefix / "bin" / executable)
            else:
                binary(archive, name, prefix / "bin" / name)
        (prefix / "bin" / "bunx").symlink_to("bun")
        git_source = tree(download(config["sources"]["git"], work / "git.tar.xz"), work / "git-tree")
        options = ["prefix=" + str(prefix), "NO_TCLTK=YesPlease", "NO_GETTEXT=YesPlease"]
        subprocess.run(["make", f"-j{min(os.cpu_count() or 2, 4)}", *options, "all"], cwd=git_source, check=True)
        subprocess.run(["make", *options, "install"], cwd=git_source, check=True)
        environment = dict(os.environ, GOBIN=str(prefix / "bin"), GOTOOLCHAIN="local",
                           GOPROXY="https://proxy.golang.org", GOSUMDB="sum.golang.org",
                           CGO_ENABLED="0", GOFLAGS="-trimpath")
        for module in config["go_modules"].values():
            subprocess.run([str(prefix / "go/bin/go"), "install",
                            module["package"] + "@" + module["version"]], env=environment, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True, type=Path)
    parser.add_argument("--arch", default="", choices=["amd64", "arm64", ""])
    args = parser.parse_args()
    architecture = args.arch or {"x86_64": "amd64", "aarch64": "arm64", "arm64": "arm64"}.get(platform.machine(), "unsupported")
    install(json.loads(args.config.read_text()), architecture)


if __name__ == "__main__":
    main()
