"""Adaptador exclusivo da prévia gerenciada; usuários locais executam app.py."""
import argparse
import os
from pathlib import Path
import subprocess
import sys

if os.getenv("SITES_MANAGED_LINUX_CONTAINER") != "1":
    raise SystemExit("Para uso local, execute python app.py.")
parser = argparse.ArgumentParser()
parser.add_argument("--port", type=int, default=4173)
parser.add_argument("--host")
parser.add_argument("--strictPort", action="store_true")
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
raise SystemExit(subprocess.call([sys.executable, str(root / "app.py"), "--preview", "--port", str(args.port)], cwd=root))
