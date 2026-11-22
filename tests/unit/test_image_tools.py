import hashlib
import importlib.util
import io
import json
from pathlib import Path
import stat
import tarfile
import tempfile
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("image_tools", ROOT / "runner/install-image-tools.py")
image_tools = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(image_tools)


class ImageToolTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)

    def archive(self, entries):
        path = self.root / "tools.tar.gz"
        with tarfile.open(path, "w:gz") as package:
            for name, content, kind in entries:
                entry = tarfile.TarInfo(name)
                if kind == "link":
                    entry.type = tarfile.SYMTYPE
                    entry.linkname = content
                    package.addfile(entry)
                else:
                    entry.size = len(content)
                    package.addfile(entry, io.BytesIO(content))
        return path

    def test_download_publishes_matching_bytes(self):
        content = b"pinned executable"
        source = {"url": "https://downloads.example.test/tool", "sha256": hashlib.sha256(content).hexdigest()}
        destination = self.root / "tool"
        with patch.object(image_tools, "urlopen", return_value=io.BytesIO(content)) as request:
            self.assertEqual(image_tools.download(source, destination), destination)
        self.assertEqual(destination.read_bytes(), content)
        self.assertFalse((self.root / "tool.partial").exists())
        self.assertEqual(request.call_args.args[0].full_url, source["url"])

    def test_changed_download_fails_and_never_publishes(self):
        destination = self.root / "tool"
        source = {"url": "https://downloads.example.test/tool", "sha256": "0" * 64}
        with patch.object(image_tools, "urlopen", return_value=io.BytesIO(b"changed")):
            with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
                image_tools.download(source, destination)
        self.assertEqual(list(self.root.iterdir()), [])

    def test_failed_transfer_removes_incomplete_download(self):
        response = io.BytesIO(b"partial")
        with patch.object(image_tools, "urlopen", return_value=response), \
                patch.object(response, "read", side_effect=OSError("connection lost")):
            with self.assertRaisesRegex(OSError, "connection lost"):
                image_tools.download({"url": "https://downloads.example.test/tool", "sha256": "0" * 64},
                                     self.root / "tool")
        self.assertEqual(list(self.root.iterdir()), [])

    def test_tar_installs_only_regular_named_binary_with_executable_mode(self):
        package = self.archive([("release/bun", b"binary", "file"),
                                ("../outside", b"ignored", "file"),
                                ("link/bun", "../../outside", "link")])
        destination = self.root / "installed"
        image_tools.binary(package, "bun", destination)
        self.assertEqual(destination.read_bytes(), b"binary")
        self.assertEqual(stat.S_IMODE(destination.stat().st_mode), 0o755)
        self.assertFalse((self.root.parent / "outside").exists())

    def test_missing_and_ambiguous_tar_binaries_are_rejected(self):
        for entries in [[], [("one/bun", b"one", "file"), ("two/bun", b"two", "file")]]:
            with self.subTest(entries=entries):
                package = self.archive(entries)
                with self.assertRaisesRegex(ValueError, "expected one bun"):
                    image_tools.binary(package, "bun", self.root / "installed")
                self.assertFalse((self.root / "installed").exists())

    def test_zip_installs_one_regular_binary_without_extracting_paths(self):
        package = self.root / "bun.zip"
        with zipfile.ZipFile(package, "w") as archive:
            archive.writestr("release/bun", b"binary")
            archive.writestr("../outside", b"ignored")
        image_tools.binary(package, "bun", self.root / "installed")
        self.assertEqual((self.root / "installed").read_bytes(), b"binary")

    def test_zip_symbolic_link_is_not_a_regular_binary(self):
        package = self.root / "bun.zip"
        with zipfile.ZipFile(package, "w") as archive:
            entry = zipfile.ZipInfo("release/bun")
            entry.create_system = 3
            entry.external_attr = (stat.S_IFLNK | 0o777) << 16
            archive.writestr(entry, "../../outside")
        with self.assertRaisesRegex(ValueError, "expected one bun"):
            image_tools.binary(package, "bun", self.root / "installed")
        self.assertFalse((self.root / "installed").exists())

    def test_tree_rejects_traversal_and_outside_symbolic_links(self):
        for entries in [[("../escaped", b"bad", "file")],
                        [("root/escape", "../../escaped", "link")]]:
            with self.subTest(entries=entries):
                package = self.archive(entries)
                with tempfile.TemporaryDirectory(dir=self.root) as directory:
                    with self.assertRaises(tarfile.FilterError):
                        image_tools.tree(package, Path(directory) / "extracted")
                self.assertFalse((self.root / "escaped").exists())

    def test_tree_requires_one_root_directory(self):
        for entries in [[("binary", b"data", "file")],
                        [("one/file", b"one", "file"), ("two/file", b"two", "file")]]:
            with self.subTest(entries=entries), tempfile.TemporaryDirectory(dir=self.root) as directory:
                package = self.archive(entries)
                with self.assertRaisesRegex(ValueError, "expected one root directory"):
                    image_tools.tree(package, Path(directory) / "extracted")

    def test_unsupported_architecture_fails_before_network_or_writes(self):
        with patch.object(image_tools, "download") as download, \
                patch.object(image_tools.tempfile, "TemporaryDirectory") as temporary:
            with self.assertRaisesRegex(ValueError, "supported image architectures"):
                image_tools.install({"platforms": {"amd64": {}, "arm64": {}}}, "s390x")
        download.assert_not_called()
        temporary.assert_not_called()

    def test_catalog_matches_the_runner_contract_and_build_base(self):
        import runner_setup
        catalog = json.loads((ROOT / "config/toolchain.json").read_text())
        self.assertEqual(set(catalog["tools"]), set(runner_setup.TOOL_COMMANDS))
        self.assertEqual(set(catalog["platforms"]), {"amd64", "arm64"})
        self.assertIn(catalog["base_image"], (ROOT / "runner/Dockerfile").read_text())
        self.assertIn(catalog["debian_snapshot"], (ROOT / "runner/Dockerfile").read_text())
        for version in catalog["tools"].values():
            self.assertRegex(version, r"^\d+\.\d+\.\d+$")

    def install_fixture(self):
        def tar(entries):
            buffer = io.BytesIO()
            with tarfile.open(fileobj=buffer, mode="w:gz") as package:
                for name, content in entries:
                    entry = tarfile.TarInfo(name)
                    entry.size = len(content)
                    package.addfile(entry, io.BytesIO(content))
            return buffer.getvalue()
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as package:
            package.writestr("bun-release/bun", b"bun executable")
        sources = {
            "node": {"fixture": tar([("node-release/bin/node", b"node executable"),
                                     ("node-release/lib/node_modules/npm/package.json", b"{}")])},
            "go": {"fixture": tar([("go/bin/go", b"go executable")])},
            "bun": {"fixture": buffer.getvalue()},
            "uv": {"fixture": tar([("uv-release/uv", b"uv executable"),
                                   ("uv-release/uvx", b"uvx executable")])},
            "claude": {"fixture": b"native claude", "sha256": "c" * 64},
            "jq": {"fixture": b"jq executable"},
            "multica": {"fixture": tar([("multica", b"multica executable")]),
                        "url": "https://downloads.example.test/multica.tar.gz", "sha256": "d" * 64},
        }
        for name in ["gitleaks", "golangci-lint", "gh"]:
            sources[name] = {"fixture": tar([("release/" + name, name.encode())])}
        catalog = {
            "platforms": {"amd64": sources}, "tools": {name: "1.2.3" for name in sources},
            "sources": {"git": {"fixture": tar([("git/Makefile", b"source")])}},
            "manifests": {
                "claude": {"fixture": json.dumps({"version": "1.2.3", "platforms": {
                    "linux-x64": {"checksum": "c" * 64}}}).encode()},
                "multica": {"fixture": ("d" * 64 + "  multica.tar.gz\n").encode()},
            },
            "go_modules": {
                "gopls": {"package": "golang.org/x/tools/gopls", "version": "v0.24.0"},
                "govulncheck": {"package": "golang.org/x/vuln/cmd/govulncheck", "version": "v1.10.0"},
            },
        }
        def fixture_download(source, destination):
            destination.write_bytes(source["fixture"])
            return destination
        return catalog, fixture_download

    def test_install_places_runtimes_and_commands_in_an_isolated_prefix(self):
        catalog, fixture_download = self.install_fixture()
        prefix = self.root / "prefix"
        with patch.object(image_tools, "download", side_effect=fixture_download), \
                patch.object(image_tools.subprocess, "run") as run:
            image_tools.install(catalog, "amd64", prefix=prefix)
        for name in ["node", "bun", "bunx", "uv", "uvx", "claude", "multica", "jq", "gitleaks", "golangci-lint", "gh"]:
            self.assertTrue((prefix / "bin" / name).is_file(), name)
        self.assertEqual((prefix / "bin" / "bunx").read_bytes(), b"bun executable")
        self.assertEqual((prefix / "go/bin/go").read_bytes(), b"go executable")
        self.assertTrue((prefix / "lib/node_modules/npm/package.json").exists())
        calls = run.call_args_list
        self.assertEqual(len(calls), 4)
        self.assertIn("prefix=" + str(prefix), calls[0].args[0])
        self.assertEqual(calls[1].args[0][-1], "install")
        self.assertEqual(calls[2].args[0], [str(prefix / "go/bin/go"), "install", "golang.org/x/tools/gopls@v0.24.0"])
        self.assertEqual(calls[3].args[0][-1], "golang.org/x/vuln/cmd/govulncheck@v1.10.0")
        self.assertTrue(all(call.kwargs["check"] for call in calls))
        environment = calls[2].kwargs["env"]
        self.assertEqual(environment["GOBIN"], str(prefix / "bin"))
        self.assertEqual(environment["GOTOOLCHAIN"], "local")
        self.assertEqual(environment["GOSUMDB"], "sum.golang.org")

    def test_disagreeing_vendor_manifests_abort_before_install_or_compile(self):
        for vendor in ["claude", "multica"]:
            with self.subTest(vendor=vendor):
                catalog, fixture_download = self.install_fixture()
                if vendor == "claude":
                    catalog["platforms"]["amd64"]["claude"]["sha256"] = "e" * 64
                else:
                    catalog["platforms"]["amd64"]["multica"]["sha256"] = "e" * 64
                with patch.object(image_tools, "download", side_effect=fixture_download), \
                        patch.object(image_tools.subprocess, "run") as run:
                    with self.assertRaisesRegex(ValueError, "pin disagrees"):
                        image_tools.install(catalog, "amd64", prefix=self.root / vendor)
                run.assert_not_called()
                self.assertEqual(list((self.root / vendor / "bin").iterdir()), [])

    def test_command_line_loads_requested_catalog_and_architecture(self):
        path = self.root / "toolchain.json"
        path.write_text(json.dumps({"schema": 1}))
        with patch.object(image_tools, "install") as install, \
                patch("sys.argv", ["install-image-tools.py", "--config", str(path), "--arch", "arm64"]):
            image_tools.main()
        install.assert_called_once_with({"schema": 1}, "arm64")

    def test_legacy_builder_detects_native_architecture_when_targetarch_is_empty(self):
        path = self.root / "catalog.json"
        path.write_text('{}')
        for machine, expected in (("x86_64", "amd64"), ("aarch64", "arm64")):
            with self.subTest(machine=machine), patch.object(image_tools, "install") as install, \
                    patch("platform.machine", return_value=machine), \
                    patch("sys.argv", ["install-image-tools.py", "--config", str(path), "--arch", ""]):
                image_tools.main()
                install.assert_called_once_with({}, expected)
