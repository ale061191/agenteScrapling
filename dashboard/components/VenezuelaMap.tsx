'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip, ZoomControl, useMap } from 'react-leaflet'
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
  onSelectState?: (state: string) => void
  active: boolean
}

interface StateGroup {
  state: string; leads: Lead[]; accepted: number; lat: number; lng: number
}

const STATE_LOCATIONS: Record<string, [number, number]> = {
  "Zulia": [10.6, -72.0], "Falcon": [11.2, -69.9], "Lara": [10.1, -69.6],
  "Yaracuy": [10.4, -68.7], "Carabobo": [10.2, -68.0], "Aragua": [10.3, -67.5],
  "La Guaira": [10.6, -66.9], "Distrito Capital": [10.48, -66.90],
  "Miranda": [10.3, -66.5], "Trujillo": [9.4, -70.5], "Portuguesa": [9.1, -69.2],
  "Cojedes": [9.5, -68.5], "Guarico": [8.8, -67.0], "Anzoategui": [9.0, -64.6],
  "Sucre": [10.5, -63.8], "Monagas": [9.5, -63.2], "Delta Amacuro": [9.0, -61.5],
  "Nueva Esparta": [11.0, -63.9], "Merida": [8.5, -71.2], "Tachira": [7.8, -72.2],
  "Barinas": [8.1, -70.2], "Apure": [7.1, -68.5], "Bolivar": [6.5, -64.0],
  "Amazonas": [3.5, -66.0],
}

const VENEZUELA_BOUNDS: [[number, number], [number, number]] = [[0.5, -75.0], [13.0, -59.5]]

function MapUpdater({ active }: { active: boolean }) {
  const map = useMap()
  const prevActive = useRef(active)

  useEffect(() => {
    if (active && !prevActive.current) {
      setTimeout(() => map.invalidateSize(), 80)
    }
    prevActive.current = active
  }, [active, map])

  return null
}

function MapMarkers({ leads, onSelectState, visible }: { leads: Lead[], onSelectState?: (state: string) => void, visible: boolean }) {
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

  // removed early return for !visible to prevent Leaflet _removePath errors when hiding map

  return (
    <>
      {stateGroups.map(g => {
        const r = Math.min(10 + g.accepted * 2.5, 26)
        const firstAccepted = g.leads.find(l => l.status === 'aceptado')
        return (
          <React.Fragment key={g.state}>
            <CircleMarker center={[g.lat, g.lng]} radius={r}
              pathOptions={{
                color: '#16a34a',
                fillColor: firstAccepted ? 'rgba(22,163,74,0.65)' : 'rgba(22,163,74,0.4)',
                fillOpacity: 0.65, weight: 2,
              }}
              eventHandlers={{
                click: () => { if (onSelectState) onSelectState(g.state) },
              }}>
              <Tooltip direction="top" offset={[0, -r]} className="rounded-lg shadow-lg border-0">
                <div className="text-xs leading-relaxed min-w-[120px]">
                  <div className="font-semibold text-gray-800 text-sm border-b pb-1 mb-1">{g.state}</div>
                  <div className="text-green-700">{g.accepted} aceptado{g.accepted !== 1 ? 's' : ''}</div>
                  <div className="text-gray-500">{g.leads.length} total{g.leads.length !== 1 ? 'es' : ''}</div>
                  {firstAccepted && g.accepted > 1 && (
                    <div className="text-blue-600 mt-1 text-[10px]">Click para ver detalle</div>
                  )}
                </div>
              </Tooltip>
            </CircleMarker>
            
            {g.accepted >= 1 && (
              <CircleMarker center={[g.lat, g.lng]} radius={r - 1}
                pathOptions={{ color: 'white', fillColor: 'transparent', fillOpacity: 0, weight: 0.8, dashArray: '3 3' }}
                pane="markerPane" />
            )}
            {g.accepted > 1 && (
              <CircleMarker center={[g.lat, g.lng]} radius={r}
                pathOptions={{ color: 'transparent', fillColor: 'transparent', fillOpacity: 0, weight: 0 }}
                pane="markerPane">
                <Tooltip permanent direction="center" className="bg-transparent border-0 shadow-none">
                  <span className="text-white font-bold text-xs pointer-events-none select-none"
                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
                    {g.accepted}
                  </span>
                </Tooltip>
              </CircleMarker>
            )}
          </React.Fragment>
        )
      })}
    </>
  )
}

export default function VenezuelaMap({ leads, onSelectState, active }: Props) {
  const totalAccepted = useMemo(() => leads.filter(l => l.status === 'aceptado').length, [leads])

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-200 shadow-sm"
      style={{ height: '400px' }}>
      <MapContainer center={[8.0, -66.0]} zoom={5.5} scrollWheelZoom={false}
        className="h-full w-full"
        maxBounds={VENEZUELA_BOUNDS} maxBoundsViscosity={1.0}
        zoomControl={false}>
        <ZoomControl position="topright" />
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
        <MapUpdater active={active} />
        <MapMarkers leads={leads} onSelectState={onSelectState} visible={active} />
      </MapContainer>

      <div className="absolute bottom-3 left-3 z-[1000] bg-white/90 backdrop-blur rounded-lg shadow-sm border border-gray-200 px-3 py-2 text-xs">
        <div className="flex items-center gap-4">
          <span className="text-gray-600 font-medium">Total aceptados:</span>
          <span className="text-green-700 font-bold text-sm">{totalAccepted}</span>
          <span className="w-px h-4 bg-gray-300" />
          <span className="text-gray-500">{totalAccepted > 0 ? 'Mapa disponible' : 'Sin leads aceptados'}</span>
        </div>
      </div>

      <div className="absolute bottom-3 right-3 z-[1000] bg-white/90 backdrop-blur rounded-lg shadow-sm border border-gray-200 px-2.5 py-1.5 text-[10px] text-gray-400 flex items-center gap-1.5">
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-600/60 border border-green-600" />
        Lead aceptado
      </div>
    </div>
  )
}
