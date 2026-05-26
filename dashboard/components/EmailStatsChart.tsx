'use client'

import { useState, useMemo } from 'react'

interface CampaignDay {
  day: string
  total: number
  sent: number
  failed: number
}

interface Props {
  data: CampaignDay[]
}

export default function EmailStatsChart({ data }: Props) {
  const [range, setRange] = useState<'day' | 'week' | 'month'>('day')

  const aggregated = useMemo(() => {
    const sorted = [...data].sort((a, b) => a.day.localeCompare(b.day))
    if (range === 'day') return sorted
    if (range === 'week') {
      const weeks: Record<string, CampaignDay> = {}
      sorted.forEach(d => {
        const date = new Date(d.day)
        const mon = date.getDate() - date.getDay()
        const wk = new Date(date)
        wk.setDate(mon)
        const key = wk.toISOString().slice(0, 10)
        if (!weeks[key]) weeks[key] = { day: key, total: 0, sent: 0, failed: 0 }
        weeks[key].total += d.total
        weeks[key].sent += d.sent
        weeks[key].failed += d.failed
      })
      return Object.values(weeks).sort((a, b) => a.day.localeCompare(b.day))
    }
    const months: Record<string, CampaignDay> = {}
    sorted.forEach(d => {
      const key = d.day.slice(0, 7)
      if (!months[key]) months[key] = { day: key, total: 0, sent: 0, failed: 0 }
      months[key].total += d.total
      months[key].sent += d.sent
      months[key].failed += d.failed
    })
    return Object.values(months).sort((a, b) => a.day.localeCompare(b.day))
  }, [data, range])

  const totalSent = aggregated.reduce((s, d) => s + d.sent, 0)
  const totalFailed = aggregated.reduce((s, d) => s + d.failed, 0)
  const maxVal = Math.max(...aggregated.map(d => d.total), 1)
  const hasData = aggregated.length > 0 && totalSent > 0

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 section-enter">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-gray-400">Correos Enviados</div>
        <div className="flex gap-1">
          {(['day', 'week', 'month'] as const).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                range === r ? 'bg-rose-100 text-rose-700' : 'text-gray-400 hover:text-gray-600'
              }`}>
              {r === 'day' ? 'Dia' : r === 'week' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div className="h-[100px] flex flex-col items-center justify-center text-gray-300 text-sm">
          <div className="text-2xl font-bold text-gray-200">0</div>
          <div className="text-xs mt-1">Sin envios registrados</div>
        </div>
      ) : (
        <>
          <div className="flex gap-4 mb-3">
            <div>
              <div className="text-lg font-bold text-emerald-600">{totalSent}</div>
              <div className="text-[10px] text-gray-400">Enviados</div>
            </div>
            {totalFailed > 0 && (
              <div>
                <div className="text-lg font-bold text-red-500">{totalFailed}</div>
                <div className="text-[10px] text-gray-400">Fallidos</div>
              </div>
            )}
          </div>

          <div className="flex items-end gap-0.5 h-[80px]" style={{ padding: '0 4px' }}>
            {aggregated.map((d, i) => {
              const h = Math.max(2, (d.total / maxVal) * 65)
              const sentH = Math.max(1, (d.sent / maxVal) * 65)
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full relative group">
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-white px-1 rounded shadow-sm z-10">
                    {d.sent} enviados{d.failed ? `, ${d.failed} fallidos` : ''} ({d.day.slice(5)})
                  </div>
                  <div style={{ height: `${h}px`, width: '100%', position: 'relative', minWidth: 3 }}>
                    <div style={{ height: `${d.sent > 0 ? sentH : 0}px`, width: '100%', backgroundColor: '#059669', borderRadius: '2px 2px 0 0', position: 'absolute', bottom: 0 }} />
                    {d.failed > 0 && (
                      <div style={{ height: `${Math.max(2, (d.failed / maxVal) * 65)}px`, width: '100%', backgroundColor: '#ef4444', borderRadius: '2px 2px 0 0', position: 'absolute', bottom: 0, opacity: 0.5 }} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex gap-3 mt-2 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-600" /> Enviados</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 opacity-50" /> Fallidos</span>
          </div>
        </>
      )}
    </div>
  )
}
