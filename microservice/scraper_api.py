"""
Lead Finder Microservice - REST API para scraping
Desplegado en Render.com (free tier)
Llama a este endpoint desde Vercel para ejecutar búsquedas.
"""

import os
import sys
import json
import asyncio
import re
from datetime import datetime
from supabase import create_client, Client
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── Supabase Config ───
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    # Try to load from env file for local testing
    try:
        with open(".env.local") as f:
            for line in f:
                if "=" in line:
                    k, v = line.strip().split("=", 1)
                    os.environ.setdefault(k, v)
        SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
        SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
    except:
        pass

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ─── FastAPI App ───
app = FastAPI(title="Lead Finder Microservice")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Models ───
class SearchRequest(BaseModel):
    category: str
    state: str
    city: str
    parish: Optional[str] = None
    sector: Optional[str] = None
    deep: bool = True
    googleSearch: bool = False
    paginasAmarillas: bool = False
    social: bool = False
    tiktok: bool = False
    instagram: bool = False
    maxDeep: Optional[int] = None

class SearchResponse(BaseModel):
    jobId: str
    status: str
    leadsFound: Optional[int] = None
    message: str

# ─── Helpers ───
def get_location(state: str, city: str) -> str:
    """Construct location string for API queries"""
    return f"{city}, {state}, Venezuela"

def slugify(text: str) -> str:
    return text.lower().replace(" ", "_").replace("ñ", "n").replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")

def clean_phone(phone_str: str) -> str:
    """Clean and validate Venezuelan phone numbers"""
    if not phone_str:
        return ""
    phone = re.sub(r'[^\d+]', '', str(phone_str))
    if phone.startswith("58") and len(phone) > 10:
        return f"+{phone}"
    if len(phone) == 10 and phone.startswith("412"):
        return f"+58{phone}"
    if len(phone) == 11 and phone.startswith("0412"):
        return f"+58{phone[1:]}"
    return phone if phone else ""

def clean_url(url: str) -> str:
    if not url:
        return ""
    url = str(url).strip()
    if url and not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url

async def scrape_google_maps(category: str, state: str, city: str, deep: bool = True, max_deep: int = 5) -> List[dict]:
    """Scrape Google Maps using the maps.py spider logic"""
    try:
        from scrapling import StealthySession
        
        location = get_location(state, city)
        search_url = f"https://www.google.com/maps/search/{category}+en+{location.replace(' ', '+')}/"
        
        logger.info(f"Starting scrape: {search_url}")
        
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
        for _ in range(20):
            try:
                page.evaluate('document.querySelectorAll(".fontHeadlineSmall")[0]?.scrollIntoView()')
                page.wait(600)
            except:
                break
        
        # Extract place cards
        places = page.evaluate('''
            () => {
                const cards = document.querySelectorAll('[data-categorical-id]');
                return Array.from(cards).map(card => {
                    const nameEl = card.querySelector('.fontHeadlineSmall') || card.querySelector('.qBF1Pd');
                    const ratingEl = card.querySelector('.ZkPwu') || card.querySelector('[aria-label*="estrel"]');
                    const reviewsEl = card.querySelector('.TyH0Cd') || card.querySelector('.ODfHxe');
                    const addressEl = card.querySelector('.W4VJmc') || card.querySelector('.fontBodyMedium');
                    const phoneEl = card.querySelector('.USJqEc') || card.querySelector('.CFH2De');
                    const categoryEl = card.querySelector('.dSVPB') || card.querySelector('.wNXCwl');
                    
                    const name = nameEl?.textContent?.trim() || '';
                    const ratingStr = ratingEl?.getAttribute('aria-label') || ratingEl?.textContent || '';
                    const rating = ratingStr.includes('estrel') ? parseFloat(ratingStr.replace(/[^0-9.,]/g, '').replace(',', '.')) : null;
                    const reviewsStr = reviewsEl?.textContent?.replace(/[^0-9]/g, '') || '0';
                    const reviews = parseInt(reviewsStr) || 0;
                    const address = addressEl?.textContent?.trim() || '';
                    const phone = phoneEl?.textContent?.trim() || '';
                    const category = categoryEl?.textContent?.trim() || '';
                    
                    const link = card.querySelector('a')?.href || '';
                    const isAd = !!card.querySelector('.SiBjxf') || !!card.querySelector('[data-ad]');
                    
                    return { name, rating, reviews, address, phone, category, link, isAd };
                }).filter(p => p.name && !p.isAd);
            }
        ''')
        
        logger.info(f"Found {len(places)} places, deep={deep}")
        
        leads = []
        seen = set()
        
        for place in places[:30]:
            if place['name'] in seen:
                continue
            seen.add(place['name'])
            
            lead = {
                'name': place['name'],
                'category': category,
                'location': f"{city}, {state}",
                'state': state,
                'city': city,
                'address': place.get('address', '') or '',
                'phone': clean_phone(place.get('phone', '')),
                'rating': place.get('rating'),
                'reviews_count': place.get('reviews', 0),
                'source': 'google_maps',
                'source_url': place.get('link', ''),
                'status': 'frio',
                'timestamp': datetime.now().isostring(),
                'notes': '',
            }
            
            if deep and place.get('link'):
                try:
                    detail_page = session.get(place['link'])
                    detail_page.wait(1000)
                    
                    website = detail_page.evaluate('''
                        () => {
                            const websiteLink = document.querySelector('a[data-item-id="authority"]') 
                                || document.querySelector('a[aria-label*="sitio web"]')
                                || document.querySelector('a[href*="://"]');
                            return websiteLink?.href || '';
                        }
                    ''')
                    
                    email = detail_page.evaluate('''
                        () => {
                            const emailLink = document.querySelector('a[href^="mailto:"]');
                            return emailLink?.href?.replace('mailto:', '') || '';
                        }
                    ''')
                    
                    lead['website'] = clean_url(website)
                    lead['email'] = email or ''
                    
                    # Social links
                    page_text = detail_page.text or ''
                    fb = re.search(r'facebook\.com/[\w-]+', page_text)
                    ig = re.search(r'instagram\.com/[\w-]+', page_text)
                    tw = re.search(r'twitter\.com/[\w-]+|x\.com/[\w-]+', page_text)
                    
                    lead['facebook'] = f"https://{fb.group(0)}" if fb else ''
                    lead['instagram'] = f"https://{ig.group(0)}" if ig else ''
                    lead['twitter'] = f"https://{tw.group(0)}" if tw else ''
                    
                    logger.info(f"  Deep data for: {place['name']}")
                    
                except Exception as e:
                    logger.warning(f"  Deep scrape failed for {place['name']}: {e}")
            
            leads.append(lead)
        
        return leads
        
    except Exception as e:
        logger.error(f"Scraping error: {e}")
        return []

async def save_leads_to_supabase(leads: List[dict]) -> int:
    """Save leads to Supabase, skip duplicates"""
    if not supabase or not leads:
        return 0
    
    saved = 0
    for lead in leads:
        try:
            # Check for existing lead with same name + address
            existing = supabase.from_('leads').select('id').eq('name', lead['name']).eq('address', lead.get('address', '')).execute()
            
            if existing.data:
                continue  # Skip duplicate
            
            data = {k: v for k, v in lead.items() if v is not None and v != ''}
            data['rating'] = data.get('rating') or None
            data['reviews_count'] = data.get('reviews_count') or 0
            
            supabase.from_('leads').insert(data).execute()
            saved += 1
            logger.info(f"Saved: {lead['name']}")
        except Exception as e:
            logger.warning(f"Failed to save {lead['name']}: {e}")
    
    return saved

# ─── Routes ───
@app.get("/")
async def root():
    return {"status": "ok", "service": "Lead Finder Microservice", "time": datetime.now().isostring()}

@app.get("/health")
async def health():
    has_supabase = supabase is not None
    return {
        "status": "healthy",
        "supabase_connected": has_supabase,
        "time": datetime.now().isostring()
    }

@app.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    """Execute a lead search and save results to Supabase"""
    
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase no configurado")
    
    job_id = f"search_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    logger.info(f"Starting job {job_id}: {request.category} in {request.city}, {request.state}")
    
    try:
        # Run the scrape
        leads = await scrape_google_maps(
            category=request.category,
            state=request.state,
            city=request.city,
            deep=request.deep,
            max_deep=request.maxDeep or 5,
        )
        
        # Save to Supabase
        saved_count = await save_leads_to_supabase(leads)
        
        logger.info(f"Job {job_id} completed: {saved_count} new leads saved")
        
        return SearchResponse(
            jobId=job_id,
            status="done",
            leadsFound=saved_count,
            message=f"{saved_count} leads guardados en {request.city}, {request.state}"
        )
        
    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats")
async def stats():
    """Return current stats from Supabase"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase no configurado")
    
    try:
        result = supabase.from_('leads').select("status, category, state", count="exact").execute()
        total = len(result.data)
        by_status = {}
        by_category = {}
        by_state = {}
        
        for lead in result.data:
            s = lead.get('status', 'frio')
            by_status[s] = by_status.get(s, 0) + 1
            cat = lead.get('category', 'unknown')
            by_category[cat] = by_category.get(cat, 0) + 1
            st = lead.get('state', 'unknown')
            by_state[st] = by_state.get(st, 0) + 1
        
        return {"total": total, "byStatus": by_status, "byCategory": by_category, "byState": by_state}
    except Exception as e:
        logger.error(f"Stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)