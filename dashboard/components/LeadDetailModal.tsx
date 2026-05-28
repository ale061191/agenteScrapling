'use client'

import { Lead } from '@/lib/data'
import { useState, useEffect } from 'react'

const STATUS_OPTIONS = ['frio', 'tibio', 'caliente', 'contactado', 'aceptado', 'rechazado']

interface Props {
  lead: Lead | null
  open: boolean
  onClose: () => void
  onSave: (id: number, data: { status?: string; notes?: string }) => void
}

export default function LeadDetailModal({ lead, open, onClose, onSave }: Props) {
  const [status, setStatus] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (lead) {
      setStatus(lead.status)
      setNotes(lead.notes)
    }
  }, [lead])

  if (!open || !lead) return null

  const handleSave = () => {
    onSave(lead.id, { status, notes })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-bold text-gray-800">{lead.name}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
            <div><span className="text-gray-400">Categoria:</span> {lead.category}</div>
            <div><span className="text-gray-400">Ubicacion:</span> {lead.state && lead.city ? `${lead.city}, ${lead.state}` : lead.location}</div>
            <div><span className="text-gray-400">Rating:</span> {lead.rating ? `⭐ ${lead.rating}/5` : '-'}</div>
            <div><span className="text-gray-400">Reseñas:</span> {lead.reviews_count ?? '-'}</div>
            <div className="col-span-2"><span className="text-gray-400">Direccion:</span> {lead.address || '-'}</div>
            <div><span className="text-gray-400">Telefono:</span> {lead.phone || '-'}</div>
            <div><span className="text-gray-400">Email:</span> {lead.email || '-'}</div>
            <div><span className="text-gray-400">Website:</span> {lead.website ? (
              <a href={lead.website} target="_blank" rel="noopener" className="text-blue-600 hover:underline truncate block">{lead.website}</a>
            ) : '-'}</div>
            <div><span className="text-gray-400">Facebook:</span> {lead.facebook ? (
              <a href={lead.facebook} target="_blank" rel="noopener" className="text-blue-600 hover:underline truncate block">{lead.facebook}</a>
            ) : '-'}</div>
            <div><span className="text-gray-400">Instagram:</span> {lead.instagram ? (
              <a href={lead.instagram} target="_blank" rel="noopener" className="text-blue-600 hover:underline truncate block">{lead.instagram}</a>
            ) : '-'}</div>
            <div><span className="text-gray-400">Twitter / X:</span> {lead.twitter ? (
              <a href={lead.twitter} target="_blank" rel="noopener" className="text-blue-600 hover:underline truncate block">{lead.twitter}</a>
            ) : '-'}</div>
            <div className="col-span-2"><span className="text-gray-400">Fuente:</span> {lead.source}</div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-24 resize-none"
              placeholder="Agregar notas..." />
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg">Cancelar</button>
            <button onClick={handleSave}
              className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Guardar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
