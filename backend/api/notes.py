"""Notes CRUD API."""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
import sqlite3
import json

from core.indexer import (
    get_note, list_notes, create_note, update_note, delete_note,
    get_links,
)
from data.database import connect, init_db

router = APIRouter(prefix="/notes", tags=["notes"])


# Global vault path — set at startup
_vault_path: str | None = None


def set_vault_path(path: str):
    global _vault_path
    _vault_path = path


def get_conn() -> sqlite3.Connection:
    if not _vault_path:
        raise HTTPException(500, "Vault not initialized")
    conn = connect(_vault_path)
    init_db(conn)
    return conn


@router.get("/")
async def list_all_notes():
    """List all notes."""
    conn = get_conn()
    try:
        return list_notes(conn)
    finally:
        conn.close()


@router.get("/{note_id}")
async def get_single_note(note_id: str):
    """Get a note by id."""
    conn = get_conn()
    try:
        note = get_note(conn, _vault_path, note_id)
        if not note:
            raise HTTPException(404, f"Note {note_id} not found")
        return note
    finally:
        conn.close()


@router.post("/")
async def create_new_note(data: dict):
    """Create a new note. Body: {path, template?}"""
    conn = get_conn()
    try:
        note_id = create_note(conn, _vault_path, data["path"], data.get("template"))
        note = get_note(conn, _vault_path, note_id)
        return note
    finally:
        conn.close()


@router.put("/{note_id}")
async def update_existing_note(note_id: str, data: dict):
    """Update note content. Body: {content}"""
    conn = get_conn()
    try:
        row = conn.execute("SELECT path FROM notes WHERE id = ?", (note_id,)).fetchone()
        if not row:
            raise HTTPException(404, f"Note {note_id} not found")
        updated_id = update_note(conn, _vault_path, row["path"], data["content"])
        note = get_note(conn, _vault_path, updated_id)
        return note
    finally:
        conn.close()


@router.delete("/{note_id}")
async def delete_existing_note(note_id: str):
    """Delete a note."""
    conn = get_conn()
    try:
        row = conn.execute("SELECT path FROM notes WHERE id = ?", (note_id,)).fetchone()
        if not row:
            raise HTTPException(404, f"Note {note_id} not found")
        delete_note(conn, _vault_path, row["path"])
        return {"ok": True}
    finally:
        conn.close()


@router.patch("/{note_id}/rename")
async def rename_note(note_id: str, data: dict):
    """Rename/move a note. Body: {new_path}"""
    conn = get_conn()
    try:
        row = conn.execute("SELECT path FROM notes WHERE id = ?", (note_id,)).fetchone()
        if not row:
            raise HTTPException(404, f"Note {note_id} not found")

        import os, shutil
        old_path = os.path.join(_vault_path, row["path"])
        new_path = os.path.join(_vault_path, data["new_path"])
        os.makedirs(os.path.dirname(new_path), exist_ok=True)
        shutil.move(old_path, new_path)

        conn.execute("UPDATE notes SET path = ? WHERE id = ?", (data["new_path"], note_id))
        conn.commit()

        note = get_note(conn, _vault_path, note_id)
        return note
    finally:
        conn.close()


@router.get("/{note_id}/links/outgoing")
async def outgoing_links(note_id: str):
    """Get outgoing links for a note."""
    conn = get_conn()
    try:
        return get_links(conn, note_id, "outgoing")
    finally:
        conn.close()


@router.get("/{note_id}/links/backlinks")
async def backlinks(note_id: str):
    """Get backlinks for a note."""
    conn = get_conn()
    try:
        return get_links(conn, note_id, "backlinks")
    finally:
        conn.close()
