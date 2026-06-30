"""Obsidian vault import API."""
import os
import shutil
from fastapi import APIRouter

import shared
from core.indexer import scan_vault, index_file
from data.database import connect, init_db

router = APIRouter(prefix="/import", tags=["import"])

# Directories to skip during import
SKIP_DIRS = {".git", ".obsidian", ".trash", "data", "attachments", "templates", ".DS_Store"}
SKIP_FILES = {".DS_Store", "Thumbs.db"}


@router.post("/obsidian")
async def import_obsidian(data: dict):
    """Import notes from an Obsidian vault. Body: {source_path: str}"""
    vault = shared.get_vault_path()
    if not vault:
        return {"error": "No vault open"}

    source = data.get("source_path", "")
    if not source or not os.path.isdir(source):
        return {"error": "Invalid source path"}

    imported = 0
    skipped = 0
    errors = []

    for root, dirs, files in os.walk(source):
        # Skip special directories
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]

        for file in files:
            if file in SKIP_FILES:
                continue
            if not file.endswith(".md"):
                continue

            src_path = os.path.join(root, file)
            rel_dir = os.path.relpath(root, source)
            if rel_dir == ".":
                dst_rel = file
            else:
                dst_rel = os.path.join(rel_dir, file).replace("\\", "/")

            dst_path = os.path.join(vault, dst_rel)

            # Skip if already exists
            if os.path.exists(dst_path):
                skipped += 1
                continue

            try:
                os.makedirs(os.path.dirname(dst_path), exist_ok=True)
                shutil.copy2(src_path, dst_path)
                imported += 1
            except Exception as e:
                errors.append(f"{dst_rel}: {str(e)}")

    # Re-index vault
    conn = connect(vault)
    init_db(conn)
    result = scan_vault(conn, vault)
    conn.close()

    return {
        "imported": imported,
        "skipped": skipped,
        "errors": errors[:20],
        "total_notes": result["indexed"],
    }


@router.post("/markdown-folder")
async def import_markdown_folder(data: dict):
    """Import a folder of .md files (generic, non-Obsidian).
    Body: {source_path: str}
    """
    # Same logic as obsidian import — just copies .md files
    return await import_obsidian(data)
