"""
Lead Finder Desktop - Python Backend API Server
Flask server that handles scraping, local SQLite storage, and Supabase sync.
Run with: python api_server.py
"""

import os
import sys
import json
import sqlite3
import logging
import re
from datetime import datetime
from pathlib import Path
from threading import Thread
import time

from flask import Flask, request, jsonify, g
from flask_cors import CORS

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Flask app
app = Flask(__name__)
CORS(app)

# Configuration
DATABASE_URL = os.environ.get('DATABASE_URL', '')
PORT = int(os.environ.get('PORT', 8765))
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')

# Valid statuses
VALID_STATUSES = ['frio', 'tibio', 'caliente', 'contactado', 'aceptado', 'rechazado']

# ─── Database Helpers ────────────────────────────────────────────

def get_db():
    """Get database connection for current request"""
    if 'db' not in g:
        db_path = DATABASE_URL if DATABASE_URL else get_default_db_path()
        g.db = sqlite3.connect(db_path, check_same_thread=False)
        g.db.row_factory = sqlite3.Row
    return g.db

def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def get_default_db_path():
    """Get default database path"""
    if getattr(sys, 'frozen', False):
        base = Path(sys.executable).parent
    else:
        base = Path(__file__).parent
    return str(base / 'leads.db')

def init_db():
    """Initialize database schema"""
    db = get_db()
    db.executescript('''
        CREATE TABLE IF NOT EXISTS leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT DEFAULT '',
            location TEXT DEFAULT '',
            state TEXT DEFAULT '',
            city TEXT DEFAULT '',
            address TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            website TEXT DEFAULT '',
            email TEXT DEFAULT '',
            facebook TEXT DEFAULT '',
            instagram TEXT DEFAULT '',
            twitter TEXT DEFAULT '',
            rating REAL,
            reviews_count INTEGER DEFAULT 0,
            source TEXT DEFAULT 'google_maps',
            source_url TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            status TEXT DEFAULT 'frio',
            changed_at TEXT,
            synced INTEGER DEFAULT 0,
            timestamp TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS sync_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            lead_id INTEGER,
            data TEXT,
            timestamp TEXT NOT NULL,
            synced INTEGER DEFAULT 0
        );
        
        CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
        CREATE INDEX IF NOT EXISTS idx_leads_state ON leads(state);
        CREATE INDEX IF NOT EXISTS idx_leads_category ON leads(category);
        CREATE INDEX IF NOT EXISTS idx_leads_synced ON leads(synced);
    ''')
    db.commit()
    logger.info(f"Database initialized at {get_default_db_path()}")

def row_to_lead(row):
    """Convert sqlite Row to dict"""
    if row is None:
        return None
    return {
        'id': row['id'],
        'name': row['name'],
        'category': row['category'] or '',
        'location': row['location'] or '',
        'state': row['state'] or '',
        'city': row['city'] or '',
        'address': row['address'] or '',
        'phone': row['phone'] or '',
        'website': row['website'] or '',
        'email': row['email'] or '',
        'facebook': row['facebook'] or '',
        'instagram': row['instagram'] or '',
        'twitter': row['twitter'] or '',
        'rating': row['rating'],
        'reviews_count': row['reviews_count'] or 0,
        'source': row['source'] or 'google_maps',
        'source_url': row['source_url'] or '',
        'notes': row['notes'] or '',
        'status': row['status'] or 'frio',
        'changed_at': row['changed_at'] or None,
        'timestamp': row['timestamp'] or '',
    }

# ─── API Routes ────────────────────────────────────────────────

@app.route('/health')
def health():
    """Health check endpoint"""
    try:
        db = get_db()
        cursor = db.execute('SELECT COUNT(*) as count FROM leads')
        lead_count = cursor.fetchone()['count']
        return jsonify({
            'status': 'healthy',
            'leads_count': lead_count,
            'supabase_configured': bool(SUPABASE_URL and SUPABASE_KEY),
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/')
def root():
    """Root endpoint"""
    return jsonify({
        'service': 'Lead Finder Desktop API',
        'version': '1.0.0',
        'endpoints': ['/health', '/leads', '/search', '/stats', '/sync']
    })

# ─── Leads CRUD ─────────────────────────────────────────────────

@app.route('/leads', methods=['GET'])
def get_leads():
    """Get all leads with optional filters"""
    db = get_db()
    
    query = 'SELECT * FROM leads WHERE 1=1'
    params = {}
    
    if request.args.get('status'):
        query += ' AND status = :status'
        params['status'] = request.args.get('status')
    
    if request.args.get('category'):
        query += ' AND category = :category'
        params['category'] = request.args.get('category')
    
    if request.args.get('state'):
        query += ' AND state = :state'
        params['state'] = request.args.get('state')
    
    if request.args.get('city'):
        query += ' AND city = :city'
        params['city'] = request.args.get('city')
    
    if request.args.get('search'):
        search = f"%{request.args.get('search')}%"
        query += ' AND (name LIKE :search OR address LIKE :search OR notes LIKE :search)'
        params['search'] = search
    
    query += ' ORDER BY changed_at DESC, id DESC'
    
    cursor = db.execute(query, params)
    leads = [row_to_lead(row) for row in cursor.fetchall()]
    
    return jsonify({' leads': leads, 'total': len(leads) })

@app.route('/leads/<int:lead_id>', methods=['GET'])
def get_lead(lead_id):
    """Get single lead by ID"""
    db = get_db()
    cursor = db.execute('SELECT * FROM leads WHERE id = :id', {'id': lead_id})
    row = cursor.fetchone()
    
    if row is None:
        return jsonify({'error': 'Lead not found'}), 404
    
    return jsonify({'lead': row_to_lead(row)})

@app.route('/leads', methods=['POST'])
def create_lead():
    """Create a new lead"""
    data = request.json
    
    if not data or not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400
    
    db = get_db()
    now = datetime.now().isoformat()
    
    db.execute('''
        INSERT INTO leads (name, category, location, state, city, address, phone, website, 
                          email, facebook, instagram, twitter, rating, reviews_count, 
                          source, source_url, notes, status, timestamp)
        VALUES (:name, :category, :location, :state, :city, :address, :phone, :website,
                :email, :facebook, :instagram, :twitter, :rating, :reviews_count,
                :source, :source_url, :notes, :status, :timestamp)
    ''', {
        'name': data.get('name', ''),
        'category': data.get('category', ''),
        'location': data.get('location', ''),
        'state': data.get('state', ''),
        'city': data.get('city', ''),
        'address': data.get('address', ''),
        'phone': data.get('phone', ''),
        'website': data.get('website', ''),
        'email': data.get('email', ''),
        'facebook': data.get('facebook', ''),
        'instagram': data.get('instagram', ''),
        'twitter': data.get('twitter', ''),
        'rating': data.get('rating'),
        'reviews_count': data.get('reviews_count', 0),
        'source': data.get('source', 'google_maps'),
        'source_url': data.get('source_url', ''),
        'notes': data.get('notes', ''),
        'status': data.get('status', 'frio'),
        'timestamp': now,
    })
    
    lead_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]
    db.commit()
    
    # Log sync
    db.execute('INSERT INTO sync_log (action, lead_id, timestamp, synced) VALUES (?, ?, ?, 0)',
               ('create', lead_id, now))
    db.commit()
    
    return jsonify({'id': lead_id, 'message': 'Lead created'}), 201

@app.route('/leads/<int:lead_id>', methods=['PATCH'])
def update_lead(lead_id):
    """Update lead status and/or notes"""
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    db = get_db()
    now = datetime.now().isoformat()
    
    updates = []
    params = {'id': lead_id}
    
    if 'status' in data:
        status = data['status'].lower()
        if status not in VALID_STATUSES:
            return jsonify({'error': f'Invalid status. Must be one of: {VALID_STATUSES}'}), 400
        updates.append('status = :status')
        updates.append("changed_at = :changed_at")
        params['status'] = status
        params['changed_at'] = now
    
    if 'notes' in data:
        updates.append('notes = :notes')
        params['notes'] = data['notes']
    
    if not updates:
        return jsonify({'error': 'No valid fields to update'}), 400
    
    updates.append('synced = 0')
    
    query = f"UPDATE leads SET {', '.join(updates)} WHERE id = :id"
    cursor = db.execute(query, params)
    db.commit()
    
    if cursor.rowcount == 0:
        return jsonify({'error': 'Lead not found'}), 404
    
    # Log sync
    db.execute('INSERT INTO sync_log (action, lead_id, data, timestamp, synced) VALUES (?, ?, ?, ?, 0)',
               ('update', lead_id, json.dumps(data), now))
    db.commit()
    
    return jsonify({'success': True, 'message': 'Lead updated'})

@app.route('/leads/<int:lead_id>', methods=['DELETE'])
def delete_lead(lead_id):
    """Delete a lead"""
    db = get_db()
    
    cursor = db.execute('SELECT id FROM leads WHERE id = ?', (lead_id,))
    if cursor.fetchone() is None:
        return jsonify({'error': 'Lead not found'}), 404
    
    db.execute('DELETE FROM leads WHERE id = ?', (lead_id,))
    db.execute('INSERT INTO sync_log (action, lead_id, timestamp, synced) VALUES (?, ?, ?, 0)',
               ('delete', lead_id, datetime.now().isoformat()))
    db.commit()
    
    return jsonify({'success': True, 'message': 'Lead deleted'})

@app.route('/leads/bulk-delete', methods=['POST'])
def bulk_delete_leads():
    """Delete multiple leads"""
    data = request.json
    ids = data.get('ids', [])
    
    if not ids:
        return jsonify({'error': 'No IDs provided'}), 400
    
    db = get_db()
    placeholders = ','.join(['?'] * len(ids))
    now = datetime.now().isoformat()
    
    db.execute(f'DELETE FROM leads WHERE id IN ({placeholders})', ids)
    
    for lead_id in ids:
        db.execute('INSERT INTO sync_log (action, lead_id, timestamp, synced) VALUES (?, ?, ?, 0)',
                   ('delete', lead_id, now))
    
    db.commit()
    
    return jsonify({'success': True, 'deleted': len(ids)})

# ─── Search / Scraping ──────────────────────────────────────────

@app.route('/search', methods=['POST'])
def search():
    """Execute a Google Maps search and save results"""
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    category = data.get('category', '')
    state = data.get('state', '')
    city = data.get('city', '')
    deep = data.get('deep', True)
    
    if not category or not state or not city:
        return jsonify({'error': 'category, state, and city are required'}), 400
    
    logger.info(f"Starting search: {category} in {city}, {state} (deep={deep})")
    
    # Run scraping in background thread
    thread = Thread(target=run_scraper, args=(category, state, city, deep, data))
    thread.daemon = True
    thread.start()
    
    return jsonify({
        'jobId': f"search_{int(time.time())}",
        'status': 'running',
        'message': f'Buscando {category} en {city}, {state}...'
    })

def run_scraper(category, state, city, deep, options):
    """Background scraping function"""
    try:
        from scrapling import StealthySession
        
        location = f"{city}, {state}, Venezuela"
        search_url = f"https://www.google.com/maps/search/{category.replace(' ', '+')}+en+{location.replace(' ', '+')}/"
        
        logger.info(f"Fetching: {search_url}")
        
        session = StealthySession()
        session.set_option('timeout', 30000)
        session.set_option('retry_limit', 3)
        
        page = session.get(search_url)
        
        # Handle cookie consent
        try:
            page.evaluate('document.querySelector("button[aria-label*=\'Aceptar\']")?.click()')
            page.wait(500)
        except:
            pass
        
        # Scroll to load more results
        for i in range(20):
            try:
                page.evaluate('window.scrollBy(0, 500)')
                page.wait(600)
            except:
                break
        
        # Extract place data
        places = page.evaluate('''
            () => {
                const cards = document.querySelectorAll('[data-categorical-id], .Nv2PK');
                return Array.from(cards).map(card => {
                    const nameEl = card.querySelector('.fontHeadlineSmall') || card.querySelector('.qBF1Pd') || card.querySelector('.qJiOh');
                    const ratingEl = card.querySelector('.ZkPwu') || card.querySelector('[aria-label*="estrel"]') || card.querySelector('.cX2S9');
                    const reviewsEl = card.querySelector('.TyH0Cd') || card.querySelector('.ODfHxe');
                    const addressEl = card.querySelector('.W4VJmc') || card.querySelector('.fontBodyMedium');
                    const phoneEl = card.querySelector('.USJqEc') || card.querySelector('.CFH2De');
                    const link = card.querySelector('a')?.href || '';
                    
                    const name = nameEl?.textContent?.trim() || '';
                    const ratingStr = ratingEl?.getAttribute('aria-label') || ratingEl?.textContent || '';
                    const rating = ratingStr.includes('estrel') ? parseFloat(ratingStr.replace(/[^0-9.,]/g, '').replace(',', '.')) : null;
                    const reviewsStr = reviewsEl?.textContent?.replace(/[^0-9]/g, '') || '0';
                    const reviews = parseInt(reviewsStr) || 0;
                    const address = addressEl?.textContent?.trim() || '';
                    const phone = phoneEl?.textContent?.trim() || '';
                    
                    return { name, rating, reviews, address, phone, link };
                }).filter(p => p.name && !p.name.includes(' Sponsored ') && !p.name.includes(' Anuncio '));
            }
        ''')
        
        logger.info(f"Found {len(places)} places")
        
        db = get_db()
        saved_count = 0
        now = datetime.now().isoformat()
        
        for place in places[:50]:  # Limit to 50 results
            # Check for duplicate
            cursor = db.execute('SELECT id FROM leads WHERE name = ? AND address = ?', 
                               (place['name'], place.get('address', '')))
            if cursor.fetchone():
                continue
            
            # Clean phone
            phone = place.get('phone', '') or ''
            if phone:
                phone = re.sub(r'[^\d+]', '', phone)
                if phone.startswith('58') and len(phone) > 10:
                    phone = f"+{phone}"
                elif len(phone) == 10 and phone.startswith('412'):
                    phone = f"+58{phone}"
            
            # Clean URL
            website_url = ''
            if deep and place.get('link'):
                try:
                    detail_page = session.get(place['link'])
                    detail_page.wait(800)
                    
                    website_url = detail_page.evaluate('''
                        () => {
                            const link = document.querySelector('a[data-item-id="authority"]') 
                                || document.querySelector('a[aria-label*="sitio web"]')
                                || document.querySelector('a[href*="://"]');
                            return link?.href || '';
                        }
                    ''') or ''
                    
                    email = detail_page.evaluate('''
                        () => {
                            const el = document.querySelector('a[href^="mailto:"]');
                            return el?.href?.replace('mailto:', '') || '';
                        }
                    ''') or ''
                    
                    # Social links
                    page_text = detail_page.text or ''
                    fb = re.search(r'facebook\.com/[\w-]+', page_text)
                    ig = re.search(r'instagram\.com/[\w-]+', page_text)
                    tw = re.search(r'twitter\.com/[\w-]+|x\.com/[\w-]+', page_text)
                    
                    facebook_url = f"https://{fb.group(0)}" if fb else ''
                    instagram_url = f"https://{ig.group(0)}" if ig else ''
                    twitter_url = f"https://{tw.group(0)}" if tw else ''
                    
                    place['website'] = website_url
                    place['email'] = email
                    place['facebook'] = facebook_url
                    place['instagram'] = instagram_url
                    place['twitter'] = twitter_url
                    
                    logger.info(f"  Deep data: {place['name']}")
                    
                except Exception as e:
                    logger.warning(f"  Deep scrape error for {place['name']}: {e}")
            
            # Insert lead
            db.execute('''
                INSERT INTO leads (name, category, location, state, city, address, phone, website,
                                  email, facebook, instagram, twitter, rating, reviews_count,
                                  source, source_url, status, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                place['name'],
                category,
                f"{city}, {state}",
                state,
                city,
                place.get('address', ''),
                phone,
                place.get('website', ''),
                place.get('email', ''),
                place.get('facebook', ''),
                place.get('instagram', ''),
                place.get('twitter', ''),
                place.get('rating'),
                place.get('reviews', 0),
                'google_maps',
                place.get('link', ''),
                'frio',
                now,
            ))
            saved_count += 1
        
        db.commit()
        logger.info(f"Search complete: {saved_count} new leads saved")
        
    except Exception as e:
        logger.error(f"Scraping error: {e}")
        import traceback
        traceback.print_exc()

# ─── Stats ─────────────────────────────────────────────────────

@app.route('/stats', methods=['GET'])
def get_stats():
    """Get lead statistics"""
    db = get_db()
    
    cursor = db.execute('SELECT * FROM leads')
    leads = cursor.fetchall()
    
    total = len(leads)
    with_phone = sum(1 for l in leads if l['phone'])
    with_website = sum(1 for l in leads if l['website'])
    ratings = [l['rating'] for l in leads if l['rating'] is not None]
    avg_rating = sum(ratings) / len(ratings) if ratings else 0
    
    by_status = {}
    by_category = {}
    by_state = {}
    
    for lead in leads:
        s = lead['status']
        by_status[s] = by_status.get(s, 0) + 1
        
        cat = lead['category'] or 'unknown'
        by_category[cat] = by_category.get(cat, 0) + 1
        
        st = lead['state'] or 'unknown'
        by_state[st] = by_state.get(st, 0) + 1
    
    return jsonify({
        'total': total,
        'withPhone': with_phone,
        'withWebsite': with_website,
        'avgRating': round(avg_rating, 2),
        'byStatus': by_status,
        'byCategory': by_category,
        'byState': by_state,
    })

# ─── Supabase Sync ──────────────────────────────────────────────

@app.route('/sync', methods=['POST'])
def sync_to_cloud():
    """Sync local leads to Supabase"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return jsonify({'error': 'Supabase not configured', 'synced': 0}), 400
    
    try:
        from supabase import create_client
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        db = get_db()
        
        # Get unsynced leads
        cursor = db.execute('SELECT * FROM leads WHERE synced = 0')
        leads = cursor.fetchall()
        
        synced_count = 0
        for lead in leads:
            lead_data = row_to_lead(lead)
            
            # Check if exists in Supabase
            existing = supabase.from_('leads').select('id').eq('name', lead_data['name']).eq('address', lead_data.get('address', '')).execute()
            
            if existing.data:
                # Update existing
                supabase.from_('leads').update({
                    'category': lead_data['category'],
                    'location': lead_data['location'],
                    'state': lead_data['state'],
                    'city': lead_data['city'],
                    'address': lead_data['address'],
                    'phone': lead_data['phone'],
                    'website': lead_data['website'],
                    'email': lead_data['email'],
                    'facebook': lead_data['facebook'],
                    'instagram': lead_data['instagram'],
                    'twitter': lead_data['twitter'],
                    'rating': lead_data['rating'],
                    'reviews_count': lead_data['reviews_count'],
                    'notes': lead_data['notes'],
                    'status': lead_data['status'],
                    'changed_at': lead_data.get('changed_at'),
                }).eq('id', existing.data[0]['id']).execute()
            else:
                # Insert new
                supabase.from_('leads').insert(lead_data).execute()
            
            # Mark as synced
            db.execute('UPDATE leads SET synced = 1 WHERE id = ?', (lead['id'],))
            synced_count += 1
        
        # Handle deletions
        sync_log = db.execute("SELECT * FROM sync_log WHERE action = 'delete' AND synced = 0").fetchall()
        for log in sync_log:
            try:
                supabase.from_('leads').delete().eq('id', log['lead_id']).execute()
                db.execute('UPDATE sync_log SET synced = 1 WHERE id = ?', (log['id'],))
            except:
                pass
        
        db.commit()
        
        logger.info(f"Sync complete: {synced_count} leads synced to Supabase")
        
        return jsonify({
            'success': True,
            'synced': synced_count,
            'message': f'{synced_count} leads synced to cloud'
        })
        
    except Exception as e:
        logger.error(f"Sync error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e), 'synced': 0}), 500

@app.route('/sync/pull', methods=['POST'])
def pull_from_cloud():
    """Pull leads from Supabase to local"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return jsonify({'error': 'Supabase not configured'}), 400
    
    try:
        from supabase import create_client
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        result = supabase.from_('leads').select('*').execute()
        cloud_leads = result.data
        
        db = get_db()
        pulled = 0
        
        for lead in cloud_leads:
            cursor = db.execute('SELECT id FROM leads WHERE name = ? AND address = ?',
                               (lead['name'], lead.get('address', '')))
            existing = cursor.fetchone()
            
            if not existing:
                db.execute('''
                    INSERT INTO leads (name, category, location, state, city, address, phone, website,
                                      email, facebook, instagram, twitter, rating, reviews_count,
                                      source, source_url, notes, status, changed_at, timestamp, synced)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                ''', (
                    lead['name'], lead.get('category', ''), lead.get('location', ''),
                    lead.get('state', ''), lead.get('city', ''), lead.get('address', ''),
                    lead.get('phone', ''), lead.get('website', ''), lead.get('email', ''),
                    lead.get('facebook', ''), lead.get('instagram', ''), lead.get('twitter', ''),
                    lead.get('rating'), lead.get('reviews_count', 0), lead.get('source', 'google_maps'),
                    lead.get('source_url', ''), lead.get('notes', ''), lead.get('status', 'frio'),
                    lead.get('changed_at'), lead.get('timestamp', datetime.now().isoformat()),
                ))
                pulled += 1
        
        db.commit()
        
        logger.info(f"Pull complete: {pulled} leads pulled from Supabase")
        
        return jsonify({
            'success': True,
            'pulled': pulled,
            'message': f'{pulled} leads pulled from cloud'
        })
        
    except Exception as e:
        logger.error(f"Pull error: {e}")
        return jsonify({'error': str(e)}), 500

# ─── Error Handlers ─────────────────────────────────────────────

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Internal server error'}), 500

# ─── Main ───────────────────────────────────────────────────────

if __name__ == '__main__':
    logger.info("Starting Lead Finder Desktop API Server...")
    logger.info(f"Database: {DATABASE_URL or get_default_db_path()}")
    logger.info(f"Port: {PORT}")
    logger.info(f"Supabase: {'Configured' if SUPABASE_URL and SUPABASE_KEY else 'Not configured'}")
    
    # Initialize database
    with app.app_context():
        init_db()
    
    # Run server
    logger.info("Flask server started")
    app.run(host='127.0.0.1', port=PORT, debug=False, threaded=True)