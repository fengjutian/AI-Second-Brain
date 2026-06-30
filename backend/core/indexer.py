"""Index engine — Markdown parsing, file scanning, and SQLite sync."""
import os
import re
import json
import uuid
import hashlib
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import frontmatter
from data.database import connect, init_db

# Regex for [[wiki-links]]
LINK_RE = re.compile(r"\[\[([^\]|#]+)(?:[|#]([^\]]+))?\]\]")

# Directories to skip during scanning
SKIP_DIRS = {".git", ".obsidian", ".trash", "data", "attachments", "templates"}


def _md5(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest()


def _parse_frontmatter(filepath: str) -> tuple[dict, str]:
    """Parse a Markdown file, returning (frontmatter dict, content body)."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            post = frontmatter.load(f)
        return dict(post.metadata), post.content or ""
    except Exception:
        return {}, ""


def _extract_links(content: str) -> list[dict]:
    """Extract all [[wiki-links]] from content.
    Returns list of {target_text, anchor} dicts.
    """
    links = []
    for m in LINK_RE.finditer(content):
        target = m.group(1).strip()
        anchor = m.group(2).strip() if m.group(2) else None
        links.append({"target_text": target, "anchor": anchor})
    return links


def _extract_inline_tags(content: str) -> list[str]:
    """Extract #tag from content body."""
    return list(set(re.findall(r"(?<!\w)#([a-zA-Z\u4e00-\u9fff][\w\u4e00-\u9fff-]*)", content)))


def _title_from_path(path: str) -> str:
    """Derive a title from a file path."""
    name = os.path.splitext(os.path.basename(path))[0]
    return name


def index_file(conn: sqlite3.Connection, vault_path: str, rel_path: str) -> Optional[str]:
    """Index a single Markdown file. Insert or update. Returns note id."""
    full_path = os.path.join(vault_path, rel_path)

    if not os.path.isfile(full_path):
        return None
    if not rel_path.endswith(".md"):
        return None

    meta, content = _parse_frontmatter(full_path)
    checksum = _md5(content)

    # Check if file has changed
    cur = conn.execute("SELECT id, checksum FROM notes WHERE path = ?", (rel_path,))
    row = cur.fetchone()

    if row and row["checksum"] == checksum:
        return row["id"]  # Unchanged, skip

    title = meta.get("title") or _title_from_path(rel_path)
    tags = meta.get("tags", [])
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",") if t.strip()]
    inline_tags = _extract_inline_tags(content)
    all_tags = list(set(list(tags) + inline_tags))
    aliases = meta.get("aliases", [])
    if isinstance(aliases, str):
        aliases = [a.strip() for a in aliases.split(",") if a.strip()]
    now = datetime.now(timezone.utc).isoformat()
    created = meta.get("created", now)
    updated = meta.get("updated", now)
    word_count = len(content.split())

    if row:
        note_id = row["id"]
        conn.execute(
            """UPDATE notes SET title=?, aliases=?, tags=?, updated=?, word_count=?, checksum=?
               WHERE id=?""",
            (title, json.dumps(aliases), json.dumps(all_tags), now, word_count, checksum, note_id),
        )
    else:
        note_id = meta.get("id") or str(uuid.uuid4())
        try:
            conn.execute(
                """INSERT INTO notes (id, path, title, aliases, tags, created, updated, word_count, checksum)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (note_id, rel_path, title, json.dumps(aliases), json.dumps(all_tags),
                 created, updated, word_count, checksum),
            )
        except sqlite3.IntegrityError:
            # Race condition — file created between check and insert
            note_id = conn.execute("SELECT id FROM notes WHERE path=?", (rel_path,)).fetchone()["id"]
            conn.execute(
                """UPDATE notes SET title=?, aliases=?, tags=?, updated=?, word_count=?, checksum=?
                   WHERE id=?""",
                (title, json.dumps(aliases), json.dumps(all_tags), now, word_count, checksum, note_id),
            )

    # Update FTS5 index
    conn.execute("DELETE FROM notes_fts WHERE rowid = (SELECT rowid FROM notes WHERE id = ?)", (note_id,))
    conn.execute(
        "INSERT INTO notes_fts (rowid, title, content) VALUES ((SELECT rowid FROM notes WHERE id = ?), ?, ?)",
        (note_id, title, content),
    )

    # Update links — remove old, insert new
    conn.execute("DELETE FROM links WHERE source_id = ?", (note_id,))
    raw_links = _extract_links(content)
    for link in raw_links:
        # Try to resolve target to an existing note
        target_id = None
        cur2 = conn.execute(
            "SELECT id FROM notes WHERE id = ? OR title = ? OR aliases LIKE ?",
            (link["target_text"], link["target_text"], f'%"{link["target_text"]}"%'),
        )
        target_row = cur2.fetchone()
        if target_row:
            target_id = target_row["id"]

        conn.execute(
            "INSERT INTO links (source_id, target_id, target_text, anchor) VALUES (?,?,?,?)",
            (note_id, target_id, link["target_text"], link["anchor"]),
        )

    conn.commit()
    return note_id


def scan_vault(conn: sqlite3.Connection, vault_path: str) -> dict:
    """Scan the entire vault, index all .md files, and clean up deleted files.
    Returns {indexed: int, deleted: int}.
    """
    indexed = 0
    seen_paths = set()

    for root, dirs, files in os.walk(vault_path):
        # Skip special directories
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]

        for file in files:
            if not file.endswith(".md"):
                continue
            full = os.path.join(root, file)
            rel = os.path.relpath(full, vault_path).replace("\\", "/")
            seen_paths.add(rel)
            note_id = index_file(conn, vault_path, rel)
            if note_id:
                indexed += 1

    # Delete notes whose files no longer exist
    cur = conn.execute("SELECT id, path FROM notes")
    deleted = 0
    for row in cur.fetchall():
        if row["path"] not in seen_paths:
            conn.execute("DELETE FROM notes_fts WHERE rowid = (SELECT rowid FROM notes WHERE id = ?)", (row["id"],))
            conn.execute("DELETE FROM links WHERE source_id = ? OR target_id = ?", (row["id"], row["id"]))
            conn.execute("DELETE FROM notes WHERE id = ?", (row["id"],))
            deleted += 1
    conn.commit()

    return {"indexed": indexed, "deleted": deleted}


def create_note(conn: sqlite3.Connection, vault_path: str, rel_path: str, template: str = None) -> str:
    """Create a new note. Returns note id."""
    full_path = os.path.join(vault_path, rel_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)

    note_id = str(uuid.uuid4())
    title = _title_from_path(rel_path)
    now = datetime.now(timezone.utc).isoformat()

    content = template or ""
    frontmatter_text = f"---\nid: {note_id}\ntitle: {title}\ncreated: {now}\nupdated: {now}\n---\n\n{content}"

    with open(full_path, "w", encoding="utf-8") as f:
        f.write(frontmatter_text)

    return index_file(conn, vault_path, rel_path)


def update_note(conn: sqlite3.Connection, vault_path: str, rel_path: str, content: str) -> Optional[str]:
    """Update a note's content. Returns note id."""
    full_path = os.path.join(vault_path, rel_path)
    if not os.path.isfile(full_path):
        return None

    meta, _ = _parse_frontmatter(full_path)
    note_id = meta.get("id") or str(uuid.uuid4())
    title = meta.get("title", _title_from_path(rel_path))
    now = datetime.now(timezone.utc).isoformat()
    created = meta.get("created", now)

    frontmatter_text = f"---\nid: {note_id}\ntitle: {title}\ncreated: {created}\nupdated: {now}\ntags: {json.dumps(meta.get('tags', []))}\n---\n\n{content}"

    with open(full_path, "w", encoding="utf-8") as f:
        f.write(frontmatter_text)

    return index_file(conn, vault_path, rel_path)


def delete_note(conn: sqlite3.Connection, vault_path: str, rel_path: str):
    """Delete a note (move to trash or delete permanently)."""
    full_path = os.path.join(vault_path, rel_path)
    trash_dir = os.path.join(vault_path, ".trash")
    os.makedirs(trash_dir, exist_ok=True)

    if os.path.isfile(full_path):
        # Move to trash
        import shutil
        trash_path = os.path.join(trash_dir, os.path.basename(full_path))
        shutil.move(full_path, trash_path)

    note = conn.execute("SELECT id FROM notes WHERE path = ?", (rel_path,)).fetchone()
    if note:
        conn.execute("DELETE FROM notes_fts WHERE rowid = (SELECT rowid FROM notes WHERE id = ?)", (note["id"],))
        conn.execute("DELETE FROM links WHERE source_id = ? OR target_id = ?", (note["id"], note["id"]))
        conn.execute("DELETE FROM notes WHERE id = ?", (note["id"],))
        conn.commit()


def search_fts(conn: sqlite3.Connection, query: str, limit: int = 20) -> list[dict]:
    """Full-text search using FTS5."""
    # Sanitize: escape FTS5 syntax, support simple queries
    safe_query = query.replace('"', '""')
    try:
        cur = conn.execute(
            """SELECT n.id, n.path, n.title, snippet(notes_fts, 2, '<mark>', '</mark>', '...', 40) AS snippet
               FROM notes_fts f
               JOIN notes n ON n.rowid = f.rowid
               WHERE notes_fts MATCH ?
               ORDER BY rank
               LIMIT ?""",
            (f'"{safe_query}"', limit),
        )
    except sqlite3.OperationalError:
        # If FTS5 query fails, fallback to LIKE
        cur = conn.execute(
            """SELECT id, path, title, substr(content, 1, 200) AS snippet
               FROM notes
               WHERE title LIKE ? OR content LIKE ?
               LIMIT ?""",
            (f"%{query}%", f"%{query}%", limit),
        )

    results = []
    for row in cur.fetchall():
        results.append({
            "note_id": row["id"],
            "path": row["path"],
            "title": row["title"],
            "snippet": row["snippet"],
            "score": 1.0,
        })
    return results


def get_note(conn: sqlite3.Connection, vault_path: str, note_id: str) -> Optional[dict]:
    """Get a single note by id."""
    row = conn.execute("SELECT * FROM notes WHERE id = ?", (note_id,)).fetchone()
    if not row:
        return None

    full_path = os.path.join(vault_path, row["path"])
    _, content = _parse_frontmatter(full_path)

    return {
        "id": row["id"],
        "path": row["path"],
        "title": row["title"],
        "content": content,
        "tags": json.loads(row["tags"]) if row["tags"] else [],
        "aliases": json.loads(row["aliases"]) if row["aliases"] else [],
        "created": row["created"],
        "updated": row["updated"],
        "word_count": row["word_count"],
    }


def list_notes(conn: sqlite3.Connection) -> list[dict]:
    """List all notes (summary, without content)."""
    cur = conn.execute(
        "SELECT id, path, title, tags, aliases, created, updated, word_count FROM notes ORDER BY updated DESC"
    )
    results = []
    for row in cur.fetchall():
        results.append({
            "id": row["id"],
            "path": row["path"],
            "title": row["title"],
            "tags": json.loads(row["tags"]) if row["tags"] else [],
            "aliases": json.loads(row["aliases"]) if row["aliases"] else [],
            "created": row["created"],
            "updated": row["updated"],
            "word_count": row["word_count"],
        })
    return results


def get_links(conn: sqlite3.Connection, note_id: str, direction: str = "outgoing") -> list[dict]:
    """Get outgoing or back links for a note."""
    if direction == "outgoing":
        cur = conn.execute(
            """SELECT l.id, l.target_id, l.target_text, l.anchor, n.title AS target_title, n.path AS target_path
               FROM links l
               LEFT JOIN notes n ON n.id = l.target_id
               WHERE l.source_id = ?""",
            (note_id,),
        )
    else:
        cur = conn.execute(
            """SELECT l.id, l.source_id AS target_id, n.title AS target_title, n.path AS target_path
               FROM links l
               JOIN notes n ON n.id = l.source_id
               WHERE l.target_id = ?""",
            (note_id,),
        )

    results = []
    for row in cur.fetchall():
        results.append({
            "id": row["id"],
            "target_id": row["target_id"],
            "target_text": row["target_text"] if "target_text" in row.keys() else row["target_title"],
            "target_title": row["target_title"],
            "target_path": row["target_path"],
            "anchor": row["anchor"] if "anchor" in row.keys() else None,
        })
    return results


def get_graph(conn: sqlite3.Connection, note_id: str = None, depth: int = 1) -> dict:
    """Get graph data — nodes and edges. If note_id is provided, return local graph."""
    if note_id:
        # Local graph: start from note_id, traverse `depth` hops
        node_ids = {note_id}
        frontier = {note_id}
        for _ in range(depth):
            if not frontier:
                break
            placeholders = ",".join("?" for _ in frontier)
            cur = conn.execute(
                f"SELECT DISTINCT target_id FROM links WHERE source_id IN ({placeholders}) AND target_id IS NOT NULL",
                list(frontier),
            )
            new_ids = {r["target_id"] for r in cur.fetchall() if r["target_id"]}
            cur = conn.execute(
                f"SELECT DISTINCT source_id FROM links WHERE target_id IN ({placeholders})",
                list(frontier),
            )
            new_ids |= {r["source_id"] for r in cur.fetchall()}
            new_ids -= node_ids
            node_ids |= new_ids
            frontier = new_ids

        placeholders = ",".join("?" for _ in node_ids)
        cur = conn.execute(
            f"SELECT id, title, path FROM notes WHERE id IN ({placeholders})",
            list(node_ids),
        )
        nodes = [{"id": r["id"], "label": r["title"], "path": r["path"]} for r in cur.fetchall()]

        cur = conn.execute(
            f"""SELECT l.source_id, l.target_id
                FROM links l
                WHERE l.source_id IN ({placeholders}) AND l.target_id IN ({placeholders})
                  AND l.target_id IS NOT NULL""",
            list(node_ids) * 2,
        )
        edges = [{"source": r["source_id"], "target": r["target_id"]} for r in cur.fetchall()]
    else:
        # Global graph
        cur = conn.execute("SELECT id, title, path FROM notes")
        nodes = [{"id": r["id"], "label": r["title"], "path": r["path"]} for r in cur.fetchall()]
        cur = conn.execute(
            "SELECT source_id, target_id FROM links WHERE target_id IS NOT NULL"
        )
        edges = [{"source": r["source_id"], "target": r["target_id"]} for r in cur.fetchall()]

    return {"nodes": nodes, "edges": edges}
