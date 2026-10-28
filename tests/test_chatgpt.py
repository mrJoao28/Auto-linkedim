import io
import json
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch
import urllib.parse

from carreira.chatgpt import ChatGPTClient, PLAN_SCOPE, stream_text


class ChatGPTTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.client = ChatGPTClient(self.temp.name, "http://127.0.0.1:8765")

    def tearDown(self):
        self.temp.cleanup()

    def test_authorization_uses_pkce_and_stable_host(self):
        first, _ = self.client.begin()
        second, _ = self.client.begin()
        one = urllib.parse.parse_qs(urllib.parse.urlparse(first).query)
        two = urllib.parse.parse_qs(urllib.parse.urlparse(second).query)
        self.assertEqual(one["client_id"], ["dynamic_agent_client"])
        self.assertEqual(one["ext_agent_host_id"], two["ext_agent_host_id"])
        self.assertNotEqual(one["state"], two["state"])
        self.assertEqual(one["code_challenge_method"], ["S256"])
        self.assertIn(PLAN_SCOPE, one["scope"][0])

    def test_callback_rejects_mismatched_browser_without_token_exchange(self):
        url, _ = self.client.begin()
        query = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
        with patch("carreira.chatgpt.request_json") as request:
            with self.assertRaises(ValueError):
                self.client.complete({"state": query["state"], "code": ["example"]}, "wrong-browser")
            request.assert_not_called()

    def test_missing_plan_scope_never_calls_inference(self):
        self.client.registration = {"access_token": "fake", "scopes": ["openid"], "model": "example"}
        with patch("urllib.request.urlopen") as request:
            with self.assertRaises(ValueError):
                self.client.generate("Prompt")
            request.assert_not_called()

    def test_status_never_exposes_credentials(self):
        self.client.registration = {"access_token": "secret", "refresh_token": "other", "scopes": [PLAN_SCOPE]}
        self.assertNotIn("secret", json.dumps(self.client.status()))
        self.assertNotIn("refresh_token", json.dumps(self.client.status()))

    def test_stream_requires_completed_event(self):
        with self.assertRaises(ValueError):
            stream_text(io.BytesIO(b'data: {"type":"response.output_text.delta","delta":"partial"}\n\n'))

    def test_successful_stream_reassembles_text(self):
        raw = b'data: {"type":"response.output_text.delta","delta":"Hello"}\n\ndata: {"type":"response.completed"}\n\n'
        self.assertEqual(stream_text(io.BytesIO(raw)), "Hello")

    def test_late_usage_error_discards_partial_text(self):
        raw = b'data: {"type":"response.output_text.delta","delta":"partial"}\n\ndata: {"type":"response.failed","response":{"error":{"code":"subscription_sharing_usage_limit_exceeded"}}}\n\n'
        with self.assertRaisesRegex(ValueError, "limite"):
            stream_text(io.BytesIO(raw))

    def test_identity_is_checked_cryptographically(self):
        import jwt
        from cryptography.hazmat.primitives.asymmetric import rsa
        from types import SimpleNamespace
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        claims = {"iss": "https://auth.openai.com", "aud": "oaiapp_test", "sub": "test", "iat": time.time(), "exp": time.time()+60, "nonce": "expected"}
        token = jwt.encode(claims, key, algorithm="RS256")
        with patch("jwt.PyJWKClient") as jwks:
            jwks.return_value.get_signing_key_from_jwt.return_value = SimpleNamespace(key=key.public_key())
            self.assertEqual(self.client.validate_identity(token, "oaiapp_test", "expected")["sub"], "test")
            with self.assertRaises(ValueError):
                self.client.validate_identity(token, "oaiapp_test", "wrong-nonce")
            with self.assertRaises(ValueError):
                self.client.validate_identity(token, "wrong-audience", "expected")

    def test_refresh_replaces_rotating_credentials_atomically(self):
        self.client.registration = {"client_id": "oaiapp_test", "subject": "test", "model": "test", "access_token": "old", "refresh_token": "old-refresh", "scopes": [PLAN_SCOPE], "expires_at": 0}
        token = {"access_token": "new", "refresh_token": "new-refresh", "scope": PLAN_SCOPE, "expires_in": 3600}
        with patch("carreira.chatgpt.request_json", return_value=(token, {})):
            self.assertEqual(self.client.access_token(), "new")
        saved = json.loads(self.client.path.read_text())
        self.assertEqual(saved["refresh_token"], "new-refresh")
        self.assertEqual(saved["subject"], "test")
        self.assertEqual(saved["model"], "test")
