'use client'

import { useState, useEffect } from 'react'
import { feature } from 'topojson-client'

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

const STATE_COORDS: Record<string, { x: number; y: number }> = {
  "Zulia": { x: 0.22, y: 0.38 },
  "Falcon": { x: 0.35, y: 0.30 },
  "Lara": { x: 0.37, y: 0.44 },
  "Yaracuy": { x: 0.42, y: 0.40 },
  "Carabobo": { x: 0.48, y: 0.36 },
  "Aragua": { x: 0.52, y: 0.38 },
  "La Guaira": { x: 0.52, y: 0.33 },
  "Distrito Capital": { x: 0.54, y: 0.34 },
  "Miranda": { x: 0.56, y: 0.38 },
  "Trujillo": { x: 0.33, y: 0.48 },
  "Portuguesa": { x: 0.38, y: 0.53 },
  "Cojedes": { x: 0.44, y: 0.51 },
  "Guarico": { x: 0.55, y: 0.57 },
  "Anzoategui": { x: 0.70, y: 0.57 },
  "Sucre": { x: 0.77, y: 0.44 },
  "Monagas": { x: 0.72, y: 0.50 },
  "Delta Amacuro": { x: 0.83, y: 0.60 },
  "Nueva Esparta": { x: 0.76, y: 0.37 },
  "Merida": { x: 0.30, y: 0.58 },
  "Tachira": { x: 0.25, y: 0.60 },
  "Barinas": { x: 0.40, y: 0.65 },
  "Apure": { x: 0.45, y: 0.77 },
  "Bolivar": { x: 0.63, y: 0.80 },
  "Amazonas": { x: 0.43, y: 0.96 },
}

const STATE_TO_COORDS_DEG: Record<string, [number, number]> = {
  "Zulia": [-72.0, 10.5],
  "Falcon": [-69.5, 11.0],
  "Lara": [-69.8, 10.0],
  "Yaracuy": [-68.7, 10.3],
  "Carabobo": [-68.0, 10.2],
  "Aragua": [-67.5, 10.3],
  "La Guaira": [-67.0, 10.6],
  "Distrito Capital": [-66.9, 10.5],
  "Miranda": [-66.5, 10.3],
  "Trujillo": [-70.5, 9.5],
  "Portuguesa": [-69.2, 9.2],
  "Cojedes": [-68.5, 9.5],
  "Guarico": [-67.0, 8.8],
  "Anzoategui": [-64.5, 9.0],
  "Sucre": [-63.5, 10.5],
  "Monagas": [-63.0, 9.5],
  "Delta Amacuro": [-61.5, 9.0],
  "Nueva Esparta": [-64.0, 11.0],
  "Merida": [-71.0, 8.5],
  "Tachira": [-72.0, 8.0],
  "Barinas": [-70.0, 8.0],
  "Apure": [-68.5, 7.0],
  "Bolivar": [-64.0, 6.5],
  "Amazonas": [-66.0, 3.5],
}

const VE_BBOX = { minLon: -73.5, maxLon: -59.5, minLat: 0.5, maxLat: 12.5 }
const W = VE_BBOX.maxLon - VE_BBOX.minLon
const H = VE_BBOX.maxLat - VE_BBOX.minLat

function lonToX(lon: number): number {
  return ((lon - VE_BBOX.minLon) / W) * 400
}
function latToY(lat: number): number {
  return ((VE_BBOX.maxLat - lat) / H) * 500
}

export default function VenezuelaMap({ leads, onSelectLead }: Props) {
  const [outlinePaths, setOutlinePaths] = useState<string[]>([])
  const [hoveredState, setHoveredState] = useState<string | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    fetch('https://unpkg.com/world-atlas@2/countries-110m.json')
      .then(r => r.json())
      .then(world => {
        const countries = (feature(world, world.objects.countries) as any).features
        const ve = countries.find((f: any) => f.properties.name === 'Venezuela')
        if (!ve) return
        const geom = ve.geometry
        const coords = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates]
        const paths: string[] = []
        for (const polygon of coords) {
          for (const ring of polygon) {
            const d = ring.map((p: [number, number]) => {
              const x = lonToX(p[0])
              const y = latToY(p[1])
              return `${x},${y}`
            }).join(' ')
            paths.push(`M${d} Z`)
          }
        }
        setOutlinePaths(paths)
      })
      .catch(() => {})
  }, [])

  const acceptedByState: Record<string, Lead[]> = {}
  const allByState: Record<string, { total: number; accepted: number }> = {}

  leads.forEach(lead => {
    const st = lead.state || 'Desconocido'
    if (!allByState[st]) allByState[st] = { total: 0, accepted: 0 }
    allByState[st].total++
    if (lead.status === 'aceptado') {
      allByState[st].accepted++
      if (!acceptedByState[st]) acceptedByState[st] = []
      acceptedByState[st].push(lead)
    }
  })

  return (
    <div className="relative">
      <svg viewBox="0 0 400 500" className="w-full h-auto max-w-[350px] mx-auto">
        {/* Venezuela outline */}
        {outlinePaths.map((d, i) => (
          <path key={i} d={d} fill="#f0fdf4" stroke="#86efac" strokeWidth="1.5" opacity="0.9" />
        ))}

        {/* State dots for accepted leads */}
        {Object.entries(acceptedByState).map(([state, stateLeads]) => {
          const coordDeg = STATE_TO_COORDS_DEG[state]
          if (!coordDeg) return null
          const cx = lonToX(coordDeg[0])
          const cy = latToY(coordDeg[1])
          const count = stateLeads.length
          const r = Math.min(5 + count * 1.5, 16)
          return (
            <g key={`dot-${state}`} className="cursor-pointer"
              onMouseEnter={(e) => {
                setHoveredState(state)
                const svg = (e.target as SVGElement).closest('svg')
                if (svg) {
                  const rect = svg.getBoundingClientRect()
                  setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
                }
              }}
              onMouseLeave={() => setHoveredState(null)}
              onClick={() => {
                if (stateLeads.length === 1) onSelectLead(stateLeads[0])
              }}>
              <circle cx={cx} cy={cy} r={count > 1 ? r + 3 : r + 2}
                fill="rgba(34,197,94,0.15)" className="animate-pulse" />
              <circle cx={cx} cy={cy} r={r}
                fill="rgba(34,197,94,0.7)" stroke="#22c55e" strokeWidth="1.5" />
              {count > 1 && (
                <text x={cx} y={cy + 1} textAnchor="middle" fontSize="8" fontWeight="bold"
                  fill="white" className="pointer-events-none select-none">
                  {count}
                </text>
              )}
            </g>
          )
        })}

        {/* State labels */}
        {Object.keys(STATE_TO_COORDS_DEG).map(state => {
          const coordDeg = STATE_TO_COORDS_DEG[state]
          if (!coordDeg) return null
          const cx = lonToX(coordDeg[0])
          const cy = latToY(coordDeg[1])
          return (
            <text key={`label-${state}`} x={cx} y={cy + 3}
              textAnchor="middle" fontSize="4.5" fill="#9ca3af"
              className="pointer-events-none select-none">
              {state.slice(0, 4)}
            </text>
          )
        })}
      </svg>

      {/* Tooltip */}
      {hoveredState && allByState[hoveredState] && (
        <div className="absolute bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs pointer-events-none z-30"
          style={{ left: Math.min(tooltipPos.x + 10, 280), top: Math.min(tooltipPos.y - 10, 440) }}>
          <div className="font-semibold text-gray-800 mb-1">{hoveredState}</div>
          <div className="text-gray-500">Total: {allByState[hoveredState]?.total || 0}</div>
          <div className="text-green-600 font-medium">
            Aceptados: {allByState[hoveredState]?.accepted || 0}
          </div>
        </div>
      )}
    </div>
  )
}
