import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import runner_setup as setup


def release():
    return {
        "schema": 1,
        "image": "registry.example.test/team/runner@sha256:" + "a" * 64,
        "tools": {name: "1.2.3" for name in setup.TOOL_COMMANDS},
    }


class ReleaseTests(unittest.TestCase):
    def test_release_requires_an_immutable_image_and_all_tool_pins(self):
        for change in ({"image": "runner:latest"}, {"tools": {}}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                setup.validate_release(release() | change)

    def test_valid_release_is_accepted(self):
        self.assertEqual(setup.validate_release(release()), release())

    def test_bad_schema_and_unresolved_versions_are_rejected(self):
        for document in ([], release() | {"schema": 2}):
            with self.subTest(document=document), self.assertRaises(ValueError):
                setup.validate_release(document)
        document = release()
        document["tools"]["go"] = "REPLACE_ME"
        with self.assertRaises(ValueError):
            setup.validate_release(document)

    def test_wrong_image_types_and_boolean_schema_are_rejected_cleanly(self):
        for document in (release() | {"image": None}, release() | {"image": 42},
                         release() | {"schema": True}):
            with self.subTest(document=document), self.assertRaises(ValueError):
                setup.validate_release(document)


class PreparationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def prepare(self, **kwargs):
        return setup.prepare(
            release(), self.root / "bundle", "https://multica.example.test", "engineering",
            self.root / "private" / "multica-token", **kwargs,
        )

    def test_bundle_has_shared_policy_scoped_storage_and_no_host_socket(self):
        target = self.prepare()
        compose = json.loads((target / "compose.json").read_text())
        runner = compose["services"]["runner"]
        self.assertEqual(runner["image"], release()["image"])
        self.assertEqual(runner["user"], "10001:10001")
        self.assertEqual(runner["cap_drop"], ["ALL"])
        self.assertEqual(runner["mem_limit"], "4g")
        self.assertEqual(runner["environment"]["MULTICA_DAEMON_MAX_CONCURRENT_TASKS"], "1")
        self.assertNotIn("docker.sock", json.dumps(compose))
        self.assertNotIn("ports", runner)
        self.assertTrue((target / "multica-claude.local.md").is_file())
        self.assertIn("--no-auto-update", (target / "entrypoint.sh").read_text())
        self.assertFalse((self.root / "private" / "multica-token").exists())
        settings = json.loads((target / "claude-settings.json").read_text())
        self.assertIn("**/CLAUDE.local.md", settings["claudeMdExcludes"])

    def test_identical_preparation_is_idempotent(self):
        self.prepare()
        self.assertEqual(self.prepare(), (self.root / "bundle").resolve())

    def test_existing_files_are_not_overwritten_or_partially_updated(self):
        target = self.prepare()
        (target / "multica-claude.local.md").write_text("operator change")
        before = (target / "compose.json").read_bytes()
        with self.assertRaises(FileExistsError):
            self.prepare(cpus=1)
        self.assertEqual((target / "compose.json").read_bytes(), before)
        self.assertEqual((target / "multica-claude.local.md").read_text(), "operator change")

    def test_invalid_remote_server_workspace_and_limits_fail_before_writes(self):
        for server, workspace, kwargs in (
            ("http://public.example.test", "engineering", {}),
            ("https://user:password@example.test", "engineering", {}),
            ("https://example.test/path", "engineering", {}),
            ("https://example.test", "bad\nworkspace", {}),
            ("https://example.test", "engineering", {"cpus": 0}),
            ("https://example.test", "engineering", {"memory": "unlimited"}),
        ):
            with self.subTest(server=server, workspace=workspace, kwargs=kwargs):
                with self.assertRaises(ValueError):
                    setup.prepare(release(), self.root / "absent", server, workspace,
                                  self.root / "token", **kwargs)
                self.assertFalse((self.root / "absent").exists())

    def test_loopback_http_is_allowed_for_development(self):
        setup.prepare(release(), self.root / "local", "http://127.0.0.1:8080", "dev",
                      self.root / "token")

    def test_output_symlink_is_rejected(self):
        (self.root / "real").mkdir()
        (self.root / "bundle").symlink_to(self.root / "real", target_is_directory=True)
        with self.assertRaises(ValueError):
            self.prepare()


class DoctorTests(unittest.TestCase):
    def test_exact_version_matches_not_just_prefixes(self):
        with patch.object(setup.subprocess, "run") as run:
            run.return_value.returncode = 0
            run.return_value.stdout = "tool 1.2.30"
            run.return_value.stderr = ""
            results = setup.doctor(release())
        self.assertTrue(all(not row["ok"] for row in results))

    def test_matching_tools_pass(self):
        with patch.object(setup.subprocess, "run") as run:
            run.return_value.returncode = 0
            run.side_effect = lambda command, **kwargs: setup.subprocess.CompletedProcess(
                command, 0, "Go: go9.9.9\nScanner: govulncheck@v1.2.3\n"
                if command[0] == "govulncheck" else "tool v1.2.3", "")
            run.return_value.stderr = ""
            results = setup.doctor(release())
        self.assertTrue(all(row["ok"] for row in results))

    def test_missing_failed_and_timed_out_tools_are_reported(self):
        for error in (FileNotFoundError(), setup.subprocess.TimeoutExpired("tool", 10)):
            with self.subTest(error=error), patch.object(setup.subprocess, "run", side_effect=error):
                self.assertTrue(all(not row["ok"] for row in setup.doctor(release())))
        with patch.object(setup.subprocess, "run") as run:
            run.return_value.returncode = 1
            run.return_value.stdout = "tool 1.2.3"
            run.return_value.stderr = ""
            self.assertTrue(all(not row["ok"] for row in setup.doctor(release())))

    def test_dependency_version_and_prerelease_do_not_satisfy_pin(self):
        for output in ("tool 9.9.9 built with dependency 1.2.3", "tool 1.2.3-beta.1",
                       "tool 1.2.3+custom", "no version"):
            with self.subTest(output=output), patch.object(setup.subprocess, "run") as run:
                run.return_value.returncode = 0
                run.return_value.stdout = output
                run.return_value.stderr = ""
                self.assertTrue(all(not row["ok"] for row in setup.doctor(release())))
