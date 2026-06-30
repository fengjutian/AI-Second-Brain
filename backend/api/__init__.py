"""Shared API utilities."""
import sqlite3
from fastapi import HTTPException
import shared
from data.database import connect


def get_conn() -> sqlite3.Connection:
    """Get a database connection for the current vault.

    Note: init_db() is NOT called here — schema is already set up
    at vault open time.  Calling it on every request would run
    CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS + COMMIT
    unnecessarily.
    """
    vault = shared.get_vault_path()
    if not vault:
        raise HTTPException(500, "Vault not initialized")
    return connect(vault)
