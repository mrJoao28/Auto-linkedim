import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

from carreira.storage import Store


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.temp.name) / "data.sqlite3")

    def tearDown(self):
        self.temp.cleanup()

    def test_snapshot_does_not_follow_profile_updates(self):
        self.store.set_profile({"name": "Antigo", "entries": []})
        snapshot = self.store.put("resumes", {"job_id": "job", "profile": self.store.profile()})
        self.store.set_profile({"name": "Novo", "entries": []})
        self.assertEqual(self.store.get("resumes", snapshot["id"])["profile"]["name"], "Antigo")

    def test_resume_snapshot_cannot_be_overwritten(self):
        item = self.store.put("resumes", {"job_id": "job"})
        with self.assertRaises(sqlite3.IntegrityError):
            self.store.put("resumes", item)

    def test_backup_round_trip_includes_original_files(self):
        self.store.put("attachments", {"job_id": "job", "filename": "arquivo.pdf", "content": "JVBERi0="})
        backup = json.loads(json.dumps(self.store.export()))
        self.store.restore(backup)
        self.assertEqual(self.store.all("attachments")[0]["content"], "JVBERi0=")
        self.assertNotIn("content", self.store.export(include_files=False)["attachments"][0])

    def test_failed_restore_rolls_back_every_table(self):
        original = self.store.put("jobs", {"title": "Original"})
        backup = self.store.export()
        backup["jobs"] = [{"id": "same", "title": "First"}, {"id": "same", "title": "Second"}]
        with self.assertRaises(sqlite3.IntegrityError):
            self.store.restore(backup)
        self.assertEqual(self.store.all("jobs")[0]["id"], original["id"])

    def test_publishing_is_claimed_only_once(self):
        post = self.store.put("posts", {"status": "rascunho", "text": "Texto"})
        self.store.change_post(post["id"], ("rascunho",), {"status": "verificar"})
        with self.assertRaises(ValueError):
            self.store.change_post(post["id"], ("rascunho",), {"status": "verificar"})
