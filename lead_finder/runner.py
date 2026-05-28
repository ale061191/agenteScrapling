import os
import time
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Optional, Tuple, Callable, Dict
from lead_finder.config import Settings, get_all_venezuela_location_tuples, VENEZUELA_LOCATIONS
from lead_finder.storage import LeadStorage
from lead_finder.exporter import export_csv, export_json
from lead_finder.spiders.maps import MapsSpider
from lead_finder.spiders.google_search import GoogleSearchSpider
from lead_finder.spiders.paginas_amarillas import PaginasAmarillasSpider
from lead_finder.spiders.tiktok import TikTokSpider
from lead_finder.spiders.instagram import InstagramSpider


def _loc_string(state: str, city: str) -> str:
    return f"{city}, {state}, {Settings.country}"


def _build_loc(city: str, state: str, parish: Optional[str], sector: Optional[str]) -> str:
    parts = [city, state, "Venezuela"]
    if parish: parts.insert(0, parish)
    if sector: parts.insert(0, sector)
    return ", ".join(parts)


class Runner:
    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or Settings()
        self.storage = LeadStorage(self.settings.db_path)
        os.makedirs(self.settings.output_dir, exist_ok=True)

    def _write_progress(self, msg: str):
        try:
            sf = os.path.join(self.settings.output_dir, "search_jobs.json")
            if os.path.exists(sf):
                with open(sf, 'r', encoding='utf-8') as f:
                    jobs = json.load(f)
            else:
                jobs = {}
            for jid, job in jobs.items():
                if job.get("status") == "running":
                    job["progress"] = msg
                    with open(sf, 'w', encoding='utf-8') as f:
                        json.dump(jobs, f, indent=2)
                    break
        except Exception:
            pass

    def _run_maps(self, category: str, state: str, city: str,
                  deep: bool, max_deep: int,
                  parish: Optional[str] = None,
                  sector: Optional[str] = None) -> int:
        loc = _build_loc(city, state, parish, sector)
        where = sector or parish or city
        print(f"  [~] [maps] {category} en {where}, {state} ...")
        start = time.time()
        try:
            leads = MapsSpider(self.settings).search(category, loc, deep=deep, max_deep=max_deep,
                                                     state=state, city=city, parish=parish, sector=sector)
        except Exception as e:
            print(f"  [!] Error en {category}/{state}/{city}: {e}")
            return 0
        saved = self.storage.save_many(leads)
        elapsed = time.time() - start
        print(f"     -> {len(leads)} encontrados, {saved} nuevos ({elapsed:.0f}s)")
        return saved

    def _run_google_search(self, category: str, state: str, city: str,
                           deep: bool,
                           parish: Optional[str] = None,
                           sector: Optional[str] = None) -> int:
        loc = _build_loc(city, state, parish, sector)
        where = sector or parish or city
        print(f"  [~] [google_search] {category} en {where}, {state} ...")
        start = time.time()
        try:
            leads = GoogleSearchSpider(self.settings).search(category, loc, deep=deep,
                                                              state=state, city=city,
                                                              parish=parish, sector=sector)
        except Exception as e:
            print(f"  [!] Error en {category}/{state}/{city}: {e}")
            return 0
        saved = self.storage.save_many(leads)
        elapsed = time.time() - start
        print(f"     -> {len(leads)} encontrados, {saved} nuevos ({elapsed:.0f}s)")
        return saved

    def _run_paginas_amarillas(self, category: str, state: str, city: str,
                               parish: Optional[str] = None,
                               sector: Optional[str] = None) -> int:
        loc = _build_loc(city, state, parish, sector)
        where = sector or parish or city
        print(f"  [~] [paginas_amarillas] {category} en {where}, {state} ...")
        start = time.time()
        try:
            leads = PaginasAmarillasSpider(self.settings).search(category, loc,
                                                                  state=state, city=city,
                                                                  parish=parish, sector=sector)
        except Exception as e:
            print(f"  [!] Error en {category}/{state}/{city}: {e}")
            return 0
        saved = self.storage.save_many(leads)
        elapsed = time.time() - start
        print(f"     -> {len(leads)} encontrados, {saved} nuevos ({elapsed:.0f}s)")
        return saved

    def _run_social(self, category: str, state: str, city: str,
                    parish: Optional[str] = None,
                    sector: Optional[str] = None) -> int:
        loc = _build_loc(city, state, parish, sector)
        where = sector or parish or city
        print(f"  [~] [redes_sociales] {category} en {where}, {state} ...")
        start = time.time()
        try:
            leads = GoogleSearchSpider(self.settings).search_social(category, loc,
                                                                      state=state, city=city,
                                                                      parish=parish, sector=sector)
        except Exception as e:
            print(f"  [!] Error en {category}/{state}/{city}: {e}")
            return 0
        saved = self.storage.save_many(leads)
        elapsed = time.time() - start
        print(f"     -> {len(leads)} encontrados, {saved} nuevos ({elapsed:.0f}s)")
        return saved

    def _run_tiktok(self, category: str, state: str, city: str,
                    parish: Optional[str] = None,
                    sector: Optional[str] = None) -> int:
        loc = _build_loc(city, state, parish, sector)
        where = sector or parish or city
        print(f"  [~] [tiktok] {category} en {where}, {state} ...")
        start = time.time()
        try:
            leads = TikTokSpider(self.settings).search(category, loc,
                                                       state=state, city=city,
                                                       parish=parish, sector=sector)
        except Exception as e:
            print(f"  [!] Error en {category}/{state}/{city}: {e}")
            return 0
        saved = self.storage.save_many(leads)
        elapsed = time.time() - start
        print(f"     -> {len(leads)} encontrados, {saved} nuevos ({elapsed:.0f}s)")
        return saved

    def _run_instagram(self, category: str, state: str, city: str,
                       parish: Optional[str] = None,
                       sector: Optional[str] = None) -> int:
        loc = _build_loc(city, state, parish, sector)
        where = sector or parish or city
        print(f"  [~] [instagram] {category} en {where}, {state} ...")
        start = time.time()
        try:
            leads = InstagramSpider(self.settings).search(category, loc,
                                                          state=state, city=city,
                                                          parish=parish, sector=sector)
        except Exception as e:
            print(f"  [!] Error en {category}/{state}/{city}: {e}")
            return 0
        saved = self.storage.save_many(leads)
        elapsed = time.time() - start
        print(f"     -> {len(leads)} encontrados, {saved} nuevos ({elapsed:.0f}s)")
        return saved

    def _run_sources(self, category: str, state: str, city: str,
                     deep: bool, max_deep: int,
                     include_google_search: bool,
                     include_paginas_amarillas: bool,
                     include_social: bool,
                     include_tiktok: bool = False,
                     include_instagram: bool = False,
                     parish: Optional[str] = None,
                     sector: Optional[str] = None) -> int:
        total = self._run_maps(category, state, city, deep, max_deep, parish, sector)
        if include_google_search:
            total += self._run_google_search(category, state, city, deep, parish, sector)
        if include_paginas_amarillas:
            total += self._run_paginas_amarillas(category, state, city, parish, sector)
        if include_social:
            total += self._run_social(category, state, city, parish, sector)
        if include_tiktok:
            total += self._run_tiktok(category, state, city, parish, sector)
        if include_instagram:
            total += self._run_instagram(category, state, city, parish, sector)
        return total

    def run_all(self, deep: bool = False, max_deep: int = 5,
                include_google_search: bool = False,
                include_paginas_amarillas: bool = False,
                include_social: bool = False,
                include_tiktok: bool = False,
                include_instagram: bool = False) -> int:
        total = 0
        print(f"\n{'='*60}")
        print(f"  LEAD FINDER - Venezuela (todo el pais)")
        print(f"  Deep mode: {deep} (max {max_deep} por busqueda)")
        print(f"{'='*60}\n")

        locs = get_all_venezuela_location_tuples()
        for cat in self.settings.categories:
            for s, c in locs:
                total += self._run_sources(cat, s, c, deep, max_deep,
                                           include_google_search,
                                           include_paginas_amarillas,
                                           include_social,
                                           include_tiktok=include_tiktok,
                                           include_instagram=include_instagram)

        print(f"\n{'='*60}")
        print(f"  [+] Total leads nuevos: {total}")
        print(f"  [#] Total en base de datos: {self.storage.count()}")
        print(f"{'='*60}\n")
        return total

    def run_category(self, category: str, location: Optional[str] = None,
                     deep: bool = False, max_deep: int = 5,
                     state: Optional[str] = None,
                     city: Optional[str] = None,
                     parish: Optional[str] = None,
                     sector: Optional[str] = None,
                     include_google_search: bool = False,
                     include_paginas_amarillas: bool = False,
                     include_social: bool = False,
                     include_tiktok: bool = False,
                     include_instagram: bool = False) -> int:
        total = 0

        def _run_sources_for(s, c):
            return self._run_sources(category, s, c, deep, max_deep,
                                     include_google_search,
                                     include_paginas_amarillas,
                                     include_social,
                                     include_tiktok=include_tiktok,
                                     include_instagram=include_instagram,
                                     parish=parish, sector=sector)

        if state and city:
            total += _run_sources_for(state, city)
        elif state:
            for c in VENEZUELA_LOCATIONS.get(state, []):
                total += _run_sources_for(state, c)
        elif location:
            for loc in [location]:
                print(f"  [~] Buscando: {category} en {loc} ...")
                start = time.time()

                try:
                    leads = MapsSpider(self.settings).search(category, loc, deep=deep, max_deep=max_deep)
                    saved = self.storage.save_many(leads)
                    total += saved
                    print(f"     [maps] {len(leads)} encontrados, {saved} nuevos")
                except Exception as e:
                    print(f"  [!] Error en maps: {e}")

                if include_google_search:
                    try:
                        leads = GoogleSearchSpider(self.settings).search(category, loc, deep=deep)
                        saved = self.storage.save_many(leads)
                        total += saved
                        print(f"     [google_search] {len(leads)} encontrados, {saved} nuevos")
                    except Exception as e:
                        print(f"  [!] Error en google_search: {e}")

                if include_paginas_amarillas:
                    try:
                        leads = PaginasAmarillasSpider(self.settings).search(category, loc)
                        saved = self.storage.save_many(leads)
                        total += saved
                        print(f"     [paginas_amarillas] {len(leads)} encontrados, {saved} nuevos")
                    except Exception as e:
                        print(f"  [!] Error en paginas_amarillas: {e}")

                if include_social:
                    try:
                        leads = GoogleSearchSpider(self.settings).search_social(category, loc)
                        saved = self.storage.save_many(leads)
                        total += saved
                        print(f"     [social] {len(leads)} encontrados, {saved} nuevos")
                    except Exception as e:
                        print(f"  [!] Error en social: {e}")

                if include_tiktok:
                    try:
                        leads = TikTokSpider(self.settings).search(category, loc)
                        saved = self.storage.save_many(leads)
                        total += saved
                        print(f"     [tiktok] {len(leads)} encontrados, {saved} nuevos")
                    except Exception as e:
                        print(f"  [!] Error en tiktok: {e}")

                if include_instagram:
                    try:
                        leads = InstagramSpider(self.settings).search(category, loc)
                        saved = self.storage.save_many(leads)
                        total += saved
                        print(f"     [instagram] {len(leads)} encontrados, {saved} nuevos")
                    except Exception as e:
                        print(f"  [!] Error en instagram: {e}")

                elapsed = time.time() - start
                print(f"     -> Total: {total} nuevos ({elapsed:.0f}s)")
        else:
            for s, c in get_all_venezuela_location_tuples():
                total += _run_sources_for(s, c)

        return total

    def export(self):
        leads = self.storage.get_all()
        export_csv(leads, self.settings.csv_path)
        export_json(leads, self.settings.json_path)
        print(f"  [-] Exportados {len(leads)} leads a:")
        print(f"     - {self.settings.csv_path}")
        print(f"     - {self.settings.json_path}")

    def stats(self):
        s = self.storage.stats()
        print(f"\n  [#] Total leads: {s['total']}")
        print(f"  [#] Con telefono: {s['with_phone']}")
        print(f"  [#] Con website: {s['with_website']}")
        print(f"  [#] Con direccion: {s['with_address']}")
        print(f"  [#] Rating promedio: {s['avg_rating']}")
        print(f"\n  Por estado:")
        for st, cnt in sorted(s['by_status'].items()):
            print(f"     - {st}: {cnt}")
        print(f"\n  Por categoria:")
        for cat, cnt in sorted(s['by_category'].items()):
            print(f"     - {cat}: {cnt}")
        print(f"\n  Por estado (Venezuela):")
        for st, cnt in sorted(s.get('by_state', {}).items()):
            print(f"     - {st}: {cnt}")
        print()
