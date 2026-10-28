"""SQLite local; snapshots não mudam quando o perfil é atualizado."""
import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


def now():
    return datetime.now(timezone.utc).isoformat()


class Store:
    def __init__(self, path):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        with self.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS profile (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS resumes (id TEXT PRIMARY KEY, job_id TEXT NOT NULL, payload TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
            """)

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=15)
        try:
            with db:
                yield db
        finally:
            db.close()

    def profile(self):
        with self.connect() as db:
            row = db.execute("SELECT payload FROM profile WHERE id=1").fetchone()
        return json.loads(row[0]) if row else {"name": "", "entries": []}

    def set_profile(self, profile):
        with self.connect() as db:
            db.execute("INSERT OR REPLACE INTO profile VALUES (1, ?)", (json.dumps(profile, ensure_ascii=False),))

    def put(self, table, payload):
        if table not in {"jobs", "resumes", "posts", "attachments"}:
            raise ValueError("Tabela inválida.")
        payload = {**payload, "id": payload.get("id") or str(uuid4())}
        payload.setdefault("created_at", now())
        with self.connect() as db:
            if table == "resumes":
                db.execute("INSERT INTO resumes VALUES (?, ?, ?)", (payload["id"], payload["job_id"], json.dumps(payload, ensure_ascii=False)))
            else:
                db.execute(f"INSERT OR REPLACE INTO {table} VALUES (?, ?)", (payload["id"], json.dumps(payload, ensure_ascii=False)))
        return payload

    def all(self, table):
        if table not in {"jobs", "resumes", "posts", "attachments"}:
            raise ValueError("Tabela inválida.")
        with self.connect() as db:
            rows = db.execute(f"SELECT payload FROM {table} ORDER BY rowid DESC").fetchall()
        return [json.loads(row[0]) for row in rows]

    def get(self, table, item_id):
        return next((item for item in self.all(table) if item["id"] == item_id), None)

    def change_post(self, item_id, allowed, changes, expected=None):
        """Compare-and-set transacional evita duas publicações da mesma versão."""
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT payload FROM posts WHERE id=?", (item_id,)).fetchone()
            if not row:
                raise ValueError("Postagem não encontrada.")
            post = json.loads(row[0])
            if post.get("status") not in allowed:
                raise ValueError("A postagem já mudou de estado. Atualize a página.")
            if expected and any(post.get(key) != value for key, value in expected.items()):
                raise ValueError("O texto mudou depois da revisão. Atualize e confira novamente.")
            post.update(changes)
            db.execute("UPDATE posts SET payload=? WHERE id=?", (json.dumps(post, ensure_ascii=False), item_id))
        return post

    def export(self, include_files=True):
        attachments = self.all("attachments")
        if not include_files:
            attachments = [{key: value for key, value in item.items() if key != "content"} for item in attachments]
        return {"schema_version": 1, "exported_at": now(), "profile": self.profile(), "attachments": attachments,
                **{table: self.all(table) for table in ("jobs", "resumes", "posts")}}

    def restore(self, backup):
        if backup.get("schema_version") != 1:
            raise ValueError("Versão de backup incompatível.")
        backup.setdefault("attachments", [])
        for table in ("jobs", "resumes", "posts", "attachments"):
            if not isinstance(backup.get(table), list) or not all(isinstance(x, dict) and x.get("id") for x in backup[table]):
                raise ValueError("Backup inválido.")
            for item in backup[table]:
                item.setdefault("created_at", now())
                try:
                    datetime.fromisoformat(item["created_at"])
                except (ValueError, TypeError):
                    raise ValueError("Data inválida no backup.") from None
        for item in backup["jobs"]:
            if not isinstance(item.get("title"), str) or not isinstance(item.get("requirements", []), list):
                raise ValueError("Vaga inválida no backup.")
        for item in backup["resumes"]:
            if not all(key in item for key in ("job_id", "job", "profile", "entry_ids", "assessment", "resume_assessment")):
                raise ValueError("Currículo inválido no backup.")
        for item in backup["posts"]:
            if not isinstance(item.get("text"), str) or item.get("status") not in {"rascunho", "agendado", "verificar", "publicado"}:
                raise ValueError("Postagem inválida no backup.")
            if item["status"] == "agendado":
                item.update({"status": "rascunho", "scheduled_at": None, "error": "Agendamento suspenso após restauração. Revise e reagende."})
        for item in backup["attachments"]:
            import base64
            try:
                raw = base64.b64decode(item["content"], validate=True)
            except (KeyError, ValueError, TypeError):
                raise ValueError("PDF inválido no backup.") from None
            if not raw.startswith(b"%PDF-") or len(raw) > 5_000_000 or not item.get("job_id"):
                raise ValueError("PDF inválido no backup.")
        if not isinstance(backup.get("profile"), dict):
            raise ValueError("Perfil inválido.")
        with self.connect() as db:
            for table in ("jobs", "resumes", "posts", "attachments"):
                db.execute(f"DELETE FROM {table}")
                for item in backup[table]:
                    raw = json.dumps(item, ensure_ascii=False)
                    if table == "resumes":
                        db.execute("INSERT INTO resumes VALUES (?, ?, ?)", (item["id"], item["job_id"], raw))
                    else:
                        db.execute(f"INSERT INTO {table} VALUES (?, ?)", (item["id"], raw))
            db.execute("INSERT OR REPLACE INTO profile VALUES (1, ?)", (json.dumps(backup["profile"], ensure_ascii=False),))
