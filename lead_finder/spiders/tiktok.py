from typing import List, Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from lead_finder.models import Lead
from lead_finder.config import Settings
import re


class TikTokSpider:
    def __init__(self, settings: Settings):
        self.settings = settings

    def _handle_consent(self, page):
        page.wait_for_timeout(1000)
        if "consent" in page.url.lower():
            try:
                page.locator("button:has-text('Aceptar todo')").first.click()
                page.wait_for_timeout(1500)
            except:
                pass
        page.wait_for_timeout(1000)

    def _find_tiktok_urls_on_google(self, page) -> List[Dict[str, Any]]:
        return page.evaluate("""() => {
            const results = [];
            const seen = new Set();
            document.querySelectorAll('cite, .iUh30, .VuuXrf, a[jsname]').forEach(el => {
                const text = (el.textContent || el.href || '').trim();
                const match = text.match(/(?:https?:\\/\\/)?(?:www\\.)?tiktok\\.com\\/@([^\\s/?]+)/i);
                if (!match) return;
                const handle = '@' + match[1];
                if (seen.has(handle)) return;
                seen.add(handle);
                const card = el.closest('div.g, div[data-hveid], div[jsname]');
                const heading = card ? card.querySelector('h3, [role="heading"]') : null;
                const name = heading ? (heading.textContent || '').trim() : '';
                const snippet = card ? card.querySelector('[class*="VwiC3b"], .lEBKkf, span.aCOpRe, [class*="st"]') : null;
                const desc = snippet ? (snippet.textContent || '').trim().slice(0, 200) : '';
                const url = 'https://www.tiktok.com/@' + match[1];
                results.push({ name, handle, url, description: desc });
            });
            return results;
        }""")

    def _extract_profile_data(self, page) -> Dict[str, Any]:
        return page.evaluate("""() => {
            const result = {};
            const titleEl = document.querySelector('[data-e2e="user-title"], h1, [class*="shareTitle"]');
            if (titleEl) result.display_name = (titleEl.textContent || '').trim();
            const handleEl = document.querySelector('[data-e2e="user-subtitle"], h2, [class*="shareSubTitle"]');
            if (handleEl) result.handle = (handleEl.textContent || '').trim();
            const bioEl = document.querySelector('[data-e2e="user-bio"], [class*="bio"], [class*="description"]');
            if (bioEl) result.bio = (bioEl.textContent || '').trim();
            const linkEl = document.querySelector('a[data-e2e="user-bio-link"], a[href^="http"]:not([href*="tiktok.com"])');
            if (linkEl) result.website = linkEl.href;
            const followerEl = document.querySelector('[data-e2e="followers-count"], [class*="follower"] strong, [class*="followerCount"]');
            if (followerEl) {
                const txt = (followerEl.textContent || '').trim();
                const num = txt.replace(/[^0-9.]/g, '');
                result.followers = txt;
                if (num) result.followers_count = parseFloat(num) * (txt.includes('K') ? 1000 : txt.includes('M') ? 1000000 : 1);
            }
            const pageText = document.body ? document.body.textContent || '' : '';
            const phoneMatch = pageText.match(/(\\+58[\\d\\s\\-]{9,12})|(\\+\\d{2,3}[\\d\\s\\-]{8,12})|(0\\d{3}[\\d\\s\\-]{7,10})/);
            if (phoneMatch) result.phone = phoneMatch[0].trim();
            const emailMatch = pageText.match(/[\\w.+-]+@[\\w-]+\\.[\\w.-]+/);
            if (emailMatch) result.email = emailMatch[0];
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
        base_q = f"{category} en {', '.join(parts)} TikTok"
        google_url = f"https://www.google.com/search?q={base_q.replace(' ', '+')}&hl=es&gl=ve"

        leads: List[Lead] = []
        seen_profiles: set = set()
        profiles: List[Dict[str, Any]] = []

        with StealthySession(
            headless=self.settings.headless,
            locale="es-ES",
        ) as session:

            def find_action(page):
                self._handle_consent(page)
                raw = self._find_tiktok_urls_on_google(page)
                profiles.extend(raw)

            for query in [base_q, f"site:tiktok.com/@ {category} {parts[0]}"]:
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

                bio = followers = website = phone = email = ""
                try:
                    with StealthySession(headless=self.settings.headless, locale="es-ES") as vs:
                        data_list: list = []
                        def va(p):
                            p.wait_for_timeout(1500)
                            data_list.append(self._extract_profile_data(p))
                        vs.fetch(profile_url, page_action=va, load_dom=True, network_idle=True, timeout=30000)

                    if data_list:
                        pd = data_list[0]
                        bio = pd.get("bio", "")
                        followers = pd.get("followers", "")
                        website = pd.get("website", "")
                        phone = pd.get("phone", "")
                        email = pd.get("email", "")
                    elif desc:
                        bio = desc[:200]
                except Exception:
                    if desc:
                        bio = desc[:200]

                if not website and bio:
                    m = re.search(r'(https?://[^\s]+)', bio)
                    if m:
                        website = m.group(1)
                if not name:
                    name = handle or ""

                notes_parts = []
                if handle:
                    notes_parts.append(f"TikTok: {handle}")
                if bio:
                    notes_parts.append(f"Bio: {bio[:100]}")
                if followers:
                    notes_parts.append(f"Seguidores: {followers}")

                return Lead(
                    name=name, category=category, location=location,
                    state=state or None, city=city or None,
                    website=website or None, phone=phone or None,
                    email=email or None, twitter=profile_url,
                    source="tiktok", source_url=google_url,
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
