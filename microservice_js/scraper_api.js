/**
 * Lead Finder Microservice - Node.js + Playwright
 * Desplegado en Render.com (free tier)
 * Unext.js dashboard en Vercel llama a este endpoint para ejecutar búsquedas.
 */

const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ─── Supabase Config ───
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('[OK] Supabase conectado');
} else {
  console.log('[WARN] Supabase no configurado - guardando solo en JSON local');
}

// ─── Helpers ───
function getLocation(state, city) {
  return `${city}, ${state}, Venezuela`;
}

function slugify(text) {
  return text.toLowerCase()
    .replace(/ /g, '_')
    .replace(/ñ/g, 'n')
    .replace(/á/g, 'a')
    .replace(/é/g, 'e')
    .replace(/í/g, 'i')
    .replace(/ó/g, 'o')
    .replace(/ú/g, 'u');
}

function cleanPhone(phoneStr) {
  if (!phoneStr) return '';
  let phone = phoneStr.replace(/[^\d+]/g, '');
  if (phone.startsWith('58') && phone.length > 10) return `+${phone}`;
  if (phone.length === 10 && phone.startsWith('412')) return `+58${phone}`;
  if (phone.length === 11 && phone.startsWith('0412')) return `+58${phone.substring(1)}`;
  return phone || '';
}

function cleanUrl(url) {
  if (!url) return '';
  url = url.trim();
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url;
}

// ─── Scraper ───
async function scrapeGoogleMaps(category, state, city, deep = true, maxDeep = 5) {
  const location = getLocation(state, city);
  const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(category + ' en ' + location).replace(/%20/g, '+')}`;

  console.log(`[SCRAPER] Navegando a: ${searchUrl}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    locale: 'es-ES',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  // Bloquear recursos innecesarios para acelerar
  await context.route('**/*.{png,jpg,jpeg,gif,css,woff,woff2,font}', route => route.abort());

  try {
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('[SCRAPER] Página cargada');

    // Aceptar cookies si aparece el popup
    try {
      const acceptBtn = page.locator('button[aria-label*="Aceptar"], button[aria-label*="Accept"]').first();
      if (await acceptBtn.isVisible({ timeout: 3000 })) {
        await acceptBtn.click();
        console.log('[SCRAPER] Popup de cookies aceptado');
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      // No hay popup, continuar
    }

    // Scroll para cargar más resultados
    console.log('[SCRAPER] Haciendo scroll para cargar resultados...');
    for (let i = 0; i < 15; i++) {
      try {
        await page.evaluate(() => {
          const feed = document.querySelector('[role="feed"]');
          if (feed) {
            feed.scrollBy(0, feed.clientHeight || 500);
          } else {
            window.scrollBy(0, window.innerHeight || 500);
          }
        });
        await page.waitForTimeout(800);
      } catch (e) {
        break;
      }
    }

    // Extraer datos de las tarjetas
    const places = await page.evaluate(() => {
      const feed = document.querySelector('[role="feed"]');
      if (!feed) return [];

      const articles = feed.querySelectorAll('div[role="article"]');
      const results = [];
      const seen = new Set();

      articles.forEach(article => {
        if (seen.has(article)) return;
        seen.add(article);

        let name = article.getAttribute('aria-label') || '';
        if (!name || name.length < 2) {
          const ne = article.querySelector('.fontHeadlineSmall, [role="heading"], h1, h2, h3');
          if (ne) name = (ne.textContent || '').trim();
        }
        if (!name || name.length < 2) return;

        let rating = null, reviews = null;
        const reImg = article.querySelector('[role="img"][aria-label]');
        if (reImg) {
          const lbl = reImg.getAttribute('aria-label') || '';
          const rm = lbl.match(/([\d.,]+)/);
          if (rm) rating = parseFloat(rm[1].replace(',', '.'));
          const rvm = lbl.match(/\((\d+)\s*/);
          if (rvm) reviews = parseInt(rvm[1]);
        }

        let phone = '', website = '';
        article.querySelectorAll('a[href]').forEach(a => {
          const h = a.href || '';
          if (h.startsWith('tel:')) phone = h.replace('tel:', '').split('?')[0];
          else if (h.startsWith('http') && !h.includes('google.com/maps') && !h.includes('google.com/search') && !website) website = h;
        });

        // Extraer dirección de las secciones
        const sections = article.querySelectorAll('.W4Efsd, .fontBodyMedium');
        let address = '';
        const allLines = [];
        sections.forEach(sec => {
          const txt = sec.textContentContent || sec.textContent || '';
          const lines = txt.split('\n').map(s => s.trim()).filter(Boolean);
          lines.forEach(l => allLines.push(l));
        });

        // Buscar línea que parezca dirección
        const addrPatterns = ['Calle', 'Av.', 'Avenida', 'Carretera', 'Urb.', 'Urbanizacion', 'Carrera', 'Edif.', 'Edificio', 'Centro Comercial', 'CC ', 'Local ', 'Sector ', 'Barrio ', 'Torre ', 'Km ', 'Esq.', 'Transversal', 'Via ', 'Boulevard'];
        for (const line of allLines) {
          if (line !== name && line.length > 5 && line.length < 200) {
            if (addrPatterns.some(p => line.includes(p))) {
              address = line;
              break;
            }
          }
        }

        if (!address) {
          for (const line of allLines) {
            if (line !== name && line.length > 5 && line.length < 200 && /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+\d/.test(line)) {
              address = line;
              break;
            }
          }
        }

        const linkEl = article.querySelector('a[href*="/maps/place/"]');
        const href = linkEl ? linkEl.href : '';

        results.push({ name, rating, reviews, address, phone, website, href });
      });

      return results;
    });

    console.log(`[SCRAPER] Encontrados ${places.length} lugares`);

    const leads = [];
    const seenNames = new Set();

    for (const place of places.slice(0, 30)) {
      if (seenNames.has(place.name)) continue;
      seenNames.add(place.name);

      const lead = {
        name: place.name,
        category: category,
        location: `${city}, ${state}`,
        state: state,
        city: city,
        address: place.address || '',
        phone: cleanPhone(place.phone),
        website: cleanUrl(place.website),
        rating: place.rating,
        reviews_count: place.reviews || 0,
        source: 'google_maps',
        source_url: place.href,
        status: 'frio',
        timestamp: new Date().toISOString(),
        notes: ''
      };

      // Deep scraping: obtener más datos si está habilitado
      if (deep && place.href && lead.length < maxDeep) {
        try {
          await page.goto(place.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await page.waitForTimeout(1500);

          // Aceptar cookies en la página del lugar
          try {
            const acceptBtn = page.locator('button[aria-label*="Aceptar"], button[aria-label*="Accept"]').first();
            if (await acceptBtn.isVisible({ timeout: 2000 })) {
              await acceptBtn.click();
              await page.waitForTimeout(1000);
            }
          } catch (e) {}

          // Extraer website, email y redes sociales
          const deepData = await page.evaluate(() => {
            let website = '', email = '', facebook = '', instagram = '', twitter = '';
            const pageText = document.body ? document.body.innerText : '';

            const websiteLink = document.querySelector('a[data-item-id="authority"]') || document.querySelector('a[aria-label*="sitio web"]') || document.querySelector('a[href*="://"]:not([href*="google.com"]):not([href*="maps"])');
            if (websiteLink) website = websiteLink.href || '';

            const emailLink = document.querySelector('a[href^="mailto:"]');
            if (emailLink) email = emailLink.href.replace('mailto:', '') || '';

            const fbMatch = pageText.match(/facebook\.com\/[\w-]+/i);
            const igMatch = pageText.match(/instagram\.com\/[\w-]+/i);
            const twMatch = pageText.match(/twitter\.com\/[\w-]+|x\.com\/[\w-]+/i);

            if (fbMatch) facebook = 'https://' + fbMatch[0];
            if (igMatch) instagram = 'https://' + igMatch[0];
            if (twMatch) twitter = 'https://' + twMatch[0];

            return { website, email, facebook, instagram, twitter };
          });

          lead.website = cleanUrl(deepData.website || lead.website);
          lead.email = deepData.email || '';
          lead.facebook = deepData.facebook || '';
          lead.instagram = deepData.instagram || '';
          lead.twitter = deepData.twitter || '';

          console.log(`[SCRAPER]   Deep data: ${place.name}`);
        } catch (e) {
          console.log(`[SCRAPER]   Error en deep scrape: ${e.message}`);
        }
      }

      leads.push(lead);
    }

    await browser.close();
    return leads;

  } catch (error) {
    console.error('[SCRAPER ERROR]', error.message);
    await browser.close();
    return [];
  }
}

// ─── Save to Supabase ───
async function saveLeadsToSupabase(leads) {
  if (!supabase || !leads || leads.length === 0) {
    console.log('[DB] Sin Supabase o sin leads, guardando en JSON local...');
    const fs = require('fs');
    const path = require('path');
    const jsonPath = path.join(__dirname, '..', 'leads_data', 'leads.json');

    let existing = [];
    try {
      if (fs.existsSync(jsonPath)) {
        existing = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      }
    } catch (e) {}

    const newLeads = leads.filter(l => !existing.some(e => e.name === l.name && e.address === l.address));
    existing.push(...newLeads);

    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify(existing, null, 2));

    return newLeads.length;
  }

  let saved = 0;
  for (const lead of leads) {
    try {
      const { data: existing } = await supabase
        .from('leads')
        .select('id')
        .eq('name', lead.name)
        .eq('address', lead.address || '')
        .limit(1);

      if (existing && existing.length > 0) continue;

      const cleanLead = {};
      Object.keys(lead).forEach(k => {
        if (lead[k] !== null && lead[k] !== undefined && lead[k] !== '') {
          cleanLead[k] = lead[k];
        }
      });
      cleanLead.rating = cleanLead.rating || null;
      cleanLead.reviews_count = cleanLead.reviews_count || 0;

      await supabase.from('leads').insert(cleanLead);
      saved++;
      console.log(`[DB] Guardado: ${lead.name}`);
    } catch (e) {
      console.log(`[DB] Error guardando ${lead.name}: ${e.message}`);
    }
  }
  return saved;
}

// ─── Routes ───
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Lead Finder Microservice (Node.js + Playwright)',
    time: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    supabase_connected: !!supabase,
    time: new Date().toISOString()
  });
});

app.post('/search', async (req, res) => {
  const { category, state, city, parish, sector, deep, googleSearch, paginasAmarillas, social, tiktok, instagram, maxDeep } = req.body;

  if (!category || !state || !city) {
    return res.status(400).json({ error: 'category, state, and city are required' });
  }

  console.log(`\n[SEARCH] ${category} en ${city}, ${state} (deep=${deep})`);

  try {
    const leads = await scrapeGoogleMaps(category, state, city, deep !== false, maxDeep || 5);
    const savedCount = await saveLeadsToSupabase(leads);

    const jobId = `search_${Date.now()}`;
    console.log(`[SEARCH] Completado: ${savedCount} nuevos leads`);

    res.json({
      jobId,
      status: 'done',
      leadsFound: savedCount,
      message: `${savedCount} leads guardados en ${city}, ${state}`
    });
  } catch (error) {
    console.error('[SEARCH ERROR]', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/stats', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase no configurado' });
  }

  try {
    const { data, count } = await supabase
      .from('leads')
      .select('status, category, state', { count: 'exact' });

    const total = count || (data ? data.length : 0);
    const byStatus = {}, byCategory = {}, byState = {};

    if (data) {
      data.forEach(lead => {
        const s = lead.status || 'frio';
        byStatus[s] = (byStatus[s] || 0) + 1;
        const cat = lead.category || 'unknown';
        byCategory[cat] = (byCategory[cat] || 0) + 1;
        const st = lead.state || 'unknown';
        byState[st] = (byState[st] || 0) + 1;
      });
    }

    res.json({ total, byStatus, byCategory, byState });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Start ───
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 Lead Finder Microservice iniciado en puerto ${PORT}`);
  console.log(`   Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Supabase: ${supabase ? 'Conectado' : 'No configurado'}\n`);
});

module.exports = app;