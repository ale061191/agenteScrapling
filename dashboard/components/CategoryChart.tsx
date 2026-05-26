'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#a855f7', '#64748b', '#e11d48', '#0ea5e9', '#65a30d', '#d946ef', '#0891b2']

interface Props {
  data: Record<string, number>
}

export default function CategoryChart({ data }: Props) {
  const chartData = Object.entries(data)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  if (chartData.length === 0) return <EmptyChart />

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
      <h3 className="font-semibold text-gray-700 mb-4">Leads por Categoria</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={110}
            dataKey="value" paddingAngle={2}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
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
      <h3 className="font-semibold text-gray-700 mb-4">Leads por Categoria</h3>
      <div className="h-[300px] flex items-center justify-center text-gray-400">Sin datos</div>
    </div>
  )
}