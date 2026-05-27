'use client'

import { useState, useMemo, useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

interface Lead {
  id: number; name: string; category: string; location: string
  state: string | null; city: string | null; address: string | null
  phone: string | null; website: string | null; email: string | null
  facebook: string | null; instagram: string | null; twitter: string | null
  rating: number | null; reviews_count: number | null
  source: string; source_url: string; timestamp: string
  notes: string; status: string; changed_at?: string
}

interface Props {
  leads: Lead[]
  onSelectLead: (lead: Lead) => void
}

interface StateGroup {
  state: string
  leads: Lead[]
  accepted: number
  lat: number
  lng: number
}

const STATE_LOCATIONS: Record<string, [number, number]> = {
  "Zulia": [10.6, -72.0],
  "Falcon": [11.2, -69.9],
  "Lara": [10.1, -69.6],
  "Yaracuy": [10.4, -68.7],
  "Carabobo": [10.2, -68.0],
  "Aragua": [10.3, -67.5],
  "La Guaira": [10.6, -66.9],
  "Distrito Capital": [10.48, -66.90],
  "Miranda": [10.3, -66.5],
  "Trujillo": [9.4, -70.5],
  "Portuguesa": [9.1, -69.2],
  "Cojedes": [9.5, -68.5],
  "Guarico": [8.8, -67.0],
  "Anzoategui": [9.0, -64.6],
  "Sucre": [10.5, -63.8],
  "Monagas": [9.5, -63.2],
  "Delta Amacuro": [9.0, -61.5],
  "Nueva Esparta": [11.0, -63.9],
  "Merida": [8.5, -71.2],
  "Tachira": [7.8, -72.2],
  "Barinas": [8.1, -70.2],
  "Apure": [7.1, -68.5],
  "Bolivar": [6.5, -64.0],
  "Amazonas": [3.5, -66.0],
}

export default function VenezuelaMap({ leads, onSelectLead }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const stateGroups: StateGroup[] = useMemo(() => {
    const groups: Record<string, StateGroup> = {}
    leads.forEach(lead => {
      const st = lead.state || 'Desconocido'
      if (!groups[st]) {
        const loc = STATE_LOCATIONS[st] || [6.0, -66.0]
        groups[st] = { state: st, leads: [], accepted: 0, lat: loc[0], lng: loc[1] }
      }
      groups[st].leads.push(lead)
      if (lead.status === 'aceptado') groups[st].accepted++
    })
    return Object.values(groups).filter(g => g.accepted > 0)
  }, [leads])

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-[350px] bg-gray-50 rounded-lg text-sm text-gray-400">
        Cargando mapa...
      </div>
    )
  }

  return (
    <div className="h-[350px] w-full rounded-lg overflow-hidden border border-gray-200">
      <MapContainer center={[8.0, -66.0]} zoom={5.5} scrollWheelZoom={false}
        className="h-full w-full" zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {stateGroups.map(g => {
          const r = Math.min(8 + g.accepted * 2, 20)
          return (
            <CircleMarker key={g.state} center={[g.lat, g.lng]} radius={r}
              pathOptions={{ color: '#22c55e', fillColor: 'rgba(34,197,94,0.7)', fillOpacity: 0.7, weight: 2 }}
              eventHandlers={{
                click: () => {
                  if (g.leads.length === 1 && g.leads[0].status === 'aceptado') {
                    onSelectLead(g.leads[0])
                  }
                },
              }}>
              <Tooltip direction="top" offset={[0, -r]}>
                <div className="text-xs">
                  <div className="font-semibold">{g.state}</div>
                  <div>{g.accepted} aceptado{g.accepted !== 1 ? 's' : ''}</div>
                  <div>{g.leads.length} total{g.leads.length !== 1 ? 'es' : ''}</div>
                </div>
              </Tooltip>
              {g.accepted > 1 && (
                <CircleMarker center={[g.lat, g.lng]} radius={r}
                  pathOptions={{ color: 'white', fillColor: 'transparent', fillOpacity: 0, weight: 2 }}
                  pane="marker">
                  <Tooltip permanent direction="center" className="bg-transparent border-0 shadow-none">
                    <span className="text-white font-bold text-xs pointer-events-none" style={{textShadow: '0 1px 2px rgba(0,0,0,0.5)'}}>
                      {g.accepted}
                    </span>
                  </Tooltip>
                </CircleMarker>
              )}
            </CircleMarker>
          )
        })}
      </MapContainer>
    </div>
  )
}
