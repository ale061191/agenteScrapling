'use client'

import { Lead } from '@/lib/data'

const STATUS_COLORS: Record<string, string> = {
  frio: 'bg-blue-100 text-blue-800 border-blue-200',
  tibio: 'bg-amber-100 text-amber-800 border-amber-200',
  caliente: 'bg-red-100 text-red-800 border-red-200',
  contactado: 'bg-purple-100 text-purple-800 border-purple-200',
  aceptado: 'bg-green-100 text-green-800 border-green-200',
  rechazado: 'bg-gray-100 text-gray-800 border-gray-200',
}

const STATUS_OPTIONS = ['frio', 'tibio', 'caliente', 'contactado', 'aceptado', 'rechazado']

interface Props {
  title: string
  leads: Lead[]
  open: boolean
  onClose: () => void
  onSelectLead: (lead: Lead) => void
  onStatusChange: (id: number, status: string) => void
}

const CARD_GRADIENTS: Record<string, string> = {
  total: 'from-blue-600 to-blue-400',
  phone: 'from-emerald-600 to-emerald-400',
  website: 'from-violet-600 to-violet-400',
  rating: 'from-amber-600 to-amber-400',
}

export default function MetricListModal({ title, leads, open, onClose, onSelectLead, onStatusChange }: Props) {
  if (!open) return null

  const filterKey = title === 'Total Leads' ? 'total' : title === 'Con Telefono' ? 'phone' : title === 'Con Website' ? 'website' : 'rating'
  const gradient = CARD_GRADIENTS[filterKey] || 'from-blue-600 to-blue-400'

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className={`bg-gradient-to-r ${gradient} px-6 py-4 rounded-t-2xl flex justify-between items-center`}>
          <div>
            <h2 className="text-lg font-bold text-white">{title}</h2>
            <p className="text-white/80 text-sm">{leads.length} leads</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {leads.length === 0 ? (
            <div className="text-center text-gray-400 py-12">No hay leads</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-left border-b border-gray-100">
                  <th className="pb-2 font-medium">Nombre</th>
                  <th className="pb-2 font-medium">Categoria</th>
                  <th className="pb-2 font-medium">Ciudad</th>
                  <th className="pb-2 font-medium">Rating</th>
                  <th className="pb-2 font-medium">Telefono</th>
                  <th className="pb-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(l => (
                  <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => { onSelectLead(l); onClose() }}>
                    <td className="py-2.5 pr-3 font-medium text-gray-800">{l.name}</td>
                    <td className="py-2.5 pr-3 text-gray-600">{l.category}</td>
                    <td className="py-2.5 pr-3 text-gray-600">{l.city || '-'}</td>
                    <td className="py-2.5 pr-3">{l.rating ? <span className="text-amber-500">★ {l.rating}</span> : '-'}</td>
                    <td className="py-2.5 pr-3 text-gray-600">{l.phone || '-'}</td>
                    <td className="py-2.5" onClick={e => e.stopPropagation()}>
                      <select value={l.status} onChange={e => onStatusChange(l.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-md border font-medium ${STATUS_COLORS[l.status] || ''}`}>
                        {STATUS_OPTIONS.map(s => (
                          <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-6 py-3 border-t border-gray-100 text-right">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}