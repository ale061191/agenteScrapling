from typing import List, Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from lead_finder.models import Lead
from lead_finder.config import Settings
import re


class InstagramSpider:
    def __init__(self, settings: Settings):
        self.settings = settings

    def _find_instagram_urls_on_google(self, page) -> List[Dict[str, Any]]:
        return page.evaluate("""() => {
            const results = [];
            const seen = new Set();
            document.querySelectorAll('cite, .iUh30, .VuuXrf, a[jsname]').forEach(el => {
                const text = (el.textContent || el.href || '').trim();
                const match = text.match(/(?:https?:\\/\\/)?(?:www\\.)?instagram\\.com\\/([^\\s/?]+)/i);
                if (!match) return;
                const handle = match[1];
                if (seen.has(handle)) return;
                seen.add(handle);
                const card = el.closest('div.g, div[data-hveid], div[jsname]');
                const heading = card ? card.querySelector('h3, [role="heading"]') : null;
                const name = heading ? (heading.textContent || '').trim() : '';
                const snippet = card ? card.querySelector('[class*="VwiC3b"], .lEBKkf, span.aCOpRe, [class*="st"]') : null;
                const desc = snippet ? (snippet.textContent || '').trim().slice(0, 200) : '';
                const url = 'https://www.instagram.com/' + handle;
                results.push({ name, handle, url, description: desc });
            });
            return results;
        }""")

    def _extract_profile_data(self, page) -> Dict[str, Any]:
        return page.evaluate("""() => {
            const result = {};
            const pageText = document.body ? document.body.textContent || '' : '';

            const metaDesc = document.querySelector('meta[property="og:description"]');
            if (metaDesc) {
                const content = metaDesc.getAttribute('content') || '';
                const parts = content.split('\\n').map(s => s.trim()).filter(Boolean);
                if (parts.length > 0) result.display_name = parts[0];
                const bioMatch = content.match(/"([^"]{10,})"/);
                if (bioMatch) result.bio = bioMatch[1];
                else if (parts.length > 1) result.bio = parts.slice(1).join(' ');
            }

            const titleEl = document.querySelector('meta[property="og:title"]');
            if (titleEl && !result.display_name) {
                result.display_name = (titleEl.getAttribute('content') || '').trim();
            }

            const h2 = document.querySelector('h2');
            if (h2 && !result.display_name) {
                result.display_name = (h2.textContent || '').trim();
            }

            const img = document.querySelector('img[alt*="photo"], img[alt*="profile"]');
            if (img) {
                const alt = img.getAttribute('alt') || '';
                if (alt && !result.display_name) result.display_name = alt.replace("'s profile picture", '').trim();
            }

            const phoneMatch = pageText.match(/(\\+58[\\d\\s\\-]{9,12})|(\\+\\d{2,3}[\\d\\s\\-]{8,12})|(0\\d{3}[\\d\\s\\-]{7,10})/);
            if (phoneMatch) result.phone = phoneMatch[0].trim();

            const emailMatch = pageText.match(/[\\w.+-]+@[\\w-]+\\.[\\w.-]+/);
            if (emailMatch) result.email = emailMatch[0];

            const allLinks = document.querySelectorAll('a[href]');
            for (const a of allLinks) {
                const h = a.href || '';
                if (h.startsWith('http') && !h.includes('instagram.com') && !h.includes('facebook.com')) {
                    result.website = h;
                    break;
                }
            }

            document.querySelectorAll('a[href]').forEach(a => {
                const h = a.href || '';
                if (h.includes('facebook.com/') && !h.includes('share')) result.facebook = h;
            });

            const followerMatch = pageText.match(/([\\d,.]+)\\s*(?:seguidores?|follower|suscriptores?)/i);
            if (followerMatch) result.followers = followerMatch[0].trim();

            return result;
        }""")

    def search(self, category: str, location: str,
               state: Optional[str] = None,
               city: Optional[str] = None,
               parish: Optional[str] = None,
               sector: Optional[str] = None) -> List[Lead]:
        from scrapling.engines._browsers._stealth import StealthySession

        parts = [city or location, "Venezuela"]
        if parish: parts.insert(0, parish)
        if sector: parts.insert(0, sector)
        base_q = f"{category} en {', '.join(parts)} Instagram"
        google_url = f"https://www.google.com/search?q={base_q.replace(' ', '+')}&hl=es&gl=ve"

        leads: List[Lead] = []
        seen_profiles: set = set()
        profiles: List[Dict[str, Any]] = []

        with StealthySession(
            headless=self.settings.headless,
            locale="es-ES",
        ) as session:

            def find_action(page):
                page.wait_for_timeout(1000)
                if "consent" in page.url.lower():
                    try:
                        page.locator("button:has-text('Aceptar todo')").first.click()
                        page.wait_for_timeout(1500)
                    except:
                        pass
                page.wait_for_timeout(1000)
                raw = self._find_instagram_urls_on_google(page)
                profiles.extend(raw)

            for query in [base_q, f"site:instagram.com {category} {parts[0]}"]:
                url = f"https://www.google.com/search?q={query.replace(' ', '+')}&hl=es&gl=ve"
                try:
                    session.fetch(url, page_action=find_action, load_dom=True, network_idle=True, timeout=30000)
                except Exception:
                    pass
                if profiles:
                    break

            unique_profiles = []
            for pf in profiles:
                url = pf.get("url", "")
                if url and url not in seen_profiles:
                    seen_profiles.add(url)
                    unique_profiles.append(pf)

            def visit_profile(pf) -> Optional[Lead]:
                profile_url = pf.get("url", "")
                handle = pf.get("handle", "")
                name = pf.get("name", "")
                desc = pf.get("description", "")

                display_name = name
                bio = ""
                followers = ""
                website = ""
                phone = ""
                email = ""
                facebook = ""

                try:
                    with StealthySession(headless=self.settings.headless, locale="es-ES") as vs:
                        data_list: list = []
                        def va(p):
                            p.wait_for_timeout(2000)
                            if "consent" in p.url.lower():
                                try:
                                    p.locator("button:has-text('Aceptar todo')").first.click()
                                    p.wait_for_timeout(1500)
                                except:
                                    pass
                            data_list.append(self._extract_profile_data(p))
                        vs.fetch(profile_url, page_action=va, load_dom=True, network_idle=True, timeout=30000)

                    if data_list:
                        pd = data_list[0]
                        display_name = pd.get("display_name") or name
                        bio = pd.get("bio", "") or ""
                        followers = pd.get("followers", "") or ""
                        website = pd.get("website", "") or ""
                        phone = pd.get("phone", "") or ""
                        email = pd.get("email", "") or ""
                        facebook = pd.get("facebook", "") or ""
                    elif desc:
                        bio = desc[:200]
                except Exception:
                    if desc:
                        bio = desc[:200]

                if not website and bio:
                    m = re.search(r'(https?://[^\s]+)', bio)
                    if m:
                        website = m.group(1)
                if not display_name:
                    display_name = handle or ""

                notes_parts = []
                if handle:
                    notes_parts.append(f"Instagram: @{handle}")
                if bio:
                    notes_parts.append(f"Bio: {bio[:100]}")
                if followers:
                    notes_parts.append(f"Seguidores: {followers}")

                return Lead(
                    name=display_name, category=category, location=location,
                    state=state or None, city=city or None,
                    website=website or None, phone=phone or None,
                    email=email or None, facebook=facebook or None,
                    instagram=profile_url,
                    source="instagram", source_url=google_url,
                    notes=" | ".join(notes_parts) if notes_parts else "",
                )

            with ThreadPoolExecutor(max_workers=3) as pool:
                futures = [pool.submit(visit_profile, pf) for pf in unique_profiles]
                for f in as_completed(futures):
                    try:
                        lead = f.result()
                        if lead:
                            leads.append(lead)
                    except Exception:
                        pass

        return leads
