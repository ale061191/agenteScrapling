'use client'

import { useState } from 'react'

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
  "Zulia": { x: 115, y: 175 },
  "Falcon": { x: 170, y: 145 },
  "Lara": { x: 175, y: 215 },
  "Yaracuy": { x: 200, y: 195 },
  "Carabobo": { x: 230, y: 180 },
  "Aragua": { x: 245, y: 190 },
  "La Guaira": { x: 245, y: 162 },
  "Distrito Capital": { x: 255, y: 170 },
  "Miranda": { x: 265, y: 190 },
  "Trujillo": { x: 155, y: 240 },
  "Portuguesa": { x: 175, y: 260 },
  "Cojedes": { x: 205, y: 250 },
  "Guarico": { x: 255, y: 280 },
  "Anzoategui": { x: 325, y: 280 },
  "Sucre": { x: 355, y: 220 },
  "Monagas": { x: 335, y: 250 },
  "Delta Amacuro": { x: 380, y: 300 },
  "Nueva Esparta": { x: 355, y: 185 },
  "Merida": { x: 140, y: 285 },
  "Tachira": { x: 118, y: 295 },
  "Barinas": { x: 180, y: 315 },
  "Apure": { x: 205, y: 375 },
  "Bolivar": { x: 290, y: 385 },
  "Amazonas": { x: 200, y: 485 },
}

const VE_PATH = "M 120 155 L 145 140 L 170 130 L 190 125 L 210 130 L 230 135 L 250 140 " +
  "L 270 145 L 290 150 L 310 155 L 330 160 L 350 165 L 370 175 L 390 190 L 395 210 " +
  "L 390 230 L 380 250 L 370 270 L 365 290 L 360 310 L 350 330 L 340 350 L 330 365 " +
  "L 320 380 L 310 395 L 300 410 L 290 425 L 280 440 L 270 455 L 260 470 L 250 480 " +
  "L 240 490 L 230 500 L 220 505 L 210 510 L 200 515 L 190 520 L 180 520 L 170 510 " +
  "L 165 500 L 160 490 L 155 480 L 150 470 L 145 460 L 140 450 L 135 440 L 130 430 " +
  "L 125 420 L 120 410 L 115 400 L 110 390 L 105 380 L 100 370 L 95 360 L 90 350 " +
  "L 88 340 L 86 330 L 85 320 L 88 310 L 92 300 L 96 290 L 100 280 L 105 270 " +
  "L 110 260 L 115 250 L 118 240 L 120 230 L 118 220 L 115 210 L 115 200 L 115 190 " +
  "L 115 180 L 118 170 Z"

const STATE_PATHS: Record<string, string> = {
  "Zulia": "M 90 170 Q 115 130 145 150 Q 150 180 140 210 Q 120 230 100 220 Q 85 200 90 170 Z",
  "Falcon": "M 145 150 Q 175 120 200 130 Q 195 160 175 170 Q 155 165 145 150 Z",
  "Lara": "M 145 170 Q 175 180 190 200 Q 185 230 165 240 Q 150 220 140 200 Z",
  "Carabobo": "M 200 160 Q 225 155 240 170 Q 235 195 215 200 Q 200 190 195 175 Z",
  "Aragua": "M 240 165 Q 255 170 265 185 Q 260 210 240 210 Q 230 200 235 180 Z",
  "Miranda": "M 255 175 Q 280 180 290 200 Q 285 220 265 220 Q 250 210 250 190 Z",
  "Distrito Capital": "M 245 160 Q 255 155 260 165 Q 255 175 245 170 Z",
  "La Guaira": "M 230 155 Q 245 150 255 155 Q 250 165 235 165 Z",
  "Trujillo": "M 140 225 Q 160 220 175 235 Q 170 260 155 265 Q 140 255 135 240 Z",
  "Portuguesa": "M 145 250 Q 170 240 190 260 Q 185 290 165 295 Q 150 280 140 265 Z",
  "Cojedes": "M 190 240 Q 215 235 225 255 Q 220 280 200 280 Q 190 265 185 250 Z",
  "Guarico": "M 220 270 Q 260 265 280 290 Q 275 320 250 320 Q 230 310 215 290 Z",
  "Anzoategui": "M 280 265 Q 320 250 345 275 Q 350 310 330 325 Q 305 315 285 295 Z",
  "Sucre": "M 330 200 Q 360 190 380 215 Q 380 240 360 250 Q 340 240 330 220 Z",
  "Monagas": "M 325 245 Q 355 240 375 265 Q 370 290 350 295 Q 330 285 320 260 Z",
  "Delta Amacuro": "M 365 285 Q 390 280 400 310 Q 390 340 365 330 Q 355 310 360 295 Z",
  "Nueva Esparta": "M 345 175 Q 360 170 370 180 Q 370 195 355 200 Q 345 195 345 180 Z",
  "Merida": "M 115 275 Q 140 260 160 275 Q 165 300 150 315 Q 130 305 115 295 Z",
  "Tachira": "M 95 290 Q 115 280 130 295 Q 130 320 115 330 Q 100 320 90 305 Z",
  "Barinas": "M 150 305 Q 185 295 205 320 Q 200 350 175 355 Q 155 340 145 320 Z",
  "Apure": "M 185 360 Q 225 345 255 370 Q 250 405 225 410 Q 200 400 180 380 Z",
  "Bolivar": "M 255 370 Q 310 340 360 370 Q 370 420 340 460 Q 290 480 250 450 Q 235 410 245 380 Z",
  "Amazonas": "M 165 470 Q 210 440 260 460 Q 270 510 230 530 Q 180 525 155 500 Z",
  "Yaracuy": "M 185 185 Q 205 180 215 195 Q 210 215 195 215 Q 185 205 182 195 Z",
}

const STATE_LABELS: Record<string, { x: number; y: number; anchor?: string }> = {
  "Zulia": { x: 105, y: 195 },
  "Falcon": { x: 175, y: 145 },
  "Lara": { x: 160, y: 215 },
  "Carabobo": { x: 218, y: 185 },
  "Aragua": { x: 248, y: 195 },
  "Miranda": { x: 275, y: 200 },
  "Distrito Capital": { x: 260, y: 160 },
  "Trujillo": { x: 145, y: 250 },
  "Portuguesa": { x: 160, y: 280, anchor: "start" },
  "Cojedes": { x: 210, y: 255 },
  "Guarico": { x: 248, y: 295, anchor: "start" },
  "Anzoategui": { x: 320, y: 295 },
  "Sucre": { x: 355, y: 230 },
  "Monagas": { x: 340, y: 270 },
  "Delta Amacuro": { x: 385, y: 310, anchor: "start" },
  "Nueva Esparta": { x: 355, y: 190 },
  "Merida": { x: 130, y: 305 },
  "Tachira": { x: 95, y: 315 },
  "Barinas": { x: 168, y: 335, anchor: "end" },
  "Apure": { x: 210, y: 395 },
  "Bolivar": { x: 305, y: 425, anchor: "start" },
  "Amazonas": { x: 205, y: 505 },
  "Yaracuy": { x: 200, y: 200 },
}

export default function VenezuelaMap({ leads, onSelectLead }: Props) {
  const [hoveredState, setHoveredState] = useState<string | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

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
      <svg viewBox="0 0 450 560" className="w-full h-auto max-w-[500px] mx-auto">
        {/* Venezuela outline fill */}
        <path d={VE_PATH} fill="#f0fdf4" stroke="#86efac" strokeWidth="2" opacity="0.8" />

        {/* State outlines */}
        {Object.entries(STATE_PATHS).map(([state, path]) => {
          const stats = allByState[state]
          const isHovered = hoveredState === state
          return (
            <g key={state}>
              <path
                d={path}
                fill={stats?.accepted ? "rgba(34,197,94,0.15)" : "transparent"}
                stroke="#d1d5db"
                strokeWidth="0.8"
                className="transition-colors duration-200"
                style={isHovered ? { fill: "rgba(34,197,94,0.25)" } : undefined}
              />
              {/* State label */}
              <text
                x={STATE_LABELS[state]?.x || STATE_COORDS[state]?.x || 0}
                y={STATE_LABELS[state]?.y || STATE_COORDS[state]?.y || 0}
                textAnchor={(STATE_LABELS[state]?.anchor || "middle") as "middle" | "start" | "end"}
                fontSize="7"
                fill="#9ca3af"
                className="pointer-events-none select-none"
              >
                {state}
              </text>
            </g>
          )
        })}

        {/* Green dots for accepted leads */}
        {Object.entries(acceptedByState).map(([state, stateLeads]) => {
          const coord = STATE_COORDS[state]
          if (!coord) return null
          const count = stateLeads.length
          const r = Math.min(8 + count * 2, 22)
          return (
            <g key={`dot-${state}`} className="cursor-pointer"
              onMouseEnter={(e) => {
                setHoveredState(state)
                const rect = (e.target as SVGElement).closest('svg')?.getBoundingClientRect()
                if (rect) setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
              }}
              onMouseLeave={() => setHoveredState(null)}
              onClick={() => stateLeads.length === 1 ? onSelectLead(stateLeads[0]) : null}>
              {/* Glow */}
              <circle cx={coord.x} cy={coord.y} r={r + 4} fill="rgba(34,197,94,0.2)"
                className="animate-pulse" />
              {/* Dot */}
              <circle cx={coord.x} cy={coord.y} r={r}
                fill="rgba(34,197,94,0.7)" stroke="#22c55e" strokeWidth="1.5" />
              {/* Count */}
              <text x={coord.x} y={coord.y + 1} textAnchor="middle" fontSize="9" fontWeight="bold"
                fill="white" className="pointer-events-none select-none">
                {count}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Tooltip */}
      {hoveredState && allByState[hoveredState] && (
        <div className="absolute bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs pointer-events-none z-30"
          style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 10 }}>
          <div className="font-semibold text-gray-800 mb-1">{hoveredState}</div>
          <div className="text-gray-500">Total leads: {allByState[hoveredState]?.total || 0}</div>
          <div className="text-green-600 font-medium">
            Aceptados: {allByState[hoveredState]?.accepted || 0}
          </div>
        </div>
      )}
    </div>
  )
}
