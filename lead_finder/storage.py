import sqlite3
import os
from datetime import datetime
from typing import List, Optional
from lead_finder.models import Lead


class LeadStorage:
    def __init__(self, db_path: str):
        os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS leads (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    category TEXT,
                    location TEXT,
                    state TEXT,
                    city TEXT,
                    address TEXT,
                    phone TEXT,
                    website TEXT,
                    email TEXT,
                    facebook TEXT,
                    instagram TEXT,
                    twitter TEXT,
                    rating REAL,
                    reviews_count INTEGER,
                    source TEXT DEFAULT 'google_maps',
                    source_url TEXT,
                    timestamp TEXT,
                    notes TEXT DEFAULT '',
                    status TEXT DEFAULT 'frio',
                    UNIQUE(name, address, phone)
                )
            """)
            cols = [r[1] for r in conn.execute("PRAGMA table_info(leads)")]
            for col in ["status", "state", "city", "email", "facebook", "instagram", "twitter"]:
                if col not in cols:
                    conn.execute(f"ALTER TABLE leads ADD COLUMN {col} TEXT")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_leads_name ON leads(name)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_leads_category ON leads(category)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_leads_state ON leads(state)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city)")

    def save_lead(self, lead: Lead) -> bool:
        with sqlite3.connect(self.db_path) as conn:
            try:
                conn.execute(
                    """INSERT OR IGNORE INTO leads
                    (name, category, location, state, city, address, phone, website,
                     email, facebook, instagram, twitter,
                     rating, reviews_count, source, source_url, timestamp, notes, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        lead.name, lead.category, lead.location, lead.state, lead.city,
                        lead.address, lead.phone, lead.website,
                        lead.email, lead.facebook, lead.instagram, lead.twitter,
                        lead.rating, lead.reviews_count, lead.source, lead.source_url,
                        lead.timestamp, lead.notes, lead.status
                    )
                )
                return conn.total_changes > 0
            except sqlite3.IntegrityError:
                return False

    def save_many(self, leads: List[Lead]) -> int:
        saved = 0
        for lead in leads:
            if self.save_lead(lead):
                saved += 1
        return saved

    def update_lead(self, lead_id: int, **kwargs) -> bool:
        allowed = {"status", "notes", "address", "phone", "website", "email", "facebook", "instagram", "twitter", "rating", "reviews_count"}
        updates = {k: v for k, v in kwargs.items() if k in allowed}
        if not updates:
            return False
        sets = ", ".join(f"{k} = ?" for k in updates)
        vals = list(updates.values()) + [lead_id]
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(f"UPDATE leads SET {sets} WHERE id = ?", vals)
            return conn.total_changes > 0

    def get_all(self, category: Optional[str] = None, status: Optional[str] = None,
                location: Optional[str] = None, state: Optional[str] = None,
                city: Optional[str] = None, search: Optional[str] = None) -> List[Lead]:
        query = "SELECT * FROM leads WHERE 1=1"
        params = []
        if category:
            query += " AND category = ?"
            params.append(category)
        if status:
            query += " AND status = ?"
            params.append(status)
        if location:
            query += " AND location = ?"
            params.append(location)
        if state:
            query += " AND state = ?"
            params.append(state)
        if city:
            query += " AND city = ?"
            params.append(city)
        if search:
            query += " AND (name LIKE ? OR address LIKE ? OR phone LIKE ? OR notes LIKE ?)"
            s = f"%{search}%"
            params.extend([s, s, s, s])
        query += " ORDER BY timestamp DESC"

        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(query, params).fetchall()
            return [Lead(**dict(r)) for r in rows]

    def get_by_id(self, lead_id: int) -> Optional[Lead]:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute("SELECT * FROM leads WHERE id = ?", (lead_id,)).fetchone()
            return Lead(**dict(row)) if row else None

    def count(self) -> int:
        with sqlite3.connect(self.db_path) as conn:
            return conn.execute("SELECT COUNT(*) FROM leads").fetchone()[0]

    def count_by_category(self) -> List[tuple]:
        with sqlite3.connect(self.db_path) as conn:
            return conn.execute(
                "SELECT category, COUNT(*) FROM leads GROUP BY category ORDER BY COUNT(*) DESC"
            ).fetchall()

    def count_by_status(self) -> List[tuple]:
        with sqlite3.connect(self.db_path) as conn:
            return conn.execute(
                "SELECT status, COUNT(*) FROM leads GROUP BY status ORDER BY COUNT(*) DESC"
            ).fetchall()

    def _init_campaign_log(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS campaign_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    lead_id INTEGER,
                    subject TEXT,
                    recipient TEXT,
                    sent_at TEXT,
                    status TEXT,
                    error TEXT
                )
            """)

    def log_campaign(self, lead_id: int, subject: str, recipient: str,
                     status: str, error: Optional[str] = None):
        self._init_campaign_log()
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT INTO campaign_log (lead_id, subject, recipient, sent_at, status, error) VALUES (?, ?, ?, ?, ?, ?)",
                (lead_id, subject, recipient, datetime.now().isoformat(), status, error)
            )

    def get_campaign_log(self, limit: int = 50) -> List[dict]:
        self._init_campaign_log()
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT * FROM campaign_log ORDER BY sent_at DESC LIMIT ?", (limit,)
            ).fetchall()
            return [dict(r) for r in rows]

    def get_lead_trend(self, days: int = 30) -> List[dict]:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                """SELECT DATE(timestamp) as day, COUNT(*) as count
                   FROM leads
                   WHERE timestamp IS NOT NULL
                   GROUP BY day
                   ORDER BY day DESC
                   LIMIT ?""", (days,)
            ).fetchall()
            return [dict(r) for r in rows]

    def get_campaign_trend(self, days: int = 30) -> List[dict]:
        self._init_campaign_log()
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                """SELECT DATE(sent_at) as day,
                          COUNT(*) as total,
                          SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) as sent,
                          SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) as failed
                   FROM campaign_log
                   WHERE sent_at IS NOT NULL
                   GROUP BY day
                   ORDER BY day DESC
                   LIMIT ?""", (days,)
            ).fetchall()
            return [dict(r) for r in rows]

    def delete_lead(self, lead_id: int) -> bool:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("DELETE FROM leads WHERE id = ?", (lead_id,))
            return conn.total_changes > 0

    def delete_leads(self, lead_ids: List[int]) -> int:
        if not lead_ids:
            return 0
        with sqlite3.connect(self.db_path) as conn:
            placeholders = ",".join("?" for _ in lead_ids)
            conn.execute(f"DELETE FROM leads WHERE id IN ({placeholders})", lead_ids)
            return conn.total_changes

    def delete_all(self, category: Optional[str] = None,
                   state: Optional[str] = None,
                   city: Optional[str] = None) -> int:
        with sqlite3.connect(self.db_path) as conn:
            query = "DELETE FROM leads WHERE 1=1"
            params = []
            if category:
                query += " AND category = ?"
                params.append(category)
            if state:
                query += " AND state = ?"
                params.append(state)
            if city:
                query += " AND city = ?"
                params.append(city)
            conn.execute(query, params)
            return conn.total_changes

    def stats(self) -> dict:
        with sqlite3.connect(self.db_path) as conn:
            total = conn.execute("SELECT COUNT(*) FROM leads").fetchone()[0]
            with_phone = conn.execute("SELECT COUNT(*) FROM leads WHERE phone IS NOT NULL AND phone != ''").fetchone()[0]
            with_website = conn.execute("SELECT COUNT(*) FROM leads WHERE website IS NOT NULL AND website != ''").fetchone()[0]
            with_address = conn.execute("SELECT COUNT(*) FROM leads WHERE address IS NOT NULL AND address != ''").fetchone()[0]
            avg_rating = conn.execute("SELECT AVG(rating) FROM leads WHERE rating IS NOT NULL").fetchone()[0]
            by_status = dict(conn.execute("SELECT status, COUNT(*) FROM leads GROUP BY status").fetchall())
            by_category = dict(conn.execute("SELECT category, COUNT(*) FROM leads GROUP BY category").fetchall())
            by_location = dict(conn.execute("SELECT location, COUNT(*) FROM leads GROUP BY location").fetchall())
            by_state = dict(conn.execute("SELECT state, COUNT(*) FROM leads WHERE state IS NOT NULL GROUP BY state ORDER BY COUNT(*) DESC").fetchall())
            return {
                "total": total,
                "with_phone": with_phone,
                "with_website": with_website,
                "with_address": with_address,
                "avg_rating": round(avg_rating, 2) if avg_rating else 0,
                "by_status": by_status,
                "by_category": by_category,
                "by_location": by_location,
                "by_state": by_state,
            }
