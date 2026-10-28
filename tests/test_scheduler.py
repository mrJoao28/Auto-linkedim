from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock

from carreira.scheduler import Scheduler, publish_post
from carreira.storage import Store


class SchedulerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.temp.name)/"db.sqlite3")
        self.integrations = Mock()
        self.integrations.status.return_value = {"linkedin": {"connected": True}}
        self.integrations.publish.return_value = {"urn": "urn:test", "url": "https://example.test/post"}
        self.scheduler = Scheduler(self.store, self.integrations)

    def tearDown(self):
        self.temp.cleanup()

    def test_due_post_publishes_exactly_once_across_ticks(self):
        self.store.put("posts", {"status": "agendado", "text": "Test", "scheduled_at": (datetime.now(timezone.utc)-timedelta(seconds=1)).isoformat()})
        self.scheduler.tick()
        self.scheduler.tick()
        self.integrations.publish.assert_called_once()
        self.assertEqual(self.store.all("posts")[0]["status"], "publicado")

    def test_old_schedule_returns_to_review(self):
        self.store.put("posts", {"status": "agendado", "text": "Test", "scheduled_at": (datetime.now(timezone.utc)-timedelta(hours=2)).isoformat()})
        self.scheduler.tick()
        self.integrations.publish.assert_not_called()
        self.assertEqual(self.store.all("posts")[0]["status"], "rascunho")

    def test_ambiguous_network_failure_cannot_retry_automatically(self):
        post = self.store.put("posts", {"status": "rascunho", "text": "Test"})
        self.integrations.publish.side_effect = ValueError("Falha de comunicação")
        with self.assertRaises(ValueError):
            publish_post(self.store, self.integrations, post["id"])
        self.scheduler.tick()
        self.assertEqual(self.store.get("posts", post["id"])["status"], "verificar")
        self.integrations.publish.assert_called_once()
