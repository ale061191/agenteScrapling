-- Ejecutar esto en el SQL Editor de Supabase (https://supabase.com/dashboard/project/vdknyyempgailnbnxeqz/sql/new)

CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
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
    source TEXT NOT NULL DEFAULT 'google_maps',
    source_url TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'frio',
    changed_at TEXT,
    timestamp TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_log (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL,
    recipient TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT '',
    error TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_category ON leads(category);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_state ON leads(state);
CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city);
CREATE INDEX IF NOT EXISTS idx_campaign_lead_id ON campaign_log(lead_id);
