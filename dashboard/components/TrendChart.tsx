'use client'

import { useMemo, useState } from 'react'

interface Props {
  data: { day: string; count: number }[]
  title: string
  color?: string
  emptyText?: string
}

const DAY_NAMES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MONTH_NAMES = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function formatDayLabel(day: string, range: string): string {
  const d = new Date(day + 'T12:00:00')
  if (range === 'month') return MONTH_NAMES[d.getMonth() + 1] + ' ' + d.getFullYear()
  if (range === 'week') return d.getDate() + '/' + (d.getMonth() + 1)
  return DAY_NAMES[d.getDay()] + ' ' + d.getDate()
}

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M${points[0].x - 20},${points[0].y}L${points[0].x + 20},${points[0].y}`
  let d = `M${points[0].x},${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    const tension = 0.3
    const cp1x = p1.x + (p2.x - p0.x) * tension
    const cp1y = p1.y + (p2.y - p0.y) * tension
    const cp2x = p2.x - (p3.x - p1.x) * tension
    const cp2y = p2.y - (p3.y - p1.y) * tension
    d += `C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
  }
  return d
}

export default function TrendChart({ data, title, color = '#059669', emptyText = 'Sin datos' }: Props) {
  const [range, setRange] = useState<'day' | 'week' | 'month'>('day')

  const aggregated = useMemo(() => {
    const sorted = [...data].sort((a, b) => a.day.localeCompare(b.day))
    if (range === 'day') return sorted
    if (range === 'week') {
      const weeks: Record<string, number> = {}
      sorted.forEach(d => {
        const date = new Date(d.day + 'T12:00:00')
        const mon = date.getDate() - date.getDay()
        const wk = new Date(date)
        wk.setDate(mon)
        const key = wk.toISOString().slice(0, 10)
        weeks[key] = (weeks[key] || 0) + d.count
      })
      return Object.entries(weeks).sort(([a], [b]) => a.localeCompare(b)).map(([day, count]) => ({ day, count }))
    }
    const months: Record<string, number> = {}
    sorted.forEach(d => {
      const key = d.day.slice(0, 7)
      months[key] = (months[key] || 0) + d.count
    })
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([day, count]) => ({ day, count }))
  }, [data, range])

  const sorted = [...aggregated].sort((a, b) => a.day.localeCompare(b.day))
  const maxVal = Math.max(...sorted.map(d => d.count), 1)
  const LW = 30, BH = 18
  const W = 280, H = 120, P = { top: 4, right: 4, bottom: BH, left: LW }
  const innerW = W - P.left - P.right
  const innerH = H - P.top - P.bottom

  if (sorted.length === 0) return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-gray-400">{title}</div>
        <div className="flex gap-1">
          {(['day', 'week', 'month'] as const).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                range === r ? 'bg-emerald-100 text-emerald-700' : 'text-gray-400 hover:text-gray-600'
              }`}>
              {r === 'day' ? 'Dia' : r === 'week' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[100px] flex items-center justify-center text-gray-300 text-sm">{emptyText}</div>
    </div>
  )

  const points = sorted.map((d, i) => ({
    x: P.left + (sorted.length > 1 ? (i / (sorted.length - 1)) * innerW : innerW / 2),
    y: P.top + innerH - (d.count / maxVal) * innerH,
    count: d.count,
    day: d.day,
  }))

  const pathD = smoothPath(points)
  const fillPath = pathD + `L${points[points.length - 1].x},${H - P.bottom}L${points[0].x},${H - P.bottom}Z`
  const gradientId = `trend-grad-${color.replace('#', '')}`
  const totalCount = points.reduce((s, p) => s + p.count, 0)

  const mid = Math.floor(points.length / 2)
  const firstHalf = points.slice(0, mid).reduce((s, p) => s + p.count, 0)
  const secondHalf = points.slice(mid).reduce((s, p) => s + p.count, 0)
  const trendPct = firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100) : secondHalf > 0 ? 100 : 0
  const trendUp = trendPct > 0
  const trendDown = trendPct < 0

  const yTicks = [
    { val: 0, y: P.top + innerH },
    { val: Math.round(maxVal / 4), y: P.top + innerH - innerH / 4 },
    { val: Math.round(maxVal / 2), y: P.top + innerH / 2 },
    { val: Math.round((maxVal * 3) / 4), y: P.top + innerH / 4 },
    { val: maxVal, y: P.top },
  ]

  const xLabelInterval = Math.max(1, Math.floor(points.length / 6))

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 section-enter">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs text-gray-400">{title}</div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(['day', 'week', 'month'] as const).map(r => (
              <button key={r} onClick={() => setRange(r)}
                className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                  range === r ? 'bg-emerald-100 text-emerald-700' : 'text-gray-400 hover:text-gray-600'
                }`}>
                {r === 'day' ? 'Dia' : r === 'week' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>
          {trendPct !== 0 && (
            <span className={`flex items-center gap-0.5 text-[10px] font-medium ${trendUp ? 'text-emerald-600' : 'text-red-500'}`}>
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
                {trendUp
                  ? <polygon points="6,1 11,10 1,10" />
                  : <polygon points="6,11 11,2 1,2" />
                }
              </svg>
              {Math.abs(trendPct)}%
            </span>
          )}
          <div className="text-lg font-bold" style={{ color }}>{totalCount}</div>
        </div>
      </div>
      <div className="relative" style={{ height: H }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={P.left} y1={t.y} x2={W - P.right} y2={t.y} stroke="#e5e7eb" strokeWidth="0.5" />
              <text x={P.left - 3} y={t.y + 3} textAnchor="end" fontSize="8" fill="#9ca3af">{t.val}</text>
            </g>
          ))}

          <path d={fillPath} fill={`url(#${gradientId})`} />
          <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

          {points.map((p, i) => (
            <g key={i} className="group cursor-pointer">
              <title>{p.count} leads ({p.day})</title>
              <circle cx={p.x} cy={p.y} r="4" fill="white" stroke={color} strokeWidth="2"
                className="transition-all duration-200 group-hover:r-[6]" />
              <circle cx={p.x} cy={p.y} r="10" fill="transparent" />
            </g>
          ))}

          {points.filter((_, i) => i % xLabelInterval === 0).map((p, i) => (
            <text key={i} x={p.x} y={H - 2} textAnchor="middle" fontSize="7" fill="#9ca3af">
              {formatDayLabel(p.day, range)}
            </text>
          ))}
        </svg>
      </div>
    </div>
  )
}
