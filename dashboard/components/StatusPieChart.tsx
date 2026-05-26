'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

const STATUS_COLORS: Record<string, string> = {
  frio: '#3b82f6',
  tibio: '#f59e0b',
  caliente: '#ef4444',
  contactado: '#8b5cf6',
  aceptado: '#10b981',
  rechazado: '#6b7280',
}

const STATUS_LABELS: Record<string, string> = {
  frio: 'Frio',
  tibio: 'Tibio',
  caliente: 'Caliente',
  contactado: 'Contactado',
  aceptado: 'Aceptado',
  rechazado: 'Rechazado',
}

interface Props {
  data: Record<string, number>
}

export default function StatusPieChart({ data }: Props) {
  const chartData = Object.entries(data).map(([name, value]) => ({
    name: STATUS_LABELS[name] || name,
    value,
    color: STATUS_COLORS[name] || '#9ca3af',
  }))

  if (chartData.length === 0) return <EmptyChart />

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
      <h3 className="font-semibold text-gray-700 mb-4">Leads por Estado</h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
            dataKey="value" paddingAngle={3}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
      <h3 className="font-semibold text-gray-700 mb-4">Leads por Estado</h3>
      <div className="h-[260px] flex items-center justify-center text-gray-400">Sin datos</div>
    </div>
  )
}
