from typing import List, Dict, Any, Optional
from lead_finder.models import Lead
from lead_finder.config import Settings
import re


class GoogleSearchSpider:
    def __init__(self, settings: Settings):
        self.settings = settings

    def _handle_consent(self, page):
        page.wait_for_timeout(2000)
        if "consent" in page.url.lower():
            page.locator("button:has-text('Aceptar todo')").first.click()
            page.wait_for_timeout(3000)
            try:
                page.wait_for_load_state("networkidle", timeout=10000)
            except:
                pass
        page.wait_for_timeout(3000)

    def _extract_local_pack(self, page) -> List[Dict[str, Any]]:
        return page.evaluate("""() => {
            const results = [];
            const seenUrls = new Set();
            document.querySelectorAll('a[href*="/maps/place/"]').forEach(a => {
                const card = a.closest('div') || a;
                if (seenUrls.has(a.href)) return;
                seenUrls.add(a.href);
                let name = '';
                const nameEl = card.querySelector('[role="heading"], h3, .OSrXXb, .qBF1Pd, .fontHeadlineSmall, [class*="headline"]');
                if (nameEl) name = (nameEl.textContent || '').trim();
                let rating = null, reviews = null;
                const ratingEl = card.querySelector('[role="img"][aria-label*="estrella"], [role="img"][aria-label*="star"], span[aria-label*="estrella"]');
                if (ratingEl) {
                    const lbl = ratingEl.getAttribute('aria-label') || '';
                    const rm = lbl.match(/([\\d.,]+)/);
                    if (rm) rating = parseFloat(rm[1].replace(',', '.'));
                    const rvm = lbl.match(/(\\d+)\\s*reseñ/i);
                    if (rvm) reviews = parseInt(rvm[1]);
                }
                let phone = '', website = '', address = '';
                const cardText = card.textContent || '';
                const links = card.querySelectorAll('a[href]');
                links.forEach(link => {
                    const h = link.href || '';
                    if (h.startsWith('tel:')) phone = h.replace('tel:', '').split('?')[0];
                    else if (h.startsWith('http') && !h.includes('google.com') && !h.includes('goo.gl') && !website && !h.includes('facebook') && !h.includes('instagram')) website = h;
                });
                const phoneMatch = cardText.match(/(\\+58[\\d\\s\\-]{9,12})|(\\+\\d{2,3}[\\d\\s\\-]{8,12})|(0\\d{3}[\\d\\s\\-]{7,10})/);
                if (phoneMatch && !phone) phone = phoneMatch[0].trim();
                const spans = card.querySelectorAll('span, div');
                spans.forEach(el => {
                    const t = (el.textContent || '').trim();
                    if (!address && t.includes('·') && t.length > 5 && t.length < 100 && !t.includes('★') && !t.includes('http')) address = t;
                    if (t.includes('Calle ') || t.includes('Av.') || t.includes('Carretera') || t.includes('Urb.')) {
                        if (t.length > 5 && t.length < 200) address = t;
                    }
                });
                if (name) results.push({ name, rating, reviews_count: reviews, address, phone, website, href: a.href });
            });
            return results;
        }""")

    def _extract_social_profiles(self, page, category: str, parts: List[str]) -> List[Dict[str, Any]]:
        return page.evaluate(f"""() => {{
            const results = [];
            const seenUrls = new Set();
            const categoryStr = {repr(category)};
            const cityStr = {repr(parts[0])};
            document.querySelectorAll('a[href*="facebook.com/"], a[href*="instagram.com/"], a[href*="x.com/"], a[href*="twitter.com/"]').forEach(a => {{
                const h = a.href || '';
                if (seenUrls.has(h)) return;
                if (h.includes('/sharer/') || h.includes('/share/') || h.includes('sharer.php')) return;
                seenUrls.add(h);
                const name = (a.textContent || '').trim() || (a.closest('div')?.textContent || '').trim().slice(0, 100);
                const title = a.closest('div, li, [class*="g"]')?.querySelector('h3, [role="heading"]')?.textContent?.trim() || '';
                if (title) results.push({{ name: title, social_url: h.split('?')[0], title }});
                else if (name) results.push({{ name, social_url: h.split('?')[0] }});
            }});
            document.querySelectorAll('div.g, div[data-hveid]').forEach(div => {{
                const link = div.querySelector('a[href^="http"][href*="facebook" i]') || div.querySelector('a[href^="http"][href*="instagram" i]') || div.querySelector('a[href^="http"][href*="twitter" i]');
                if (!link) return;
                const h = link.href;
                if (seenUrls.has(h) || h.includes('/sharer/')) return;
                seenUrls.add(h);
                const heading = div.querySelector('h3');
                const name2 = heading ? (heading.textContent || '').trim() : '';
                const snippet = div.querySelector('[class*="VwiC3b"], .lEBKkf, span.aCOpRe');
                const desc = snippet ? (snippet.textContent || '').trim().slice(0, 200) : '';
                if (name2) results.push({{ name: name2, social_url: h.split('?')[0], description: desc }});
            }});
            return results;
        }}""")

    def search(self, category: str, location: str, deep: bool = False,
               state: Optional[str] = None, city: Optional[str] = None,
               parish: Optional[str] = None,
               sector: Optional[str] = None) -> List[Lead]:
        from scrapling.engines._browsers._stealth import StealthySession

        parts = [city or location, "Venezuela"]
        if parish: parts.insert(0, parish)
        if sector: parts.insert(0, sector)
        q = f"{category} en {', '.join(parts)}"
        url = f"https://www.google.com/search?q={q.replace(' ', '+')}&hl=es&gl=ve"

        leads = []

        with StealthySession(
            headless=self.settings.headless,
            locale="es-ES",
        ) as session:
            def action(page):
                self._handle_consent(page)
                raw = self._extract_local_pack(page)
                for item in raw:
                    lead = Lead(
                        name=item.get("name", ""),
                        category=category,
                        location=location,
                        state=state or None,
                        city=city or None,
                        address=item.get("address") or None,
                        phone=item.get("phone") or None,
                        website=item.get("website") or None,
                        rating=item.get("rating"),
                        reviews_count=item.get("reviews_count"),
                        source="google_search",
                        source_url=url,
                    )
                    leads.append(lead)

            session.fetch(
                url,
                page_action=action,
                load_dom=True,
                network_idle=True,
                timeout=60000,
            )

        return leads

    def search_social(self, category: str, location: str,
                      state: Optional[str] = None,
                      city: Optional[str] = None,
                      parish: Optional[str] = None,
                      sector: Optional[str] = None) -> List[Lead]:
        from scrapling.engines._browsers._stealth import StealthySession

        parts = [city or location, "Venezuela"]
        if parish: parts.insert(0, parish)
        if sector: parts.insert(0, sector)
        base_q = f"{category} en {', '.join(parts)}"

        queries = [
            (f"{base_q} Facebook", "facebook"),
            (f"{base_q} Instagram", "instagram"),
        ]

        seen_names: set = set()
        leads: List[Lead] = []

        with StealthySession(
            headless=self.settings.headless,
            locale="es-ES",
        ) as session:
            for q, social_type in queries:
                url = f"https://www.google.com/search?q={q.replace(' ', '+')}&hl=es&gl=ve"

                def make_action(query_str, stype):
                    def action(page):
                        self._handle_consent(page)
                        socials = self._extract_social_profiles(page, category, parts)
                        for item in socials:
                            name = item.get("name", "")
                            social_url = item.get("social_url", "")
                            if not name or social_url in seen_names:
                                continue
                            seen_names.add(social_url)
                            kw = {}
                            if stype == "facebook":
                                kw["facebook"] = social_url
                            elif stype == "instagram":
                                kw["instagram"] = social_url
                            elif "x.com" in social_url or "twitter.com" in social_url:
                                kw["twitter"] = social_url
                            lead = Lead(
                                name=name,
                                category=category,
                                location=location,
                                state=state or None,
                                city=city or None,
                                source="google_social",
                                source_url=url,
                                **kw,
                            )
                            leads.append(lead)
                    return action

                try:
                    session.fetch(
                        url,
                        page_action=make_action(q, social_type),
                        load_dom=True,
                        network_idle=True,
                        timeout=60000,
                    )
                except Exception:
                    pass

        return leads