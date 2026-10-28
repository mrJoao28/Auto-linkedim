import base64
import http.client
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import tempfile
import threading
import unittest

from app import make_handler
from carreira.integrations import Integrations
from carreira.storage import Store


class APITests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.temp.name)/"data"/"db.sqlite3")
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), http.client.HTTPConnection)
        self.port = self.server.server_address[1]
        self.origin = f"http://127.0.0.1:{self.port}"
        self.server.RequestHandlerClass = make_handler(self.store, Integrations(self.origin), self.origin)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        _, data, _ = self.request("GET", "/api/state")
        self.csrf = data["csrf"]

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def request(self, method, path, payload=None, headers=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.port)
        body = json.dumps(payload) if payload is not None else None
        req_headers = {"Content-Type": "application/json", "Origin": self.origin, "X-CSRF-Token": getattr(self, "csrf", "")}
        req_headers.update(headers or {})
        connection.request(method, path, body, req_headers)
        response = connection.getresponse()
        raw = response.read()
        data = json.loads(raw) if response.getheader("Content-Type", "").startswith("application/json") else raw
        status, response_headers = response.status, dict(response.headers)
        connection.close()
        return status, data, response_headers

    def profile_and_job(self):
        profile = {"name": "Pessoa Teste", "summary": "Resumo original", "entries": [{"id": "project", "type": "project", "title": "API de tarefas", "description": "Projeto pessoal", "skills": ["Python"], "confirmed": True}]}
        self.request("POST", "/api/profile", profile)
        _, job, _ = self.request("POST", "/api/jobs", {"title": "Dev Python", "description": "Python obrigatório", "requirements": [{"label": "Python", "weight": 5}]})
        return profile, job

    def test_foreign_origin_and_missing_csrf_are_rejected(self):
        for headers in ({"Origin": "https://evil.example"}, {"X-CSRF-Token": ""}):
            status, _, _ = self.request("POST", "/api/profile", {"name": "Bad"}, headers)
            self.assertEqual(status, 403)

    def test_dns_rebinding_host_is_rejected(self):
        status, _, _ = self.request("GET", "/api/state", headers={"Host": "evil.example"})
        self.assertEqual(status, 403)

    def test_create_analyze_generate_edit_preserves_snapshot(self):
        profile, job = self.profile_and_job()
        status, snapshot, _ = self.request("POST", "/api/generate", {"id": job["id"]})
        self.assertEqual(status, 200)
        self.assertEqual(snapshot["assessment"]["score"], 100)
        profile["name"] = "Nome atualizado"
        self.request("POST", "/api/profile", profile)
        _, html, _ = self.request("GET", "/resume/"+snapshot["id"])
        self.assertIn(b"Pessoa Teste", html)
        self.assertNotIn(b"Nome atualizado", html)
        _, copy, _ = self.request("POST", "/api/resume-copy", {"id": snapshot["id"], "summary": "Outro resumo", "entry_ids": []})
        self.assertNotEqual(copy["id"], snapshot["id"])
        self.assertEqual(copy["resume_assessment"]["score"], 0)
        self.assertEqual(len(self.store.all("resumes")), 2)

    def test_personal_content_is_escaped_in_resume(self):
        profile, job = self.profile_and_job()
        profile["name"] = "<script>alert(1)</script>"
        self.request("POST", "/api/profile", profile)
        _, snapshot, _ = self.request("POST", "/api/generate", {"id": job["id"]})
        _, html, _ = self.request("GET", "/resume/"+snapshot["id"])
        self.assertIn(b"&lt;script&gt;", html)
        self.assertNotIn(b"<script>", html)

    def test_pdf_archive_round_trip_without_content_in_state(self):
        _, job = self.profile_and_job()
        original = b"%PDF-1.4\noriginal bytes"
        status, item, _ = self.request("POST", "/api/attach-cv", {"job_id": job["id"], "filename": "curriculo.pdf", "content": base64.b64encode(original).decode()})
        self.assertEqual(status, 200)
        _, downloaded, headers = self.request("GET", "/attachment/"+item["id"])
        self.assertEqual(downloaded, original)
        self.assertIn("attachment", headers["Content-Disposition"])
        _, state, _ = self.request("GET", "/api/state")
        self.assertNotIn("content", state["attachments"][0])

    def test_no_live_publication_without_confirmation(self):
        post = self.store.put("posts", {"status": "rascunho", "text": "Test"})
        status, _, _ = self.request("POST", "/api/publish", {"id": post["id"]})
        self.assertEqual(status, 400)
        self.assertEqual(self.store.get("posts", post["id"])["status"], "rascunho")

    def test_static_assets_are_served(self):
        for path in ("/", "/app.js", "/style.css"):
            status, data, _ = self.request("GET", path)
            self.assertEqual(status, 200)
            self.assertTrue(data)
