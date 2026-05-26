from typing import List, Optional
from lead_finder.models import Lead
from lead_finder.config import Settings


class PaginasAmarillasSpider:
    def __init__(self, settings: Settings):
        self.settings = settings

    def search(self, category: str, location: str,
               state: Optional[str] = None, city: Optional[str] = None,
               parish: Optional[str] = None,
               sector: Optional[str] = None) -> List[Lead]:
        from scrapling.engines._browsers._stealth import StealthySession

        parts = [city or location, "Venezuela"]
        if parish: parts.insert(0, parish)
        if sector: parts.insert(0, sector)
        query = f"{category} en {' '.join(parts[:2])}"
        q_encoded = query.replace(' ', '+')
        urls = [
            f"https://www.paginasamarillas.com.ve/busqueda?q={q_encoded}&l={parts[0].replace(' ', '+')}",
            f"https://www.paginasamarillas.com.ve/search?q={q_encoded}",
        ]
        source_url = urls[0]

        leads = []
        with StealthySession(
            headless=self.settings.headless,
            locale="es-ES",
        ) as session:
            def action(page):
                page.wait_for_timeout(3000)
                if "consent" in page.url.lower() or "cookie" in page.url.lower():
                    for btn_text in ["Aceptar", "Aceptar todo", "Accept", "Cerrar"]:
                        btn = page.locator(f"button:has-text('{btn_text}')").first
                        if btn:
                            btn.click()
                            page.wait_for_timeout(1000)

                raw = page.evaluate("""() => {
                    const results = [];
                    const seen = new Set();

                    const cards = document.querySelectorAll(
                        '[class*="result"], [class*="card"], [class*="item"], [class*="listado"], ' +
                        'article, .result-item, .listing-item, tr[class*="result"], ' +
                        'div[class*="box-result"], div[class*="anuncio"], ' +
                        '.search-results > div, [data-result], .v2-listing, .row.result'
                    );

                    cards.forEach(card => {
                        const text = card.textContent || '';
                        const nameEl = card.querySelector(
                            'h2, h3, h4, [class*="title"], [class*="name"], [class*="nombre"], ' +
                            'strong, [class*="heading"], [class*="titulo"]'
                        );
                        let name = nameEl ? (nameEl.textContent || '').trim() : '';
                        if (!name) {
                            const match = text.match(/^\\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\\s]{3,40}?)\\s*(?:Tel|Tlf|Dir|Ubicación|Call)/);
                            if (match) name = match[1].trim();
                        }
                        if (!name || name.length < 3 || seen.has(name)) return;
                        seen.add(name);

                        let phone = '', address = '', website = '';

                        const allLinks = card.querySelectorAll('a[href]');
                        allLinks.forEach(a => {
                            const h = a.href || '';
                            if (h.startsWith('tel:')) phone = h.replace('tel:', '').split('?')[0].trim();
                            else if (!website && h.startsWith('http') && !h.includes('paginasamarillas') && !h.includes('google')) website = h;
                        });

                        const phoneMatch = text.match(/(\\+58[\\d\\s\\-]{7,12})|(0\\d{3}[\\d\\s\\-]{7,10})|(\\d{3}[\\s-]\\d{3}[\\s-]\\d{4})|(\\d{3}\\.\\d{3}\\.\\d{4})/);
                        if (phoneMatch && !phone) {
                            phone = phoneMatch[0].trim();
                            ['Teléfono:', 'Tlf:', 'Tel:', 'Teléf:', 'TF:', 'Telf:',
                             'Teléfono', 'Tlf', 'Tel', 'Telefono', 'movil', 'fijo'].forEach(p => {
                                if (phone.startsWith(p)) phone = phone.slice(p.length).trim();
                            });
                        }

                        const addrKeywords = ['Dir:', 'Ubicación:', 'Dirección:', 'Direccion:'];
                        addrKeywords.forEach(ak => {
                            const idx = text.indexOf(ak);
                            if (idx >= 0) {
                                address = text.slice(idx + ak.length, idx + 200).split(/\\n/)[0].trim().replace(/,$/, '');
                            }
                        });

                        if (!address) {
                            const addrMatch = text.match(/(?:Calle|Av[.]|Avenida|Urb[.]|Urbanizacion|Carretera|Carrera|Edif[.]|Edificio|Centro Comercial|CC|Local|Piso|PB|Sector)\\s[^\\\\n]{5,100}/i);
                            if (addrMatch) address = addrMatch[0].trim();
                        }

                        if (phone) phone = phone.replace(/^[\\s:.-]+|[\\s:.-]+$/g, '');

                        if (name) results.push({ name, phone, address, website });
                    });

                    return results;
                }""")
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
                        source="paginas_amarillas",
                        source_url=source_url,
                    )
                    leads.append(lead)

            try:
                session.fetch(
                    source_url,
                    page_action=action,
                    load_dom=True,
                    network_idle=True,
                    timeout=60000,
                )
            except Exception:
                if len(urls) > 1:
                    try:
                        session.fetch(
                            urls[1],
                            page_action=action,
                            load_dom=True,
                            network_idle=True,
                            timeout=60000,
                        )
                    except Exception:
                        pass

        return leads