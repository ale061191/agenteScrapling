import os
import json
import smtplib
import mimetypes
from datetime import datetime
from email.message import EmailMessage
from typing import List, Optional, Dict, Any
from lead_finder.storage import LeadStorage
from lead_finder.models import Lead

CONFIG_PATH = os.path.join("leads_data", "smtp_config.json")


def load_smtp_config() -> Optional[Dict[str, Any]]:
    try:
        with open(CONFIG_PATH, "r") as f:
            cfg = json.load(f)
        if cfg.get("password") or os.environ.get("SMTP_PASSWORD"):
            return cfg
        return None
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def save_smtp_config(host: str, port: int, user: str, password: str,
                     use_tls: bool = True, from_name: str = "Lead Finder") -> bool:
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    cfg = {
        "host": host,
        "port": port,
        "user": user,
        "password": password,
        "use_tls": use_tls,
        "from_name": from_name,
        "configured": True,
    }
    with open(CONFIG_PATH, "w") as f:
        json.dump(cfg, f, indent=2)
    return True


def get_password() -> Optional[str]:
    cfg = load_smtp_config()
    if cfg:
        return cfg.get("password") or os.environ.get("SMTP_PASSWORD")
    return os.environ.get("SMTP_PASSWORD")


def send_campaign(lead_ids: List[int],
                  subject: str,
                  body_html: str,
                  attachment_paths: Optional[List[str]] = None,
                  storage: Optional[LeadStorage] = None,
                  smtp_cfg: Optional[Dict[str, Any]] = None,
                  ) -> Dict[str, Any]:
    cfg = smtp_cfg or load_smtp_config()
    if not cfg:
        return {"success": False, "error": "SMTP no configurado"}

    password = cfg.get("password") or os.environ.get("SMTP_PASSWORD")
    if not password:
        return {"success": False, "error": "Contrasena SMTP no disponible"}

    if storage is None:
        storage = LeadStorage()

    results = []
    for lid in lead_ids:
        lead = storage.get_by_id(lid)
        if not lead:
            results.append({"lead_id": lid, "status": "error", "error": "Lead no encontrado"})
            continue

        recipient = lead.email
        if not recipient:
            results.append({"lead_id": lid, "status": "error", "error": "Sin correo"})
            storage.log_campaign(lid, subject, "", "error", "Sin direccion de correo")
            continue

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = f"{cfg.get('from_name', 'Lead Finder')} <{cfg['user']}>"
        msg["To"] = recipient
        msg.set_content(
            body_html.replace("<br>", "\n").replace("</p>", "\n").replace("<[^>]+>", ""),
        )
        msg.add_alternative(body_html, subtype="html")

        if attachment_paths:
            for path in attachment_paths:
                if os.path.exists(path):
                    with open(path, "rb") as f:
                        data = f.read()
                    ctype, _ = mimetypes.guess_type(path)
                    maintype, subtype = (ctype or "application/octet-stream").split("/", 1)
                    msg.add_attachment(data, maintype=maintype, subtype=subtype,
                                       filename=os.path.basename(path))

        try:
            with smtplib.SMTP(cfg["host"], cfg["port"], timeout=30) as server:
                if cfg.get("use_tls", True):
                    server.starttls()
                server.login(cfg["user"], password)
                server.send_message(msg)
            storage.log_campaign(lid, subject, recipient, "sent", None)
            results.append({"lead_id": lid, "status": "sent", "recipient": recipient})
        except Exception as e:
            storage.log_campaign(lid, subject, recipient, "error", str(e))
            results.append({"lead_id": lid, "status": "error", "error": str(e)})

    return {"success": True, "results": results, "sent": sum(1 for r in results if r["status"] == "sent")}


def send_campaign_by_filters(subject: str, body_html: str,
                             filters: Optional[Dict[str, str]] = None,
                             attachment_paths: Optional[List[str]] = None,
                             storage: Optional[LeadStorage] = None) -> Dict[str, Any]:
    if storage is None:
        storage = LeadStorage()
    leads = storage.get_all(**(filters or {}))
    lead_ids = [l.id for l in leads if l.id]
    return send_campaign(lead_ids, subject, body_html, attachment_paths, storage)