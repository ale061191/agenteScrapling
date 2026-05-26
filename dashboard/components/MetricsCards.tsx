interface Props {
  total: number
  withPhone: number
  withWebsite: number
  avgRating: number
  onCardClick: (filter: string) => void
}

const CARD_STYLES: Record<string, { gradient: string; glass: string; icon: string; label: string }> = {
  total: {
    gradient: 'from-blue-600 to-blue-400',
    glass: 'bg-blue-50/70 border-blue-200/50 hover:shadow-blue-200/50',
    icon: '#',
    label: 'Total Leads',
  },
  phone: {
    gradient: 'from-emerald-600 to-emerald-400',
    glass: 'bg-emerald-50/70 border-emerald-200/50 hover:shadow-emerald-200/50',
    icon: 'T',
    label: 'Con Telefono',
  },
  website: {
    gradient: 'from-violet-600 to-violet-400',
    glass: 'bg-violet-50/70 border-violet-200/50 hover:shadow-violet-200/50',
    icon: 'W',
    label: 'Con Website',
  },
  rating: {
    gradient: 'from-amber-600 to-amber-400',
    glass: 'bg-amber-50/70 border-amber-200/50 hover:shadow-amber-200/50',
    icon: 'R',
    label: 'Rating Promedio',
  },
}

export default function MetricsCards({ total, withPhone, withWebsite, avgRating, onCardClick }: Props) {
  const values: Record<string, { value: number | string; suffix?: string }> = {
    total: { value: total },
    phone: { value: withPhone },
    website: { value: withWebsite },
    rating: { value: avgRating, suffix: '/5' },
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Object.entries(CARD_STYLES).map(([key, style]) => {
        const v = values[key]
        return (
          <div key={key} onClick={() => onCardClick(key)}
            className={`
              relative z-10 rounded-2xl p-5 backdrop-blur-sm border cursor-pointer
              transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl
              ${style.glass}
            `}
            style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
            <div className={`w-11 h-11 bg-gradient-to-br ${style.gradient} rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-lg mb-3`}>
              {style.icon}
            </div>
            <div className="text-2xl font-bold text-gray-800">{v.value}{v.suffix || ''}</div>
            <div className="text-sm text-gray-500 mt-0.5">{style.label}</div>
          </div>
        )
      })}
    </div>
  )
}
