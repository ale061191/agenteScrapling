import csv
import json
import os
from typing import List
from lead_finder.models import Lead


def export_csv(leads: List[Lead], filepath: str):
    os.makedirs(os.path.dirname(filepath) or ".", exist_ok=True)
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "name", "category", "state", "city", "location", "address", "phone",
            "website", "email", "facebook", "instagram", "twitter",
            "rating", "reviews_count", "source", "source_url", "timestamp"
        ])
        writer.writeheader()
        for lead in leads:
            writer.writerow({
                "name": lead.name,
                "category": lead.category,
                "state": lead.state or "",
                "city": lead.city or "",
                "location": lead.location,
                "address": lead.address or "",
                "phone": lead.phone or "",
                "website": lead.website or "",
                "email": lead.email or "",
                "facebook": lead.facebook or "",
                "instagram": lead.instagram or "",
                "twitter": lead.twitter or "",
                "rating": lead.rating or "",
                "reviews_count": lead.reviews_count or "",
                "source": lead.source,
                "source_url": lead.source_url,
                "timestamp": lead.timestamp,
            })


def export_json(leads: List[Lead], filepath: str):
    os.makedirs(os.path.dirname(filepath) or ".", exist_ok=True)
    data = []
    for lead in leads:
        data.append({
            "name": lead.name,
            "category": lead.category,
            "state": lead.state,
            "city": lead.city,
            "location": lead.location,
            "address": lead.address,
            "phone": lead.phone,
            "website": lead.website,
            "email": lead.email,
            "facebook": lead.facebook,
            "instagram": lead.instagram,
            "twitter": lead.twitter,
            "rating": lead.rating,
            "reviews_count": lead.reviews_count,
            "source": lead.source,
            "source_url": lead.source_url,
            "timestamp": lead.timestamp,
            "notes": lead.notes,
        })
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
