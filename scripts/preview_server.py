#!/usr/bin/env python3
"""Serve the dependency-free UI preview and map the root URL to it."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os


ROOT = Path(__file__).resolve().parent.parent
PORT = int(os.environ.get("PORT", "4173"))


class PreviewHandler(SimpleHTTPRequestHandler):
    def do_GET(self):  # noqa: N802 - method name is defined by the stdlib API
        if self.path in ("", "/"):
            self.path = "/preview.html"
        return super().do_GET()


if __name__ == "__main__":
    os.chdir(ROOT)
    server = ThreadingHTTPServer(("0.0.0.0", PORT), PreviewHandler)
    print(f"\n  ➜  Local:   http://localhost:{PORT}/", flush=True)
    print(f"  ➜  Preview: http://localhost:{PORT}/preview.html\n", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nPreview server stopped.")
    finally:
        server.server_close()
