from dataclasses import dataclass, field
from typing import Dict, List, Optional


BUSINESS_CATEGORIES = [
    "restaurantes",
    "hoteles",
    "centros comerciales",
    "gimnasios",
    "hospitales",
    "clínicas",
    "discotecas",
    "clubes nocturnos",
    "parques",
    "aeropuertos",
    "bares",
    "cafeterías",
    "centros deportivos",
    "cines",
    "universidades",
    "supermercados",
    "teatros",
    "centros de convenciones",
    "plazas",
    "farmacias",
]

# Venezuela state -> cities hierarchy
VENEZUELA_LOCATIONS: Dict[str, List[str]] = {
    "Distrito Capital": [
        "Caracas",
    ],
    "Miranda": [
        "Los Teques",
        "Guarenas",
        "Guatire",
        "Charallave",
        "Cúa",
        "Santa Teresa",
        "San Antonio de los Altos",
    ],
    "La Guaira": [
        "La Guaira",
        "Macuto",
        "Maiquetía",
        "Catia La Mar",
    ],
    "Carabobo": [
        "Valencia",
        "Puerto Cabello",
        "Naguanagua",
        "San Diego",
        "Guacara",
    ],
    "Zulia": [
        "Maracaibo",
        "Cabimas",
        "Ciudad Ojeda",
        "Santa Rita",
    ],
    "Lara": [
        "Barquisimeto",
        "Cabudare",
    ],
    "Aragua": [
        "Maracay",
        "Turmero",
        "Cagua",
        "La Victoria",
        "Villa de Cura",
    ],
    "Bolívar": [
        "Puerto Ordaz",
        "San Félix",
        "Ciudad Bolívar",
        "Upata",
    ],
    "Anzoátegui": [
        "Barcelona",
        "Puerto La Cruz",
        "Lechería",
        "El Tigre",
        "Anaco",
    ],
    "Sucre": [
        "Cumaná",
        "Carúpano",
    ],
    "Monagas": [
        "Maturín",
    ],
    "Falcón": [
        "Coro",
        "Punto Fijo",
    ],
    "Nueva Esparta": [
        "Porlamar",
        "Pampatar",
        "La Asunción",
    ],
    "Táchira": [
        "San Cristóbal",
    ],
    "Mérida": [
        "Mérida",
        "El Vigía",
    ],
    "Trujillo": [
        "Valera",
    ],
    "Barinas": [
        "Barinas",
    ],
    "Portuguesa": [
        "Acarigua",
        "Guanare",
    ],
    "Yaracuy": [
        "San Felipe",
    ],
    "Cojedes": [
        "San Carlos",
    ],
    "Guárico": [
        "Valle de la Pascua",
        "San Juan de los Morros",
        "Calabozo",
    ],
    "Apure": [
        "San Fernando de Apure",
    ],
    "Delta Amacuro": [
        "Tucupita",
    ],
    "Amazonas": [
        "Puerto Ayacucho",
    ],
}


def get_all_venezuela_location_tuples() -> List[tuple]:
    """Returns list of (state, city) tuples for all locations."""
    result = []
    for state, cities in VENEZUELA_LOCATIONS.items():
        for city in cities:
            result.append((state, city))
    return result


def get_flat_locations() -> List[str]:
    """Returns flat list of 'city, state' strings (backward compat)."""
    return [f"{city}, {state}" for state, cities in VENEZUELA_LOCATIONS.items() for city in cities]


@dataclass
class Settings:
    categories: List[str] = field(default_factory=lambda: BUSINESS_CATEGORIES)
    locations: List[str] = field(default_factory=lambda: get_flat_locations())
    scroll_times: int = 5
    scroll_delay_ms: int = 300
    max_results_per_search: int = 0
    headless: bool = True
    country: str = "Venezuela"
    output_dir: str = "leads_data"
    db_path: str = "leads_data/leads.db"
    csv_path: str = "leads_data/leads.csv"
    json_path: str = "leads_data/leads.json"
