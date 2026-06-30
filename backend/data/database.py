"""Database manager — SQLite schema initialization and connection management."""
import sqlite3
import os
from pathlib import Path

DB_DIR = "data"
DB_NAME = "app.db"


def get_data_dir(vault_path: str) -> str:
    """Get the data directory path inside the vault."""
    return os.path.join(vault_path, DB_DIR)


def get_db_path(vault_path: str) -> str:
    """Get the full path to the SQLite database file."""
    data_dir = get_data_dir(vault_path)
    return os.path.join(data_dir, DB_NAME)


def connect(vault_path: str) -> sqlite3.Connection:
    """Connect to the SQLite database, creating it if necessary."""
    data_dir = get_data_dir(vault_path)
    os.makedirs(data_dir, exist_ok=True)
    db_path = get_db_path(vault_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db(conn: sqlite3.Connection):
    """Create the database schema if it doesn't exist."""
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS notes (
            id          TEXT PRIMARY KEY,
            path        TEXT NOT NULL UNIQUE,
            title       TEXT NOT NULL DEFAULT '',
            aliases     TEXT NOT NULL DEFAULT '[]',
            tags        TEXT NOT NULL DEFAULT '[]',
            created     TEXT NOT NULL,
            updated     TEXT NOT NULL,
            pinned      INTEGER NOT NULL DEFAULT 0,
            word_count  INTEGER NOT NULL DEFAULT 0,
            checksum    TEXT NOT NULL DEFAULT ''
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
            title,
            content,
            content_rowid='rowid'
        );

        CREATE TABLE IF NOT EXISTS links (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            source_id       TEXT NOT NULL,
            target_id       TEXT,
            target_text     TEXT NOT NULL,
            anchor          TEXT,
            FOREIGN KEY (source_id) REFERENCES notes(id),
            FOREIGN KEY (target_id) REFERENCES notes(id)
        );

        CREATE INDEX IF NOT EXISTS idx_notes_path ON notes(path);
        CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated DESC);
        CREATE INDEX IF NOT EXISTS idx_notes_tags ON notes(tags);
        CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_id);
        CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_id);
    """)
    conn.commit()
