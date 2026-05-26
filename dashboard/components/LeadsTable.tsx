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
  leads: Lead[]
  selectedIds: number[]
  onToggleSelect: (id: number) => void
  onToggleSelectAll: () => void
  onStatusChange: (id: number, status: string) => void
  onSelectLead: (lead: Lead) => void
  onDeleteLead: (id: number) => void
}

export default function LeadsTable({ leads, selectedIds, onToggleSelect, onToggleSelectAll, onStatusChange, onSelectLead, onDeleteLead }: Props) {
  const allSelected = leads.length > 0 && selectedIds.length === leads.length
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden section-enter">
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-700">
          Todos los Leads <span className="text-gray-400 font-normal">({leads.length})</span>
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-left">
              <th className="p-3 w-10">
                <input type="checkbox" checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="rounded border-gray-300 accent-blue-600 cursor-pointer" />
              </th>
              <th className="p-3 font-medium">Nombre</th>
              <th className="p-3 font-medium">Categoria</th>
              <th className="p-3 font-medium">Estado</th>
              <th className="p-3 font-medium">Ciudad</th>
              <th className="p-3 font-medium">Rating</th>
              <th className="p-3 font-medium">Telefono</th>
              <th className="p-3 font-medium">Estado Lead</th>
              <th className="p-3 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l, i) => (
              <tr key={l.id} className={`border-t border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors duration-150 ${selectedIds.includes(l.id) ? 'bg-blue-50' : ''}`}
                style={{ animationDelay: `${i * 20}ms` }}>
                <td className="p-3" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedIds.includes(l.id)}
                    onChange={() => onToggleSelect(l.id)}
                    className="rounded border-gray-300 accent-blue-600 cursor-pointer" />
                </td>
                <td className="p-3 font-medium text-gray-800" onClick={() => onSelectLead(l)}>{l.name}</td>
                <td className="p-3 text-gray-600" onClick={() => onSelectLead(l)}>{l.category}</td>
                <td className="p-3 text-gray-600" onClick={() => onSelectLead(l)}>{l.state || '-'}</td>
                <td className="p-3 text-gray-600" onClick={() => onSelectLead(l)}>{l.city || '-'}</td>
                <td className="p-3" onClick={() => onSelectLead(l)}>{l.rating ? <span className="text-amber-500">★ {l.rating}</span> : '-'}</td>
                <td className="p-3 text-gray-600" onClick={() => onSelectLead(l)}>{l.phone || '-'}</td>
                <td className="p-3" onClick={e => e.stopPropagation()}>
                  <select
                    value={l.status}
                    onChange={e => onStatusChange(l.id, e.target.value)}
                    className={`text-xs px-2 py-1 rounded-md border font-medium transition-all duration-150 ${STATUS_COLORS[l.status] || ''}`}
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </td>
                <td className="p-3" onClick={e => e.stopPropagation()}>
                  <button onClick={() => onDeleteLead(l.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors duration-150 p-1"
                    title="Eliminar lead">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                      <line x1="10" y1="11" x2="10" y2="17"/>
                      <line x1="14" y1="11" x2="14" y2="17"/>
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr><td colSpan={9} className="p-8 text-center text-gray-400">No hay leads</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}