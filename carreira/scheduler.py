"""Fila local: retoma ao abrir; não tenta republicar resultados incertos."""
import threading
from datetime import datetime, timezone

from carreira.storage import now


def publish_post(store, integrations, post_id, allowed=("rascunho", "agendado"), reviewed_text=None):
    # Falha antes de registrar tentativa se a conta nem sequer estiver conectada.
    integrations.account("linkedin")
    post = store.change_post(post_id, allowed, {"status": "verificar", "attempted_at": now(), "error": ""},
                             expected={"text": reviewed_text} if reviewed_text is not None else None)
    try:
        result = integrations.publish(post["text"])
        return store.change_post(post_id, ("verificar",), {**result, "status": "publicado", "published_at": now()})
    except Exception as error:
        store.change_post(post_id, ("verificar",), {"error": str(error) if isinstance(error, ValueError) else "Falha de comunicação. Confira seu LinkedIn."})
        raise


class Scheduler:
    def __init__(self, store, integrations):
        self.store, self.integrations = store, integrations
        self.stop_event = threading.Event()
        self.thread = threading.Thread(target=self.run, daemon=True)

    def tick(self):
        for post in self.store.all("posts"):
            if post.get("status") != "agendado":
                continue
            due = datetime.fromisoformat(post["scheduled_at"])
            if due > datetime.now(timezone.utc):
                continue
            # Evite publicar conteúdo antigo inesperadamente depois de dias com o computador desligado.
            if (datetime.now(timezone.utc) - due).total_seconds() > 3600:
                self.store.change_post(post["id"], ("agendado",), {"status": "rascunho", "error": "Horário passou há mais de uma hora. Revise e reagende."})
                continue
            if not self.integrations.status()["linkedin"]["connected"]:
                continue
            try:
                publish_post(self.store, self.integrations, post["id"], ("agendado",))
            except Exception:
                pass  # Erro preservado no registro, sem vazamento de dados em logs.

    def run(self):
        while not self.stop_event.wait(10):
            self.tick()

    def start(self):
        self.thread.start()

    def stop(self):
        self.stop_event.set()
        self.thread.join(timeout=2)
