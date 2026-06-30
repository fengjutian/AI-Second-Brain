"""File watcher — monitor vault for external changes via watchdog."""
import os
import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from core.indexer import index_file
from data.database import connect, init_db


class VaultWatcher(FileSystemEventHandler):
    """Watch the vault directory for .md file changes."""

    def __init__(self, vault_path: str, on_change=None):
        self.vault_path = vault_path
        self.on_change = on_change  # callback(note_id, event_type)
        self._pending: dict[str, float] = {}  # debounce: path → timestamp
        self._debounce_seconds = 0.5

    def _should_handle(self, path: str) -> bool:
        """Check if path should be processed."""
        rel = os.path.relpath(path, self.vault_path).replace("\\", "/")
        # Skip non-markdown, hidden files, data dir
        if not rel.endswith(".md"):
            return False
        if any(part.startswith(".") for part in rel.split("/") if part.startswith(".")):
            if not rel.startswith(".trash"):
                return False
        if rel.startswith("data/"):
            return False
        return True

    def _debounce(self, path: str):
        """Debounce rapid changes to the same file."""
        now = time.time()
        last = self._pending.get(path, 0)
        if now - last < self._debounce_seconds:
            return False
        self._pending[path] = now
        return True

    def _process(self, full_path: str, event_type: str):
        """Index the changed file."""
        if not self._should_handle(full_path):
            return
        if not self._debounce(full_path):
            return

        rel_path = os.path.relpath(full_path, self.vault_path).replace("\\", "/")
        try:
            conn = connect(self.vault_path)
            init_db(conn)
            note_id = index_file(conn, self.vault_path, rel_path)
            conn.close()
            if self.on_change and note_id:
                self.on_change(note_id, event_type)
        except Exception as e:
            print(f"[watcher] Error indexing {rel_path}: {e}")

    def on_modified(self, event):
        if event.src_path:
            self._process(event.src_path, "modified")

    def on_created(self, event):
        if event.src_path:
            self._process(event.src_path, "created")

    def on_deleted(self, event):
        if not event.src_path or not self._should_handle(event.src_path):
            return
        rel_path = os.path.relpath(event.src_path, self.vault_path).replace("\\", "/")
        try:
            conn = connect(self.vault_path)
            init_db(conn)
            cur = conn.execute("SELECT id FROM notes WHERE path = ?", (rel_path,))
            row = cur.fetchone()
            if row:
                conn.execute("DELETE FROM notes_fts WHERE rowid = (SELECT rowid FROM notes WHERE id = ?)", (row["id"],))
                conn.execute("DELETE FROM links WHERE source_id = ? OR target_id = ?", (row["id"], row["id"]))
                conn.execute("DELETE FROM notes WHERE id = ?", (row["id"],))
                conn.commit()
                if self.on_change:
                    self.on_change(row["id"], "deleted")
            conn.close()
        except Exception as e:
            print(f"[watcher] Error handling delete {rel_path}: {e}")

    def on_moved(self, event):
        if event.src_path and event.dest_path:
            # Handle as delete + create
            self.on_deleted(event)
            self.on_created(event)


_watcher: Observer | None = None


def start_watcher(vault_path: str, on_change=None):
    """Start the file watcher in a background thread."""
    global _watcher
    event_handler = VaultWatcher(vault_path, on_change)
    observer = Observer()
    observer.schedule(event_handler, vault_path, recursive=True)
    observer.start()
    _watcher = observer


def stop_watcher():
    """Stop the file watcher."""
    global _watcher
    if _watcher:
        _watcher.stop()
        _watcher.join()
        _watcher = None
