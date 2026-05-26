from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class Lead:
    name: str
    category: str
    location: str
    state: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    facebook: Optional[str] = None
    instagram: Optional[str] = None
    twitter: Optional[str] = None
    rating: Optional[float] = None
    reviews_count: Optional[int] = None
    source: str = "google_maps"
    source_url: str = ""
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    notes: str = ""
    status: str = "frio"
    id: Optional[int] = None
