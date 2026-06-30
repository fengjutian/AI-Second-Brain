"""Notes CRUD API."""
from fastapi import APIRouter, HTTPException
import sqlite3, os, shutil

import shared
from core.indexer import (
    get_note, list_notes, create_note, update_note, delete_note, get_links,
)
from data.database import connect, init_db
from models.schemas import NoteCreate, NoteUpdate, NotePathUpdate

router = APIRouter(prefix="/notes", tags=["notes"])


def _get_conn() -> sqlite3.Connection:
    vault = shared.get_vault_path()
    if not vault:
        raise HTTPException(500, "Vault not initialized")
    conn = connect(vault)
    init_db(conn)
    return conn


@router.get("/")
async def list_all_notes():
    conn = _get_conn()
    try:
        return list_notes(conn)
    finally:
        conn.close()


@router.get("/{note_id}")
async def get_single_note(note_id: str):
    vault = shared.get_vault_path()
    conn = _get_conn()
    try:
        note = get_note(conn, vault, note_id)
        if not note:
            raise HTTPException(404, f"Note {note_id} not found")
        return note
    finally:
        conn.close()


@router.post("/")
async def create_new_note(data: dict):
    vault = shared.get_vault_path()
    conn = _get_conn()
    try:
        note_id = create_note(conn, vault, data["path"], data.get("template"))
        note = get_note(conn, vault, note_id)
        return note
    finally:
        conn.close()


@router.put("/{note_id}")
async def update_existing_note(note_id: str, data: NoteUpdate):
    vault = shared.get_vault_path()
    conn = _get_conn()
    try:
        row = conn.execute("SELECT path FROM notes WHERE id = ?", (note_id,)).fetchone()
        if not row:
            raise HTTPException(404, f"Note {note_id} not found")
        updated_id = update_note(conn, vault, row["path"], data["content"])
        note = get_note(conn, vault, updated_id)
        return note
    finally:
        conn.close()


@router.delete("/{note_id}")
async def delete_existing_note(note_id: str):
    vault = shared.get_vault_path()
    conn = _get_conn()
    try:
        row = conn.execute("SELECT path FROM notes WHERE id = ?", (note_id,)).fetchone()
        if not row:
            raise HTTPException(404, f"Note {note_id} not found")
        delete_note(conn, vault, row["path"])
        return {"ok": True}
    finally:
        conn.close()


@router.patch("/{note_id}/rename")
async def rename_note(note_id: str, data: NotePathUpdate):
    vault = shared.get_vault_path()
    conn = _get_conn()
    try:
        row = conn.execute("SELECT path FROM notes WHERE id = ?", (note_id,)).fetchone()
        if not row:
            raise HTTPException(404, f"Note {note_id} not found")

        old_path = os.path.join(vault, row["path"])
        new_path = os.path.join(vault, data.new_path)
        os.makedirs(os.path.dirname(new_path), exist_ok=True)
        shutil.move(old_path, new_path)

        conn.execute("UPDATE notes SET path = ? WHERE id = ?", (data["new_path"], note_id))
        conn.commit()

        note = get_note(conn, vault, note_id)
        return note
    finally:
        conn.close()


@router.get("/{note_id}/links/outgoing")
async def outgoing_links(note_id: str):
    conn = _get_conn()
    try:
        return get_links(conn, note_id, "outgoing")
    finally:
        conn.close()


@router.get("/{note_id}/links/backlinks")
async def backlinks(note_id: str):
    conn = _get_conn()
    try:
        return get_links(conn, note_id, "backlinks")
    finally:
        conn.close()
