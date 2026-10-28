"""Sign in with ChatGPT para clientes OSS locais, usando o plano autorizado.

Contrato: https://developers.openai.com/siwc/token-sharing-open-source/sign-in
Não utiliza API keys nem endpoints privados do ChatGPT.
"""
import base64
import hashlib
import json
import os
from pathlib import Path
import secrets
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from uuid import uuid4

from carreira.integrations import request_json

ISSUER = "https://auth.openai.com"
TOKEN_URL = ISSUER + "/api/accounts/oauth/token"
RESOURCE = "https://api.openai.com/v1"
PLAN_SCOPE = "chatgpt.tokens.use.direct"
SCOPES = "openid profile email offline_access resource.invoke " + PLAN_SCOPE


def atomic_private_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, temp = tempfile.mkstemp(prefix=".auth-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as output:
            json.dump(data, output)
            output.flush()
            os.fsync(output.fileno())
        os.chmod(temp, 0o600)
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


def stream_text(response):
    """Somente um evento terminal completed torna o resultado utilizável."""
    parts, event_lines = [], []
    total = 0
    completed = False
    for raw in response:
        total += len(raw)
        if total > 4_000_000:
            raise ValueError("Resposta da IA excedeu o limite local.")
        line = raw.decode("utf-8").rstrip("\r\n")
        if line.startswith("data:"):
            event_lines.append(line[5:].lstrip())
        elif not line and event_lines:
            data = "\n".join(event_lines)
            event_lines = []
            if data == "[DONE]":
                continue
            event = json.loads(data)
            kind = event.get("type", "")
            if kind == "response.output_text.delta":
                parts.append(event.get("delta", ""))
            elif kind in {"response.failed", "response.incomplete", "error"}:
                code = event.get("response", {}).get("error", {}).get("code", "")
                if code in {"subscription_sharing_usage_limit_exceeded", "subscription_sharing_usage_unavailable"}:
                    raise ValueError("Seu plano atingiu um limite ou não está disponível para esta solicitação. Confira Uso nas configurações do ChatGPT.")
                raise ValueError("A IA não concluiu a resposta. Nada foi publicado. Tente novamente depois.")
            elif kind == "response.completed":
                completed = True
    text = "".join(parts).strip()
    if not completed or not text:
        raise ValueError("Resposta interrompida ou vazia. Nenhum texto parcial foi salvo.")
    return text


class ChatGPTClient:
    def __init__(self, data_dir, base_url):
        self.path = Path(data_dir) / "chatgpt-session.json"
        self.host_path = Path(data_dir) / "chatgpt-host.json"
        self.callback = base_url + "/oauth/chatgpt/callback"
        self.pending = {}
        self.lock = threading.RLock()
        self.catalog = []
        self.registration = json.loads(self.path.read_text()) if self.path.exists() else {}

    def status(self):
        record = self.registration
        return {"configured": True, "connected": bool(record.get("access_token")),
                "plan_enabled": PLAN_SCOPE in record.get("scopes", []),
                "email": record.get("email", "") if record.get("access_token") else "",
                "model": record.get("model", ""), "models": self.catalog}

    def begin(self):
        try:
            import jwt  # noqa: F401
        except ImportError:
            raise ValueError("Instale as dependências: python -m pip install -r requirements.txt") from None
        if not self.host_path.exists():
            atomic_private_json(self.host_path, {"host_id": "urn:uuid:" + str(uuid4())})
        host_id = json.loads(self.host_path.read_text())["host_id"]
        state, nonce, verifier, browser = (secrets.token_urlsafe(48) for _ in range(4))
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
        registration = dict(self.registration)
        client_id = registration.get("client_id", "dynamic_agent_client")
        self.pending = {key: value for key, value in self.pending.items() if value["expires"] > time.time()}
        self.pending[state] = {"nonce": nonce, "verifier": verifier, "browser": browser, "expires": time.time()+600,
                               "client_id": client_id, "subject": registration.get("subject")}
        params = {"client_id": client_id, "ext_agent_host_id": host_id, "response_type": "code", "redirect_uri": self.callback,
                  "scope": SCOPES, "resource": RESOURCE, "state": state, "nonce": nonce,
                  "code_challenge_method": "S256", "code_challenge": challenge}
        if client_id == "dynamic_agent_client":
            params["agent_name_hint"] = "Auto-linkedim"
        elif registration.get("id_token"):
            params["id_token_hint"] = registration["id_token"]
        return ISSUER + "/api/accounts/authorize?" + urllib.parse.urlencode(params), browser

    def validate_identity(self, token, client_id, nonce):
        try:
            import jwt
            client = jwt.PyJWKClient(ISSUER + "/.well-known/jwks.json", timeout=20)
            key = client.get_signing_key_from_jwt(token)
            claims = jwt.decode(token, key.key, algorithms=["RS256"], audience=client_id, issuer=ISSUER,
                                leeway=5, options={"require": ["sub", "exp", "iat", "nonce"]})
            if not secrets.compare_digest(str(claims.get("nonce", "")), nonce) or not isinstance(claims.get("sub"), str) or not claims["sub"]:
                raise ValueError("Identidade inválida.")
            return claims
        except Exception:
            raise ValueError("Não foi possível validar a identidade OpenAI com segurança. Reinicie a conexão.") from None

    def complete(self, query, browser):
        pending = self.pending.pop(query.get("state", [""])[0], None)
        if not pending or pending["expires"] < time.time() or not secrets.compare_digest(pending["browser"], browser):
            raise ValueError("Login inválido ou expirado. Inicie novamente neste navegador.")
        if query.get("error") or not query.get("code"):
            raise ValueError("A autorização foi recusada ou não foi concluída.")
        client_id = query.get("client_id", [pending["client_id"]])[0]
        if client_id == "dynamic_agent_client" or (pending["client_id"] != "dynamic_agent_client" and client_id != pending["client_id"]):
            raise ValueError("O registro não retornou o identificador esperado do aplicativo.")
        token, _ = request_json(TOKEN_URL, {"grant_type": "authorization_code", "client_id": client_id,
                                          "code": query["code"][0], "code_verifier": pending["verifier"],
                                          "redirect_uri": self.callback, "resource": RESOURCE}, form=True)
        claims = self.validate_identity(token.get("id_token", ""), client_id, pending["nonce"])
        if pending.get("subject") and claims["sub"] != pending["subject"]:
            raise ValueError("A conta retornada é diferente da conta registrada. Desconecte para trocar de conta.")
        record = {"client_id": client_id, "subject": claims["sub"], "email": claims.get("email", ""),
                  "model": self.registration.get("model", ""), **self.token_fields(token)}
        with self.lock:
            atomic_private_json(self.path, record)
            self.registration = record
            self.catalog = []

    @staticmethod
    def token_fields(token):
        if not token.get("access_token") or str(token.get("token_type", "Bearer")).lower() != "bearer":
            raise ValueError("A OpenAI não retornou uma credencial válida.")
        return {key: token.get(key, "") for key in ("access_token", "refresh_token", "id_token")} | {
            "scopes": str(token.get("scope", "")).split(), "expires_at": time.time()+int(token.get("expires_in", 3600))}

    def access_token(self):
        with self.lock:
            record = self.registration
            if not record.get("access_token") or PLAN_SCOPE not in record.get("scopes", []):
                raise ValueError("Conecte o ChatGPT e autorize o uso do plano antes de gerar com IA.")
            if record["expires_at"] <= time.time():
                if not record.get("refresh_token"):
                    raise ValueError("Sessão expirada. Reconecte sua conta ChatGPT.")
                token, _ = request_json(TOKEN_URL, {"grant_type": "refresh_token", "client_id": record["client_id"],
                                                  "refresh_token": record["refresh_token"], "resource": RESOURCE}, form=True)
                replacement = {**record, **self.token_fields(token)}
                # Não reutilize silenciosamente o refresh token que acabou de ser rotacionado.
                atomic_private_json(self.path, replacement)
                self.registration = replacement
            return self.registration["access_token"]

    def models(self):
        data, _ = request_json(RESOURCE + "/models", headers={"Authorization": "Bearer " + self.access_token()})
        self.catalog = [{"slug": item["slug"], "display_name": item.get("display_name", item["slug"])}
                        for item in data.get("models", []) if item.get("visibility") == "list" and item.get("slug")]
        if not self.catalog:
            raise ValueError("Nenhum modelo elegível foi retornado para esta conta.")
        return self.catalog

    def set_model(self, slug):
        if slug not in {item["slug"] for item in self.catalog}:
            raise ValueError("Carregue os modelos disponíveis e escolha um da lista.")
        with self.lock:
            record = {**self.registration, "model": slug}
            atomic_private_json(self.path, record)
            self.registration = record

    def generate(self, prompt):
        model = self.registration.get("model")
        if not model:
            raise ValueError("Escolha um modelo do ChatGPT em Configurações.")
        token = self.access_token()
        body = {"model": model, "input": [{"role": "user", "content": prompt}], "store": False, "stream": True}
        request = urllib.request.Request(RESOURCE + "/responses", data=json.dumps(body).encode(),
                                         headers={"Content-Type": "application/json", "Accept": "text/event-stream", "Authorization": "Bearer " + token})
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                return stream_text(response)
        except urllib.error.HTTPError as error:
            raise ValueError(f"A OpenAI retornou HTTP {error.code}. Confira disponibilidade, limites do plano e conexão. Não foi usada uma API key paga.") from None
        except (urllib.error.URLError, TimeoutError):
            raise ValueError("A conexão com a IA foi interrompida. Tente novamente depois.") from None

    def disconnect(self):
        with self.lock:
            self.registration, self.catalog, self.pending = {}, [], {}
            if self.path.exists():
                self.path.unlink()
