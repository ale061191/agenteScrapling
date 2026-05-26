'use client'

interface Props {
  data: { day: string; count: number }[]
  title: string
  color?: string
  emptyText?: string
}

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return ''
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

export default function TrendChart({ data, title, color = '#3b82f6', emptyText = 'Sin datos' }: Props) {
  const sorted = [...data].sort((a, b) => a.day.localeCompare(b.day))
  const maxVal = Math.max(...sorted.map(d => d.count), 1)
  const W = 280, H = 100, P = { top: 8, right: 8, bottom: 4, left: 8 }
  const innerW = W - P.left - P.right
  const innerH = H - P.top - P.bottom

  if (sorted.length === 0) return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="text-xs text-gray-400 mb-2">{title}</div>
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 section-enter">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-gray-400">{title}</div>
        <div className="flex items-center gap-2">
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
          <path d={fillPath} fill={`url(#${gradientId})`} />
          <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <g key={i} className="group cursor-pointer">
              <title>{p.count} aceptados ({p.day})</title>
              <circle cx={p.x} cy={p.y} r="4" fill="white" stroke={color} strokeWidth="2"
                className="transition-all duration-200 group-hover:r-[6]" />
              <circle cx={p.x} cy={p.y} r="10" fill="transparent" />
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}
