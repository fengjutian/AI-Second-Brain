/**
 * Local-First Index: SQLite FTS5 search + link extraction, pure client-side.
 * Used in Tauri mode when the Python backend is unavailable.
 */
import Database from "@tauri-apps/plugin-sql";

let dbPromise: Promise<Database> | null = null;

interface NoteEntry {
  id: string;
  path: string;
  title: string;
  content: string;
}

interface LinkEntry {
  source_id: string;
  target_text: string;
  target_id: string | null;
}

// ── Database init ──

async function getDb(vaultPath: string): Promise<Database> {
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    const Database = (await import("@tauri-apps/plugin-sql")).default;
    const db = await Database.load(`sqlite:${vaultPath}/.aisb/data.db`);

    // Create tables if they don't exist
    await db.execute(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL
      )
    `);
    await db.execute(`
      CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
        title, content, content_rowid='rowid'
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS links (
        source_id TEXT NOT NULL,
        target_text TEXT NOT NULL,
        target_id TEXT
      )
    `);

    return db;
  })();
  return dbPromise;
}

// ── Frontmatter helpers ──

function parseFrontmatter(content: string): { id?: string; title?: string; body: string } {
  if (!content.startsWith("---\n")) return { body: content };
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) return { body: content };
  const fmBlock = content.slice(4, end);
  const body = content.slice(end + 5).trimStart();
  const idMatch = fmBlock.match(/^id:\s*(.+)$/m);
  const titleMatch = fmBlock.match(/^title:\s*(.+)$/m);
  return {
    id: idMatch ? idMatch[1].replace(/^["']|["']$/g, "") : undefined,
    title: titleMatch ? titleMatch[1].replace(/^["']|["']$/g, "") : undefined,
    body,
  };
}

// ── Rebuild index from all .md files ──

export async function rebuildIndex(vaultPath: string): Promise<void> {
  const { readDir, readTextFile } = await import("@tauri-apps/plugin-fs");
  const db = await getDb(vaultPath);

  // Load existing path→id mapping to preserve IDs across rebuilds
  const existingRows: any[] = await db.select("SELECT id, path FROM notes");
  const existingIds = new Map<string, string>();
  for (const row of existingRows) existingIds.set(row.path, row.id);

  const seenPaths = new Set<string>();
  const notes: NoteEntry[] = [];
  await scanVault(vaultPath, vaultPath, notes, existingIds, seenPaths, readDir, readTextFile);

  // Delete notes whose files no longer exist
  for (const row of existingRows) {
    if (!seenPaths.has(row.path)) {
      await db.execute("DELETE FROM notes_fts WHERE rowid = (SELECT rowid FROM notes WHERE id = $1)", [row.id]);
      await db.execute("DELETE FROM links WHERE source_id = $1 OR target_id = $1", [row.id]);
      await db.execute("DELETE FROM notes WHERE id = $1", [row.id]);
    }
  }

  for (const note of notes) {
    const { body } = parseFrontmatter(note.content);

    await db.execute(
      "INSERT OR REPLACE INTO notes (id, path, title, content) VALUES ($1, $2, $3, $4)",
      [note.id, note.path, note.title, body],
    );
    await db.execute("INSERT INTO notes_fts (rowid, title, content) VALUES ((SELECT rowid FROM notes WHERE id = $1), $2, $3)", [
      note.id, note.title, body,
    ]);

    // Extract [[links]]
    const linkRegex = /\[\[([^\]|#]+)(?:[|#][^\]]+)?\]\]/g;
    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(body)) !== null) {
      const targetText = match[1].trim();
      await db.execute("INSERT INTO links (source_id, target_text) VALUES ($1, $2)", [
        note.id, targetText,
      ]);
    }
  }

  // Resolve link targets
  await db.execute(`
    UPDATE links SET target_id = (
      SELECT id FROM notes WHERE notes.title = links.target_text OR notes.path LIKE '%/' || links.target_text || '.md'
    )
  `);
}

async function scanVault(
  dirPath: string, vaultPath: string, results: NoteEntry[],
  existingIds: Map<string, string>, seenPaths: Set<string>,
  readDir: Function, readTextFile: Function
): Promise<void> {
  const entries = await readDir(dirPath);
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === ".trash") continue;
    const fullPath = `${dirPath}/${entry.name}`;
    if (entry.isDirectory) {
      await scanVault(fullPath, vaultPath, results, existingIds, seenPaths, readDir, readTextFile);
    } else if (entry.name.endsWith(".md")) {
      const relPath = fullPath.slice(vaultPath.length + 1);
      seenPaths.add(relPath);
      const fileName = entry.name.replace(/\.md$/, "");
      const content = await readTextFile(fullPath);
      const { id: fmId, title: fmTitle } = parseFrontmatter(content);
      // Prefer existing DB id, then frontmatter id, then generate new UUID
      const noteId = existingIds.get(relPath) || fmId || crypto.randomUUID();
      const title = fmTitle || fileName;
      results.push({ id: noteId, path: relPath, title, content });
    }
  }
}

// ── Search ──

export async function searchNotes(
  vaultPath: string, query: string, limit = 20
): Promise<{ id: string; path: string; title: string; snippet: string }[]> {
  const db = await getDb(vaultPath);
  const rows: any[] = await db.select(
    `SELECT n.id, n.path, n.title, snippet(notes_fts, 1, '<mark>', '</mark>', '...', 40) as snippet
     FROM notes_fts f JOIN notes n ON n.rowid = f.rowid
     WHERE notes_fts MATCH $1 ORDER BY rank LIMIT $2`,
    [query, limit]
  );
  return rows.map((r: any) => ({ id: r.id, path: r.path, title: r.title, snippet: r.snippet }));
}

// ── Outgoing Links ──

export async function outgoingLinks(vaultPath: string, noteId: string): Promise<LinkEntry[]> {
  const db = await getDb(vaultPath);
  return db.select("SELECT * FROM links WHERE source_id = $1", [noteId]);
}

// ── Backlinks ──

export async function backlinks(vaultPath: string, noteId: string): Promise<LinkEntry[]> {
  const db = await getDb(vaultPath);
  return db.select("SELECT * FROM links WHERE target_id = $1", [noteId]);
}

// ── Lifecycle ──

export async function closeIndex(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    await db.close();
    dbPromise = null;
  }
}

// ── Graph ──

export async function getLocalGraph(vaultPath: string): Promise<{
  nodes: { id: string; label: string; path: string }[];
  edges: { source: string; target: string }[];
}> {
  const db = await getDb(vaultPath);
  const nodes: any[] = await db.select("SELECT id, title, path FROM notes");
  const edges: any[] = await db.select(
    "SELECT source_id, target_id FROM links WHERE target_id IS NOT NULL"
  );
  return {
    nodes: nodes.map((r: any) => ({ id: r.id, label: r.title, path: r.path })),
    edges: edges.map((r: any) => ({ source: r.source_id, target: r.target_id })),
  };
}
