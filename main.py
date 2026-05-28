#!/usr/bin/env python3
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lead_finder.config import Settings, BUSINESS_CATEGORIES, VENEZUELA_LOCATIONS
from lead_finder.runner import Runner
from lead_finder.campaign import send_campaign, send_campaign_by_filters, load_smtp_config, save_smtp_config


def print_banner():
    print()
    print("  == Nova Tech AI - Lead Finder Venezuela ==")
    print("  Prospeccion comercial inteligente con Scrapling")
    print()

def print_menu():
    print("  Comandos:")
    print("    run                                     Todas categorias, todo Venezuela")
    print("    run <categoria> [estado] [ciudad]       Buscar en Venezuela")
    print("    run --deep [categoria] [estado] [ciudad] Deep mode (telefono/web)")
    print("    run --gs   [categoria] [estado] [ciudad] + Google Search (local pack)")
    print("    run --pa   [categoria] [estado] [ciudad] + Paginas Amarillas VE (telefonos)")
    print("    run --social [categoria] [estado] [ciudad] + Redes Sociales (Facebook/Instagram)")
    print("    run --tiktok [categoria] [estado] [ciudad] + TikTok (perfiles)")
    print("    run --instagram [categoria] [estado] [ciudad] + Instagram (perfiles)")
    print("    export                                  Exportar a CSV/JSON")
    print("    delete --all                            Eliminar todos los leads")
    print("    delete --ids 1,2,3                      Eliminar leads por IDs")
    print("    delete --id 123                         Eliminar un lead")
    print("    campaign config                         Configurar SMTP (Gmail)")
    print("    campaign send --ids 1,2,3               Enviar campana a leads especificos")
    print("    campaign send --filters ...             Enviar campana por filtros")
    print("    campaign history                        Ver historial de envios")
    print("    supabase-sync                           Sincronizar con Supabase")
    print("    stats                                   Estadisticas")
    print("    categories                              Listar categorias")
    print("    locations                               Listar estados/ciudades")
    print("    help                                    Ayuda")
    print("    exit                                    Salir")
    print()

def parse_location_args(args: list, start_idx: int):
    """Parse optional state, city, parish, sector from args. Returns (state, city, parish, sector)."""
    state = None
    city = None
    parish = None
    sector = None
    remaining = args[start_idx:]
    if remaining:
        state = remaining[0]
        if len(remaining) > 1:
            city = remaining[1]
        if len(remaining) > 2:
            parish = remaining[2]
        if len(remaining) > 3:
            sector = remaining[3]
    return state, city, parish, sector

def main():
    print_banner()
    settings = Settings()
    runner = Runner(settings)

    if len(sys.argv) > 1:
        args = sys.argv[1:]
        deep = "--deep" in args
        gs = "--gs" in args
        pa = "--pa" in args
        social = "--social" in args
        tiktok = "--tiktok" in args
        instagram = "--instagram" in args
        max_deep = None
        if "--max-deep" in args:
            idx = args.index("--max-deep")
            try:
                max_deep = int(args[idx + 1])
            except (ValueError, IndexError):
                pass
        args = [a for a in args if a not in ("--deep", "--gs", "--pa", "--social", "--tiktok", "--instagram")]
        args = [a for i, a in enumerate(args) if not (a == "--max-deep" or (i > 0 and args[i-1] == "--max-deep"))]
        cmd = args[0].lower() if args else "help"
        if cmd == "run":
            cat = args[1] if len(args) > 1 else None
            state, city, parish, sector = parse_location_args(args, 2) if cat else (None, None, None, None)
            state = state.replace("_", " ") if state else None
            city = city.replace("_", " ") if city else None
            parish = parish.replace("_", " ") if parish else None
            sector = sector.replace("_", " ") if sector else None
            kw = dict(deep=deep, include_google_search=gs, include_paginas_amarillas=pa, include_social=social, include_tiktok=tiktok, include_instagram=instagram)
            if max_deep is not None:
                kw['max_deep'] = max_deep
            if cat and state and city:
                runner.run_category(cat, state=state, city=city, parish=parish, sector=sector, **kw)
            elif cat and state:
                runner.run_category(cat, state=state, **kw)
            elif cat:
                runner.run_category(cat, **kw)
            else:
                runner.run_all(deep=deep, include_google_search=gs, include_paginas_amarillas=pa, include_social=social, include_tiktok=tiktok)
            runner.export()
        elif cmd == "export":
            runner.export()
        elif cmd == "stats":
            if "--trend" in sys.argv[1:]:
                import json as _json
                lead_trend = runner.storage.get_lead_trend(30)
                campaign_trend = runner.storage.get_campaign_trend(30)
                print(_json.dumps({"lead_trend": lead_trend, "campaign_trend": campaign_trend}))
            else:
                runner.stats()
        elif cmd == "categories":
            print("\n  Categorias:")
            for c in BUSINESS_CATEGORIES: print(f"    - {c}")
        elif cmd == "delete":
            if "--all" in sys.argv[1:]:
                n = runner.storage.delete_all()
                runner.export()
                print(f"  [-] Eliminados {n} leads")
            elif "--ids" in sys.argv[1:]:
                idx = sys.argv[1:].index("--ids")
                ids = [int(x) for x in sys.argv[1:][idx+1].split(",")]
                n = runner.storage.delete_leads(ids)
                runner.export()
                print(f"  [-] Eliminados {n} leads")
            elif "--id" in sys.argv[1:]:
                idx = sys.argv[1:].index("--id")
                lid = int(sys.argv[1:][idx+1])
                ok = runner.storage.delete_lead(lid)
                runner.export()
                print(f"  [-] {'Eliminado' if ok else 'No encontrado'} lead {lid}")
        elif cmd == "campaign":
            sub = sys.argv[2] if len(sys.argv) > 2 else ""
            all_args = sys.argv[3:]
            if sub == "config":
                if "--show" in all_args:
                    cfg = load_smtp_config()
                    if cfg:
                        print(f"  Host: {cfg.get('host')}")
                        print(f"  Port: {cfg.get('port')}")
                        print(f"  User: {cfg.get('user')}")
                        print(f"  From: {cfg.get('from_name')}")
                        print(f"  Configurado: Si")
                    else:
                        print("  No configurado")
                elif "--set" in all_args:
                    def _arg_val(flag):
                        if flag in all_args:
                            return all_args[all_args.index(flag) + 1]
                        return None
                    host = _arg_val("--host") or input("  SMTP host (default smtp.gmail.com): ") or "smtp.gmail.com"
                    port = int(_arg_val("--port") or input("  SMTP port (default 587): ") or "587")
                    user = _arg_val("--user") or input("  Correo Gmail: ")
                    pwd = _arg_val("--password") or input("  App Password (16 caracteres): ")
                    name = _arg_val("--from-name") or input("  Nombre del remitente (default Nova Tech AI): ") or "Nova Tech AI"
                    save_smtp_config(host, port, user, pwd, from_name=name)
                    print("  [+] Config SMTP guardada en leads_data/smtp_config.json")
                else:
                    host = input("  SMTP host (default smtp.gmail.com): ") or "smtp.gmail.com"
                    port = int(input("  SMTP port (default 587): ") or "587")
                    user = input("  Correo Gmail: ")
                    pwd = input("  App Password (16 caracteres): ")
                    name = input("  Nombre del remitente (default Nova Tech AI): ") or "Nova Tech AI"
                    save_smtp_config(host, port, user, pwd, from_name=name)
                    print("  [+] Config SMTP guardada en leads_data/smtp_config.json")
            elif sub == "send":
                def _arg_val(flag):
                    if flag in all_args:
                        return all_args[all_args.index(flag) + 1]
                    return None
                subject = _arg_val("--subject") or input("  Asunto: ")
                body_from_arg = _arg_val("--body")
                if body_from_arg:
                    body_html = body_from_arg
                else:
                    print("  Cuerpo del mensaje (linea en blanco + Ctrl+Z + Enter para terminar):")
                    lines = []
                    while True:
                        try:
                            line = input()
                        except EOFError:
                            break
                        lines.append(line)
                    body = "\n".join(lines)
                    body_html = body.replace("\n", "<br>")

                attach_paths = []
                while "--attach" in all_args:
                    i = all_args.index("--attach")
                    attach_paths.append(all_args[i + 1])
                    all_args = all_args[:i] + all_args[i+2:]

                ids = None
                filters = None
                for a in all_args:
                    if a.startswith("--ids="):
                        ids = [int(x) for x in a.split("=", 1)[1].split(",")]
                    elif a.startswith("--filters="):
                        filters = dict(kv.split("=") for kv in a.split("=", 1)[1].split(","))

                if ids:
                    r = send_campaign(ids, subject, body_html, attachment_paths=attach_paths or None, storage=runner.storage)
                elif filters:
                    r = send_campaign_by_filters(subject, body_html, filters, attachment_paths=attach_paths or None, storage=runner.storage)
                else:
                    print("  [!] Usa --ids=X o --filters=key=val,...")
                    r = {"sent": 0}
                print(f"  [+] Enviados: {r.get('sent', 0)}")
                for res in r.get("results", []):
                    st = "OK" if res["status"] == "sent" else "ERR"
                    print(f"     [{st}] Lead {res['lead_id']}: {res.get('recipient', '?')} - {res.get('error', '')}")
            elif sub == "history":
                logs = runner.storage.get_campaign_log(20)
                if not logs:
                    print("  [-] No hay envios registrados")
                else:
                    for log in logs:
                        print(f"  [{log['sent_at'][:19]}] Lead {log['lead_id']} -> {log.get('recipient','?')}: {log['status']} {log.get('error','')}")
        elif cmd == "supabase-sync":
            from lead_finder.supabase_sync import main as supabase_sync_main
            supabase_sync_main()
        elif cmd == "locations":
            print("\n  Estados y ciudades de Venezuela:")
            for state, cities in VENEZUELA_LOCATIONS.items():
                print(f"    {state}: {', '.join(cities[:5])}")
                if len(cities) > 5:
                    print(f"      ... y {len(cities)-5} mas")
        else:
            print_menu()
        return

    print_menu()
    while True:
        try:
            cmd = input("  nova_tech> ").strip()
        except (EOFError, KeyboardInterrupt):
            print(); break
        if not cmd: continue
        if cmd == "exit": break
        args = cmd.split()
        deep = "--deep" in args
        gs = "--gs" in args
        pa = "--pa" in args
        social = "--social" in args
        tiktok = "--tiktok" in args
        instagram = "--instagram" in args
        max_deep = None
        if "--max-deep" in args:
            idx = args.index("--max-deep")
            try:
                max_deep = int(args[idx + 1])
            except (ValueError, IndexError):
                pass
        args = [a for a in args if a not in ("--deep", "--gs", "--pa", "--social", "--tiktok", "--instagram")]
        args = [a for i, a in enumerate(args) if not (a == "--max-deep" or (i > 0 and args[i-1] == "--max-deep"))]
        c = args[0].lower() if args else ""
        if c == "run":
            cat = args[1] if len(args) > 1 else None
            state, city, parish, sector = parse_location_args(args, 2) if cat else (None, None, None, None)
            state = state.replace("_", " ") if state else None
            city = city.replace("_", " ") if city else None
            parish = parish.replace("_", " ") if parish else None
            sector = sector.replace("_", " ") if sector else None
            kw = dict(deep=deep, include_google_search=gs, include_paginas_amarillas=pa, include_social=social, include_tiktok=tiktok, include_instagram=instagram)
            if max_deep is not None:
                kw['max_deep'] = max_deep
            if cat and state and city:
                runner.run_category(cat, state=state, city=city, parish=parish, sector=sector, **kw)
            elif cat and state:
                runner.run_category(cat, state=state, **kw)
            elif cat:
                runner.run_category(cat, **kw)
            else:
                runner.run_all(deep=deep, include_google_search=gs, include_paginas_amarillas=pa, include_social=social, include_tiktok=tiktok)
            runner.export()
        elif c == "export": runner.export()
        elif c == "stats":
            if "--trend" in args:
                import json as _json
                lt = runner.storage.get_lead_trend(30)
                ct = runner.storage.get_campaign_trend(30)
                print(_json.dumps({"lead_trend": lt, "campaign_trend": ct}))
            else:
                runner.stats()
        elif c == "categories":
            print("\n  Categorias:")
            for c in BUSINESS_CATEGORIES: print(f"    - {c}")
        elif c == "locations":
            print("\n  Estados y ciudades de Venezuela:")
            for state, cities in VENEZUELA_LOCATIONS.items():
                print(f"    {state}: {', '.join(cities[:5])}")
                if len(cities) > 5:
                    print(f"      ... y {len(cities)-5} mas")
        elif c == "delete":
            if "--all" in args:
                n = runner.storage.delete_all()
                runner.export()
                print(f"  [-] Eliminados {n} leads")
            elif "--ids" in args:
                idx = args.index("--ids")
                ids = [int(x) for x in args[idx+1].split(",")]
                n = runner.storage.delete_leads(ids)
                runner.export()
                print(f"  [-] Eliminados {n} leads")
            elif "--id" in args:
                idx = args.index("--id")
                lid = int(args[idx+1])
                ok = runner.storage.delete_lead(lid)
                runner.export()
                print(f"  [-] {'Eliminado' if ok else 'No encontrado'} lead {lid}")
        elif c == "campaign":
            sub = args[1] if len(args) > 1 else ""
            if sub == "config":
                host = input("  SMTP host (default smtp.gmail.com): ") or "smtp.gmail.com"
                port = int(input("  SMTP port (default 587): ") or "587")
                user = input("  Correo Gmail: ")
                pwd = input("  App Password (16 caracteres): ")
                name = input("  Nombre del remitente (default Nova Tech AI): ") or "Nova Tech AI"
                save_smtp_config(host, port, user, pwd, from_name=name)
                print("  [+] Configuracion SMTP guardada")
            elif sub == "send":
                subject = input("  Asunto: ")
                print("  Cuerpo del mensaje (linea en blanco + Ctrl+Z + Enter para terminar):")
                lines = []
                while True:
                    try:
                        line = input()
                    except EOFError:
                        break
                    lines.append(line)
                body = "\n".join(lines)
                body_html = body.replace("\n", "<br>")
                if "--ids" in args:
                    idx = args.index("--ids")
                    ids = [int(x) for x in args[idx+1].split(",")]
                    r = send_campaign(ids, subject, body_html, storage=runner.storage)
                elif "--filters" in args:
                    idx = args.index("--filters")
                    filters = dict(kv.split("=") for kv in args[idx+1].split(","))
                    r = send_campaign_by_filters(subject, body_html, filters, storage=runner.storage)
                else:
                    print("  [!] Usa --ids o --filters")
                    r = {"sent": 0}
                print(f"  [+] Enviados: {r.get('sent', 0)}")
                for res in r.get("results", []):
                    st = "OK" if res["status"] == "sent" else "ERR"
                    print(f"     [{st}] Lead {res['lead_id']}: {res.get('recipient', '?')} - {res.get('error', '')}")
            elif sub == "history":
                logs = runner.storage.get_campaign_log(20)
                if not logs:
                    print("  [-] No hay envios registrados")
                else:
                    for log in logs:
                        print(f"  [{log['sent_at'][:19]}] Lead {log['lead_id']} -> {log.get('recipient','?')}: {log['status']} {log.get('error','')}")
        elif c == "supabase-sync":
            from lead_finder.supabase_sync import main as supabase_sync_main
            supabase_sync_main()
        elif c == "help": print_menu()
        else: print("  [!] Desconocido. Escribe 'help'.")

if __name__ == "__main__":
    main()
