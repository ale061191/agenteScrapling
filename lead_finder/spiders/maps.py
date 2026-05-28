from typing import List, Dict, Any, Optional
from lead_finder.models import Lead
from lead_finder.config import Settings
import re


class MapsSpider:
    def __init__(self, settings: Settings):
        self.settings = settings

    def _search_url(self, category: str, location: str) -> str:
        q = f"{category} en {location}"
        return f"https://www.google.com/maps/search/{q.replace(' ', '+')}/"

    def search(self, category: str, location: str, deep: bool = False,
               max_deep: int = 5, state: Optional[str] = None,
               city: Optional[str] = None,
               parish: Optional[str] = None,
               sector: Optional[str] = None) -> List[Lead]:
        from scrapling.engines._browsers._stealth import StealthySession

        url = self._search_url(category, location)
        captured: List[Dict[str, Any]] = []

        with StealthySession(
            headless=self.settings.headless,
            locale="es-ES",
        ) as session:
            def action(page):
                page.wait_for_timeout(1000)
                if "consent" in page.url.lower():
                    page.locator("button:has-text('Aceptar todo')").first.click()
                    page.wait_for_timeout(1500)
                    try:
                        page.wait_for_load_state("networkidle", timeout=5000)
                    except:
                        pass

                for i in range(self.settings.scroll_times):
                    page.evaluate("""() => {
                        const f = document.querySelector('[role="feed"]');
                        if (f) f.scrollBy(0, f.clientHeight || 500);
                    }""")
                    page.wait_for_timeout(self.settings.scroll_delay_ms)

                page.wait_for_timeout(400)

                raw = page.evaluate("""() => {
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
                        const re = article.querySelector('[role="img"][aria-label]');
                        if (re) {
                            const lbl = re.getAttribute('aria-label') || '';
                            const rm = lbl.match(/([\\d.,]+)/);
                            if (rm) rating = parseFloat(rm[1].replace(',', '.'));
                            const rvm = lbl.match(/\\((\\d+)\\s*/);
                            if (rvm) reviews = parseInt(rvm[1]);
                        }
                        let phone = '', website = '';
                        article.querySelectorAll('a[href]').forEach(a => {
                            const h = a.href || '';
                            if (h.startsWith('tel:')) phone = h.replace('tel:', '').split('?')[0];
                            else if (h.startsWith('http') && !h.includes('google.com/maps')
                                     && !h.includes('google.com/search') && !website) website = h;
                        });
                        const sections = article.querySelectorAll('.W4Efsd');
                        let description = '';
                        sections.forEach(sec => {
                            const txt = sec.textContent || '';
                            const lines = txt.split('\\n').map(s => s.trim()).filter(Boolean);
                            for (const line of lines) {
                                if (line !== name && line.length > 5 && line.length < 300
                                    && !line.includes('★') && !line.includes('·')
                                    && !/^\\d+\\s*reseñ/i.test(line) && !line.startsWith('http')
                                    && !line.includes('€') && !line.includes('$')
                                    && !line.includes('Cerrado') && !line.includes('Abierto')
                                    && !line.includes('horario') && !line.includes('accesible')) {
                                    description = line; break;
                                }
                            }
                        });
                        const link = article.querySelector('a[href*="/maps/place/"]');
                        const href = link ? link.href : '';
                        results.push({ name, rating, reviews_count: reviews, address: description, phone, website, href });
                    });
                    return results;
                }""")
                captured.extend(raw)

                if deep:
                    for idx, item in enumerate(captured[:max_deep]):
                        href = item.get("href", "")
                        if not href:
                            continue
                        try:
                            page.goto(href, wait_until="networkidle", timeout=60000)
                            page.wait_for_timeout(1500)
                            if "consent" in page.url.lower():
                                page.locator("button:has-text('Aceptar todo')").first.click()
                                page.wait_for_timeout(1500)

                            try:
                                page.locator("button[data-tooltip*='fono'], button:has([data-tooltip*='phone'])").first.click(timeout=2000)
                                page.wait_for_timeout(500)
                            except:
                                pass

                            details = page.evaluate("""() => {
                                function isPhone(t) {
                                    const digits = t.replace(/[^\\d]/g, '');
                                    return digits.length >= 7 && digits.length <= 15 && /[\\d]{7,}/.test(digits);
                                }
                                function cleanUrl(url) {
                                    try { return url.split('?')[0].split('#')[0]; } catch { return url; }
                                }

                                const allText = document.body.innerText || '';
                                let phone = '', website = '', address = '', email = '';
                                let facebook = '', instagram = '', twitter = '';

                                const telLinks = document.querySelectorAll('a[href*="tel:"]');
                                for (const a of telLinks) {
                                    const raw = a.href.replace('tel:', '').split('?')[0].trim().replace(/[^\\d+\\s\\-]/g, '').trim();
                                    if (isPhone(raw)) { phone = raw; break; }
                                }

                                if (!phone) {
                                    document.querySelectorAll('button').forEach(b => {
                                        const t = (b.textContent || '').trim();
                                        const tip = (b.getAttribute('data-tooltip') || b.getAttribute('aria-label') || '').toLowerCase();
                                        if ((tip.includes('fono') || tip.includes('phone')) && isPhone(t)) phone = t;
                                    });
                                }
                                if (!phone) {
                                    const m = allText.match(/(\\+58[\\s-]?\\d{3}[\\s-]?\\d{3}[\\s-]?\\d{4})|(\\+\\d{2,3}[\\s-]?\\d{3}[\\s-]?\\d{3}[\\s-]?\\d{2,4})|(0\\d{3}[\\s-]?\\d{3}[\\s-]?\\d{4})/);
                                    if (m) phone = m[0].trim();
                                }

                                const allLinks = document.querySelectorAll('a[href]');
                                for (const a of allLinks) {
                                    const h = a.href || '';
                                    if (!h.startsWith('http')) continue;
                                    if (/google(\\.|$)|goo\\.gl|gstatic|plus\\.codes/.test(h)) continue;
                                    if (h.includes('facebook') || h.includes('instagram') || h.includes('twitter') || h.includes('x.com')) continue;
                                    const txt = (a.textContent || '').trim().toLowerCase();
                                    const cls = (a.className || '').toLowerCase();
                                    if (txt.includes('sitio') || txt.includes('web') || txt.includes('pagina') || cls.includes('website') || cls.includes('web')) { website = h; break; }
                                }
                                if (!website) {
                                    for (const a of document.querySelectorAll('a[href]')) {
                                        const h = a.href || '';
                                        if (!h.startsWith('http')) continue;
                                        if (/google(\\.|$)|goo\\.gl|gstatic|plus\\.codes/.test(h)) continue;
                                        if (h.includes('facebook') || h.includes('instagram') || h.includes('twitter') || h.includes('x.com')) continue;
                                        website = h; break;
                                    }
                                }

                                const addrBtn = document.querySelector('button[data-item-id*="address"]');
                                if (addrBtn) { address = (addrBtn.textContent || '').trim(); }
                                if (!address) {
                                    document.querySelectorAll('button').forEach(b => {
                                        const t = (b.textContent || '').trim();
                                        if (t.length > 8 && t.length < 200 && (t.includes('Calle') || t.includes('Av.') || t.includes('Avenida') || t.includes('Carretera') || t.includes('Urbanizacion'))) address = t;
                                    });
                                }

                                const mailLinks = document.querySelectorAll('a[href^="mailto:"]');
                                if (mailLinks.length) email = mailLinks[0].href.replace('mailto:', '').split('?')[0];
                                if (!email) { const m = allText.match(/[\\w.-]+@[\\w.-]+\\.\\w{2,}/); if (m) email = m[0]; }

                                document.querySelectorAll('a[href]').forEach(a => {
                                    const h = a.href || '';
                                    if (!h.startsWith('http')) return;
                                    if (h.includes('facebook.com/') && !h.includes('share') && !h.includes('sharer') && !facebook) facebook = cleanUrl(h);
                                    if (h.includes('instagram.com/') && !h.includes('share') && !h.includes('sharer') && !instagram) instagram = cleanUrl(h);
                                    if ((h.includes('twitter.com/') || h.includes('x.com/')) && !h.includes('share') && !h.includes('intent') && !twitter) twitter = cleanUrl(h);
                                });

                                return { phone, website, address, email, facebook, instagram, twitter };
                            }""")

                            item["phone"] = details.get("phone") or item.get("phone", "")
                            item["website"] = details.get("website") or item.get("website", "")
                            item["address"] = details.get("address") or item.get("address", "")
                            item["email"] = details.get("email") or None
                            item["facebook"] = details.get("facebook") or None
                            item["instagram"] = details.get("instagram") or None
                            item["twitter"] = details.get("twitter") or None

                            page.go_back(wait_until="networkidle", timeout=60000)
                            page.wait_for_timeout(1500)
                            if "consent" in page.url.lower():
                                page.locator("button:has-text('Aceptar todo')").first.click()
                                page.wait_for_timeout(1500)
                        except Exception:
                            continue

            session.fetch(
                url,
                page_action=action,
                load_dom=True,
                network_idle=True,
                timeout=600000,
            )

        leads = []
        for item in captured:
            lead = Lead(
                name=item.get("name", ""),
                category=category,
                location=location,
                state=state or None,
                city=city or None,
                address=item.get("address") or None,
                phone=item.get("phone") or None,
                website=item.get("website") or None,
                email=item.get("email") or None,
                facebook=item.get("facebook") or None,
                instagram=item.get("instagram") or None,
                twitter=item.get("twitter") or None,
                rating=item.get("rating"),
                reviews_count=item.get("reviews_count"),
                source="google_maps",
                source_url=url,
            )
            leads.append(lead)

        return leads