"""
Conversation Store — SQLite-backed persistent chat memory for PEEK.

Stores conversation history per repo so the Query Engine can:
- Maintain context across follow-up questions
- Persist chat sessions across page reloads
- Learn from frequently asked question patterns

Uses Python's built-in sqlite3 — no external dependencies.
Storage: data/conversations.db
"""

from __future__ import annotations
import sqlite3
import uuid
import json
from datetime import datetime, timezone
from pathlib import Path
from utils.file_utils import BASE_DATA_DIR

DB_PATH = BASE_DATA_DIR / "conversations.db"


class ConversationStore:
    """Thread-safe SQLite conversation storage."""

    def __init__(self):
        self._ensure_db()

    def _get_conn(self) -> sqlite3.Connection:
        """Get a fresh connection (safe for threading)."""
        conn = sqlite3.connect(str(DB_PATH), timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

    def _ensure_db(self):
        """Create tables if they don't exist."""
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        conn = self._get_conn()
        try:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS conversations (
                    id          TEXT PRIMARY KEY,
                    repo_id     TEXT NOT NULL,
                    title       TEXT DEFAULT '',
                    created_at  TEXT NOT NULL,
                    updated_at  TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS messages (
                    id              INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id TEXT NOT NULL,
                    role            TEXT NOT NULL,  -- 'user' or 'ai'
                    content         TEXT NOT NULL,
                    created_at      TEXT NOT NULL,
                    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
                );

                CREATE INDEX IF NOT EXISTS idx_msg_conv
                    ON messages(conversation_id);
                CREATE INDEX IF NOT EXISTS idx_conv_repo
                    ON conversations(repo_id);
            """)
            conn.commit()
        finally:
            conn.close()

    def create_conversation(self, repo_id: str, title: str = "") -> str:
        """Create a new conversation and return its ID."""
        conv_id = str(uuid.uuid4())[:8]
        now = datetime.now(timezone.utc).isoformat()
        conn = self._get_conn()
        try:
            conn.execute(
                "INSERT INTO conversations (id, repo_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (conv_id, repo_id, title, now, now),
            )
            conn.commit()
        finally:
            conn.close()
        return conv_id

    def add_message(self, conversation_id: str, role: str, content: str):
        """Add a message to a conversation."""
        now = datetime.now(timezone.utc).isoformat()
        conn = self._get_conn()
        try:
            conn.execute(
                "INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)",
                (conversation_id, role, content, now),
            )
            # Update conversation timestamp and auto-generate title from first user message
            conn.execute(
                "UPDATE conversations SET updated_at = ? WHERE id = ?",
                (now, conversation_id),
            )
            # Auto-title from first user message
            if role == "user":
                row = conn.execute(
                    "SELECT title FROM conversations WHERE id = ?",
                    (conversation_id,),
                ).fetchone()
                if row and not row["title"]:
                    # Use first 60 chars of first user message as title
                    title = content[:60].strip()
                    if len(content) > 60:
                        title += "…"
                    conn.execute(
                        "UPDATE conversations SET title = ? WHERE id = ?",
                        (title, conversation_id),
                    )
            conn.commit()
        finally:
            conn.close()

    def get_history(self, conversation_id: str, limit: int = 20) -> list[dict]:
        """Get recent messages for a conversation."""
        conn = self._get_conn()
        try:
            rows = conn.execute(
                """SELECT role, content, created_at
                   FROM messages
                   WHERE conversation_id = ?
                   ORDER BY id DESC
                   LIMIT ?""",
                (conversation_id, limit),
            ).fetchall()
            # Return in chronological order
            return [
                {"role": r["role"], "content": r["content"], "created_at": r["created_at"]}
                for r in reversed(rows)
            ]
        finally:
            conn.close()

    def list_conversations(self, repo_id: str) -> list[dict]:
        """List all conversations for a repo, most recent first."""
        conn = self._get_conn()
        try:
            rows = conn.execute(
                """SELECT c.id, c.title, c.created_at, c.updated_at,
                          COUNT(m.id) as message_count
                   FROM conversations c
                   LEFT JOIN messages m ON m.conversation_id = c.id
                   WHERE c.repo_id = ?
                   GROUP BY c.id
                   ORDER BY c.updated_at DESC""",
                (repo_id,),
            ).fetchall()
            return [
                {
                    "id": r["id"],
                    "title": r["title"] or "Untitled",
                    "created_at": r["created_at"],
                    "updated_at": r["updated_at"],
                    "message_count": r["message_count"],
                }
                for r in rows
            ]
        finally:
            conn.close()

    def get_conversation(self, conversation_id: str) -> dict | None:
        """Get conversation metadata."""
        conn = self._get_conn()
        try:
            row = conn.execute(
                "SELECT * FROM conversations WHERE id = ?",
                (conversation_id,),
            ).fetchone()
            if row is None:
                return None
            return {
                "id": row["id"],
                "repo_id": row["repo_id"],
                "title": row["title"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }
        finally:
            conn.close()


# Singleton instance
_store: ConversationStore | None = None


def get_store() -> ConversationStore:
    """Get or create the singleton ConversationStore."""
    global _store
    if _store is None:
        _store = ConversationStore()
    return _store
