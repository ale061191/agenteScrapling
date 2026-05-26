'use client'

import { Lead } from '@/lib/data'
import { useState, useCallback } from 'react'

const COLUMNS = [
  { key: 'frio', label: 'Frio', color: 'border-blue-400 bg-blue-50', icon: '❄️' },
  { key: 'tibio', label: 'Tibio', color: 'border-amber-400 bg-amber-50', icon: '🌤️' },
  { key: 'caliente', label: 'Caliente', color: 'border-red-400 bg-red-50', icon: '🔥' },
  { key: 'contactado', label: 'Contactado', color: 'border-purple-400 bg-purple-50', icon: '📞' },
  { key: 'aceptado', label: 'Aceptado', color: 'border-green-400 bg-green-50', icon: '✅' },
]

const STATUS_LABELS: Record<string, string> = {
  frio: 'Frio', tibio: 'Tibio', caliente: 'Caliente',
  contactado: 'Contactado', aceptado: 'Aceptado', rechazado: 'Rechazado',
}

interface Props {
  leads: Lead[]
  onStatusChange: (id: number, status: string) => void
}

export default function PipelineBoard({ leads, onStatusChange }: Props) {
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [justDropped, setJustDropped] = useState<number | null>(null)

  const grouped: Record<string, Lead[]> = {}
  COLUMNS.forEach(c => { grouped[c.key] = [] })
  leads.forEach(l => {
    if (grouped[l.status]) grouped[l.status].push(l)
  })

  const handleDragStart = useCallback((e: React.DragEvent, leadId: number) => {
    setDraggingId(leadId)
    e.dataTransfer.setData('text/plain', String(leadId))
    e.dataTransfer.effectAllowed = 'move'
    const el = e.currentTarget as HTMLElement
    el.classList.add('dragging')
  }, [])

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggingId(null)
    setDropTarget(null)
    const el = e.currentTarget as HTMLElement
    el.classList.remove('dragging')
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, columnKey: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget(columnKey)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDropTarget(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, columnKey: string) => {
    e.preventDefault()
    const leadId = parseInt(e.dataTransfer.getData('text/plain'))
    if (leadId && columnKey) {
      onStatusChange(leadId, columnKey)
      setJustDropped(leadId)
      setTimeout(() => setJustDropped(null), 300)
    }
    setDraggingId(null)
    setDropTarget(null)
  }, [onStatusChange])

  return (
    <div className="section-enter">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800">Pipeline de Leads</h2>
        <span className="text-xs text-gray-400">Arrastra las tarjetas entre columnas para cambiar su estado</span>
      </div>
      <div className="grid grid-cols-5 gap-3 min-h-[400px]">
        {COLUMNS.map(col => (
          <div
            key={col.key}
            onDragOver={(e) => handleDragOver(e, col.key)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.key)}
            className={`rounded-xl border-t-4 ${col.color} p-3 flex flex-col transition-all duration-200 ${
              dropTarget === col.key ? 'drop-target scale-[1.02]' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">{col.icon}</span>
                <span className="text-sm font-semibold text-gray-700">{col.label}</span>
              </div>
              <span className="text-xs font-medium text-gray-400 bg-white/60 px-2 py-0.5 rounded-full">
                {grouped[col.key].length}
              </span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto max-h-[500px] pr-1">
              {grouped[col.key].map(l => (
                <div
                  key={l.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, l.id)}
                  onDragEnd={handleDragEnd}
                  className={`bg-white rounded-lg border border-gray-200 px-3 py-2.5 cursor-grab active:cursor-grabbing card-hover ${
                    draggingId === l.id ? 'dragging' : ''
                  } ${justDropped === l.id ? 'card-drop' : ''}`}
                >
                  <div className="font-medium text-sm text-gray-800 truncate">{l.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    {l.rating && (
                      <span className="text-xs text-amber-500">★ {l.rating}</span>
                    )}
                    {l.category && (
                      <span className="text-xs text-gray-400 truncate">{l.category}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-1.5">
                    {l.city && <span className="text-[10px] text-gray-400">{l.city}</span>}
                    {l.phone && <span className="text-[10px] text-green-500 ml-auto">{l.phone}</span>}
                  </div>
                </div>
              ))}
              {grouped[col.key].length === 0 && (
                <div className="text-xs text-gray-300 text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                  Arrastra leads aqui
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}