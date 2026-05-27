'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import MetricsCards from '@/components/MetricsCards'
import StatusPieChart from '@/components/StatusPieChart'
import CategoryChart from '@/components/CategoryChart'
import PipelineBoard from '@/components/PipelineBoard'
import LeadsTable from '@/components/LeadsTable'
import LeadDetailModal from '@/components/LeadDetailModal'
import MetricListModal from '@/components/MetricListModal'
import CampaignForm from '@/components/CampaignForm'
import TrendChart from '@/components/TrendChart'
import EmailStatsChart from '@/components/EmailStatsChart'
import VenezuelaMap from '@/components/VenezuelaMap'
import type { Lead } from '@/lib/data'

interface Stats {
  total: number; withPhone: number; withWebsite: number; withAddress: number
  avgRating: number; byStatus: Record<string, number>
  byCategory: Record<string, number>; byLocation: Record<string, number>
  byState: Record<string, number>
}

const BUSINESS_CATEGORIES = [
  "restaurantes", "hoteles", "centros comerciales", "gimnasios",
  "hospitales", "clinicas", "discotecas", "clubes nocturnos",
  "parques", "aeropuertos", "bares", "cafeterias",
  "centros deportivos", "cines", "universidades", "supermercados",
  "teatros", "centros de convenciones", "plazas", "farmacias",
]

const VENEZUELA_LOCATIONS: Record<string, string[]> = {
  "Distrito Capital": ["Caracas"],
  "Miranda": ["Los Teques", "Guarenas", "Guatire", "Charallave", "Cua", "Santa Teresa", "San Antonio de los Altos"],
  "La Guaira": ["La Guaira", "Macuto", "Maiquetia", "Catia La Mar"],
  "Carabobo": ["Valencia", "Puerto Cabello", "Naguanagua", "San Diego", "Guacara"],
  "Zulia": ["Maracaibo", "Cabimas", "Ciudad Ojeda", "Santa Rita"],
  "Lara": ["Barquisimeto", "Cabudare"],
  "Aragua": ["Maracay", "Turmero", "Cagua", "La Victoria", "Villa de Cura"],
  "Bolivar": ["Puerto Ordaz", "San Felix", "Ciudad Bolivar", "Upata"],
  "Anzoategui": ["Barcelona", "Puerto La Cruz", "Lecheria", "El Tigre", "Anaco"],
  "Sucre": ["Cumana", "Carupano"],
  "Monagas": ["Maturin"],
  "Falcon": ["Coro", "Punto Fijo"],
  "Nueva Esparta": ["Porlamar", "Pampatar", "La Asuncion"],
  "Tachira": ["San Cristobal"],
  "Merida": ["Merida", "El Vigia"],
  "Trujillo": ["Valera"],
  "Barinas": ["Barinas"],
  "Portuguesa": ["Acarigua", "Guanare"],
  "Yaracuy": ["San Felipe"],
  "Cojedes": ["San Carlos"],
  "Guarico": ["Valle de la Pascua", "San Juan de los Morros", "Calabozo"],
  "Apure": ["San Fernando de Apure"],
  "Delta Amacuro": ["Tucupita"],
  "Amazonas": ["Puerto Ayacucho"],
}

const STATES = Object.keys(VENEZUELA_LOCATIONS)

type Section = 'dashboard' | 'pipeline' | 'leads' | 'search' | 'campaigns'

const SIDEBAR_ITEMS: { key: Section; label: string; icon: string; color: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '#', color: 'text-blue-500 bg-blue-50' },
  { key: 'pipeline', label: 'Pipeline de Leads', icon: '|||', color: 'text-amber-500 bg-amber-50' },
  { key: 'leads', label: 'Todos los Leads', icon: '...', color: 'text-violet-500 bg-violet-50' },
  { key: 'search', label: 'Buscar Nuevos Leads', icon: 'srch', color: 'text-emerald-500 bg-emerald-50' },
  { key: 'campaigns', label: 'Campañas de Correo', icon: '✉', color: 'text-rose-500 bg-rose-50' },
]

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [trendData, setTrendData] = useState<{ lead_trend: any[]; campaign_trend: any[] }>({ lead_trend: [], campaign_trend: [] })
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<Section>('dashboard')
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterState, setFilterState] = useState('')
  const [filterCity, setFilterCity] = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [deleting, setDeleting] = useState(false)
  const [metricFilter, setMetricFilter] = useState<string | null>(null)

  const [sCategory, setSCategory] = useState('restaurantes')
  const [sState, setSState] = useState('')
  const [sCity, setSCity] = useState('')
  const [sParish, setSParish] = useState('')
  const [sSector, setSSector] = useState('')
  const [sDeep, setSDeep] = useState(true)
  const [sGoogleSearch, setSGoogleSearch] = useState(false)
  const [sPaginasAmarillas, setSPaginasAmarillas] = useState(false)
  const [sSocial, setSSocial] = useState(false)
  const [sTikTok, setSTikTok] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchJobId, setSearchJobId] = useState<string | null>(null)
  const [searchResult, setSearchResult] = useState<string | null>(null)
  const [searchHistory, setSearchHistory] = useState<any[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const citiesForState = useMemo(() => {
    return filterState ? VENEZUELA_LOCATIONS[filterState] || [] : []
  }, [filterState])

  const sCitiesForState = useMemo(() => {
    return sState ? VENEZUELA_LOCATIONS[sState] || [] : []
  }, [sState])

  const acceptanceTrend = useMemo(() => {
    const counts: Record<string, number> = {}
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const threshold = thirtyDaysAgo.toISOString().slice(0, 10)
    leads.forEach(l => {
      if (l.status === 'aceptado') {
        const day = (l.changed_at || l.timestamp || '').slice(0, 10)
        if (day >= threshold && day) {
          counts[day] = (counts[day] || 0) + 1
        }
      }
    })
    return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)).map(([day, count]) => ({ day, count }))
  }, [leads])

  const fetchTrendData = useCallback(async () => {
    try {
      const res = await fetch('/api/stats/trends')
      setTrendData(await res.json())
    } catch {}
  }, [])

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filterCategory) params.set('category', filterCategory)
    if (filterStatus) params.set('status', filterStatus)
    if (filterState) params.set('state', filterState)
    if (filterCity) params.set('city', filterCity)

    const [leadsRes, statsRes, historyRes] = await Promise.all([
      fetch(`/api/leads?${params}`).then(r => r.json()),
      fetch('/api/stats').then(r => r.json()),
      fetch('/api/search').then(r => r.json()),
    ])
    setLeads(leadsRes.leads)
    setStats(statsRes)
    setSearchHistory(historyRes.jobs || [])
    setLoading(false)
    fetchTrendData()
  }, [search, filterCategory, filterStatus, filterState, filterCity, fetchTrendData])

  useEffect(() => { fetchData() }, [fetchData])

  const handleStatusChange = async (id: number, status: string) => {
    await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchData()
  }

  const handleSaveLead = async (id: number, data: { status?: string; notes?: string }) => {
    await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    fetchData()
  }

  const handleDeleteLead = async (id: number) => {
    if (!confirm('Eliminar este lead?')) return
    await fetch('/api/leads/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    })
    setSelectedIds(prev => prev.filter(i => i !== id))
    fetchData()
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`Eliminar ${selectedIds.length} leads seleccionados?`)) return
    setDeleting(true)
    await fetch('/api/leads/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedIds }),
    })
    setSelectedIds([])
    setDeleting(false)
    fetchData()
  }

  const handleDeleteAll = async () => {
    if (!confirm('Eliminar TODOS los leads? Esta accion no se puede deshacer.')) return
    setDeleting(true)
    await fetch('/api/leads/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    setSelectedIds([])
    setDeleting(false)
    fetchData()
  }

  const triggerSearch = async () => {
    if (!sCategory || !sState || !sCity) return
    setSearching(true)
    setSearchResult(null)
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: sCategory,
          state: sState,
          city: sCity,
          parish: sParish || undefined,
          sector: sSector || undefined,
          deep: sDeep,
          googleSearch: sGoogleSearch,
          paginasAmarillas: sPaginasAmarillas,
          social: sSocial,
          tiktok: sTikTok,
        }),
      })
      const data = await res.json()
      setSearchJobId(data.jobId)
      setSearchResult(`Buscando ${sCategory} en ${sCity}, ${sState}...`)
    } catch {
      setSearchResult('Error al iniciar la busqueda')
      setSearching(false)
    }
  }

  useEffect(() => {
    if (!searchJobId || !searching) return
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/search?jobId=${searchJobId}`)
        const data = await res.json()
        if (data.job?.status === 'done') {
          setSearchResult(`Completado - ${data.job.leadsFound || 0} nuevos leads encontrados`)
          setSearching(false)
          setSearchJobId(null)
          if (pollRef.current) clearInterval(pollRef.current)
          fetchData()
        } else if (data.job?.status === 'error') {
          setSearchResult(`Error en la busqueda`)
          setSearching(false)
          setSearchJobId(null)
          if (pollRef.current) clearInterval(pollRef.current)
        }
      } catch {}
    }, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [searchJobId, searching, fetchData])

  const categories = stats ? Object.keys(stats.byCategory) : []

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-gray-400 text-sm">Cargando dashboard...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full z-30">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-sm">NT</div>
            <div>
              <h1 className="text-sm font-bold text-gray-800">Nova Tech AI</h1>
              <p className="text-[10px] text-gray-400">Lead Finder Venezuela</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {SIDEBAR_ITEMS.map(item => {
            const isActive = activeSection === item.key
            const [colorClass, bgClass] = item.color.split(' ')
            return (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              className={`sidebar-link w-full ${isActive ? 'active' : 'text-gray-600'}`}
            >
              <span className={`w-5 h-5 flex items-center justify-center text-xs font-bold rounded transition-colors duration-200 ${isActive ? colorClass : 'bg-gray-100 text-gray-400'}`}>
                {item.icon === '#' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>}
                {item.icon === '|||' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="7"/><rect x="3" y="14" width="18" height="7"/></svg>}
                {item.icon === '...' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>}
                {item.icon === 'srch' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
                {item.icon === '\u2709' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>}
              </span>
              {item.label}
            </button>
            )
          })}
        </nav>
        <div className="p-4 border-t border-gray-100 space-y-1">
          <div className="text-[10px] text-gray-400">{stats?.total || 0} leads totales</div>
          {searchHistory.length > 0 && searchHistory[0].status === 'running' && (
            <div className="text-[10px] text-blue-500 font-medium">Busqueda en progreso...</div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 min-h-screen">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-800">
                {activeSection === 'dashboard' && 'Dashboard'}
                {activeSection === 'pipeline' && 'Pipeline de Leads'}
                {activeSection === 'leads' && 'Todos los Leads'}
                {activeSection === 'search' && 'Buscar Nuevos Leads'}
                {activeSection === 'campaigns' && 'Campañas de Correo'}
              </h2>
              <p className="text-xs text-gray-400">
                {activeSection === 'dashboard' && 'Metricas y graficos del sistema'}
                {activeSection === 'pipeline' && 'Arrastra los leads entre columnas para gestionar su estado'}
                {activeSection === 'leads' && 'Lista completa de leads con filtros'}
                {activeSection === 'search' && 'Ejecuta busquedas en Google Maps desde el dashboard'}
                {activeSection === 'campaigns' && 'Crea y envia campanas de correo, guarda plantillas por categoria'}
              </p>
            </div>
            <button onClick={fetchData}
              className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-all duration-150 flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              Refrescar
            </button>
          </div>
        </header>

        <div className="px-6 py-6 space-y-6">
          {/* Section: Dashboard */}
          {activeSection === 'dashboard' && (
            <div className="space-y-6 section-enter" key="dashboard">
              <div className="flex flex-wrap gap-3 items-center bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar leads..."
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all" />
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all">
                  <option value="">Todas categorias</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={filterState} onChange={e => { setFilterState(e.target.value); setFilterCity('') }}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all">
                  <option value="">Todo Venezuela</option>
                  {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={filterCity} onChange={e => setFilterCity(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all disabled:opacity-40"
                  disabled={!filterState}>
                  <option value="">Todas ciudades</option>
                  {citiesForState.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all">
                  <option value="">Todos estados</option>
                  <option value="frio">Frio</option>
                  <option value="tibio">Tibio</option>
                  <option value="caliente">Caliente</option>
                  <option value="contactado">Contactado</option>
                  <option value="aceptado">Aceptado</option>
                  <option value="rechazado">Rechazado</option>
                </select>
              </div>

              {stats && <MetricsCards {...stats} onCardClick={setMetricFilter} />}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {stats && <StatusPieChart data={stats.byStatus} />}
                {stats && <CategoryChart data={stats.byCategory} />}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <TrendChart data={acceptanceTrend} title="Leads Aceptados (ultimos 30 dias)" color="#059669" emptyText="Ningun lead aceptado aun" />
                <EmailStatsChart data={trendData.campaign_trend} />
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
                <h3 className="font-semibold text-gray-700 mb-1">Mapa de Leads Aceptados</h3>
                <p className="text-xs text-gray-400 mb-4">Distribucion geografica por estado</p>
                <VenezuelaMap leads={leads} onSelectLead={setSelectedLead} />
              </div>
            </div>
          )}

          {/* Section: Pipeline */}
          {activeSection === 'pipeline' && (
            <div key="pipeline">
              <PipelineBoard leads={leads} onStatusChange={handleStatusChange} />
            </div>
          )}

          {/* Section: Todos los Leads */}
          {activeSection === 'leads' && (
            <div className="space-y-4 section-enter" key="leads">
              <div className="flex flex-wrap gap-3 items-center bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar leads..."
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all" />
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all">
                  <option value="">Todas categorias</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={filterState} onChange={e => { setFilterState(e.target.value); setFilterCity('') }}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all">
                  <option value="">Todo Venezuela</option>
                  {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={filterCity} onChange={e => setFilterCity(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all disabled:opacity-40"
                  disabled={!filterState}>
                  <option value="">Todas ciudades</option>
                  {citiesForState.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all">
                  <option value="">Todos estados</option>
                  <option value="frio">Frio</option>
                  <option value="tibio">Tibio</option>
                  <option value="caliente">Caliente</option>
                  <option value="contactado">Contactado</option>
                  <option value="aceptado">Aceptado</option>
                  <option value="rechazado">Rechazado</option>
                </select>
              </div>

              <div className="flex items-center gap-2 mb-3">
                {selectedIds.length > 0 && (
                  <button onClick={handleDeleteSelected} disabled={deleting}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-40">
                    {deleting ? 'Eliminando...' : `Eliminar seleccionados (${selectedIds.length})`}
                  </button>
                )}
                <button onClick={handleDeleteAll} disabled={deleting}
                  className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-40 ml-auto">
                  {deleting ? 'Eliminando...' : 'Eliminar todo'}
                </button>
              </div>

              <LeadsTable leads={leads} selectedIds={selectedIds}
                onToggleSelect={(id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])}
                onToggleSelectAll={() => setSelectedIds(prev => prev.length === leads.length ? [] : leads.map(l => l.id!))}
                onStatusChange={handleStatusChange} onSelectLead={setSelectedLead} onDeleteLead={handleDeleteLead} />
            </div>
          )}

          {/* Section: Buscar Nuevos Leads */}
          {activeSection === 'search' && (
            <div className="section-enter" key="search">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-700 mb-1">Nueva Busqueda</h3>
                <p className="text-xs text-gray-400 mb-5">Configura los parametros y ejecuta una busqueda en Google Maps</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Categoria</label>
                    <select value={sCategory} onChange={e => setSCategory(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all">
                      {BUSINESS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Estado</label>
                    <select value={sState} onChange={e => { setSState(e.target.value); setSCity('') }}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all">
                      <option value="">Seleccionar estado...</option>
                      {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Ciudad</label>
                    <select value={sCity} onChange={e => setSCity(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all disabled:opacity-40"
                      disabled={!sState}>
                      <option value="">Seleccionar ciudad...</option>
                      {sCitiesForState.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Parroquia <span className="text-gray-300 font-normal">(opcional)</span></label>
                    <input value={sParish} onChange={e => setSParish(e.target.value)}
                      placeholder="Ej: El Cafetal, Santa Rosalia..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Sector <span className="text-gray-300 font-normal">(opcional)</span></label>
                    <input value={sSector} onChange={e => setSSector(e.target.value)}
                      placeholder="Ej: Las Mercedes, El Hatillo..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="relative shrink-0">
                        <input type="checkbox" checked={sDeep} onChange={e => setSDeep(e.target.checked)}
                          className="sr-only peer" />
                        <div className="w-9 h-5 bg-gray-200 rounded-full peer-checked:bg-blue-600 transition-colors duration-200"></div>
                        <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform duration-200"></div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm text-gray-600 leading-tight">Modo profundo</div>
                        <div className="text-[9px] text-gray-400 leading-tight">telefonos y websites</div>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="relative shrink-0">
                        <input type="checkbox" checked={sGoogleSearch} onChange={e => setSGoogleSearch(e.target.checked)}
                          className="sr-only peer" />
                        <div className="w-9 h-5 bg-gray-200 rounded-full peer-checked:bg-green-600 transition-colors duration-200"></div>
                        <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform duration-200"></div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm text-gray-600 leading-tight">Google Search</div>
                        <div className="text-[9px] text-gray-400 leading-tight">local pack</div>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="relative shrink-0">
                        <input type="checkbox" checked={sPaginasAmarillas} onChange={e => setSPaginasAmarillas(e.target.checked)}
                          className="sr-only peer" />
                        <div className="w-9 h-5 bg-gray-200 rounded-full peer-checked:bg-orange-600 transition-colors duration-200"></div>
                        <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform duration-200"></div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm text-gray-600 leading-tight">Paginas Amarillas</div>
                        <div className="text-[9px] text-gray-400 leading-tight">directorio VE</div>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="relative shrink-0">
                        <input type="checkbox" checked={sSocial} onChange={e => setSSocial(e.target.checked)}
                          className="sr-only peer" />
                        <div className="w-9 h-5 bg-gray-200 rounded-full peer-checked:bg-purple-600 transition-colors duration-200"></div>
                        <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform duration-200"></div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm text-gray-600 leading-tight">Redes Sociales</div>
                        <div className="text-[9px] text-gray-400 leading-tight">Facebook/Instagram</div>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="relative shrink-0">
                        <input type="checkbox" checked={sTikTok} onChange={e => setSTikTok(e.target.checked)}
                          className="sr-only peer" />
                        <div className="w-9 h-5 bg-gray-200 rounded-full peer-checked:bg-pink-600 transition-colors duration-200"></div>
                        <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform duration-200"></div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm text-gray-600 leading-tight">TikTok</div>
                        <div className="text-[9px] text-gray-400 leading-tight">perfiles bio/seguidores</div>
                      </div>
                    </label>
                  </div>
                </div>

                <button onClick={triggerSearch} disabled={searching || !sCategory || !sState || !sCity}
                  className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                    searching || !sCategory || !sState || !sCity
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow'
                  }`}>
                  {searching ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Buscando...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      Buscar Nuevos Leads
                    </>
                  )}
                </button>

                {searchResult && (
                  <div className={`mt-4 p-3 rounded-lg text-sm section-enter ${
                    searchResult.includes('Completado') ? 'bg-green-50 text-green-700 border border-green-200' :
                    searchResult.includes('Error') ? 'bg-red-50 text-red-700 border border-red-200' :
                    'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    {searchResult}
                  </div>
                )}
              </div>

              {/* Search History */}
              {searchHistory.length > 0 && (
                <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-700">Historial de Busquedas</h3>
                    <button onClick={async () => {
                      await fetch('/api/search', { method: 'DELETE' })
                      setSearchHistory([])
                    }}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                      Limpiar historial
                    </button>
                  </div>
                  <div className="space-y-2">
                    {searchHistory.map((j: any) => (
                      <div key={j.jobId} className="flex items-center justify-between text-sm p-2.5 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full ${
                            j.status === 'done' ? 'bg-green-500' :
                            j.status === 'error' ? 'bg-red-500' :
                            'bg-blue-500 animate-pulse'
                          }`} />
                          <span className="text-gray-700">{j.category}</span>
                          <span className="text-gray-400">{j.city}, {j.state}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          {j.leadsFound !== undefined && <span className="text-green-600 font-medium">+{j.leadsFound} leads</span>}
                          {j.deep && <span className="text-blue-500">profundo</span>}
                          {j.googleSearch && <span className="text-green-500">GS</span>}
                          {j.paginasAmarillas && <span className="text-orange-500">PA</span>}
                          {j.social && <span className="text-purple-500">Social</span>}
                          <span>{j.started?.slice(0, 16).replace('T', ' ')}</span>
                          {j.status === 'running' && <span className="text-blue-500 animate-pulse">en progreso...</span>}
                          {j.status === 'done' && <span className="text-green-500">completado</span>}
                          {j.status === 'error' && <span className="text-red-500">error</span>}
                          <button onClick={async () => {
                            await fetch(`/api/search?jobId=${j.jobId}`, { method: 'DELETE' })
                            setSearchHistory(prev => prev.filter(h => h.jobId !== j.jobId))
                          }}
                            className="text-gray-300 hover:text-red-500 transition-colors p-1"
                            title="Eliminar entrada">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                            </svg>
                </button>

                <p className="mt-2 text-[10px] text-gray-400 text-center">
                  La busqueda ejecuta Scrapling en tu PC. En la version cloud solo gestionas leads existentes.
                </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section: Campa\u00f1as de Correo */}
          {activeSection === 'campaigns' && (
            <div className="section-enter" key="campaigns">
              <CampaignForm leadsCount={leads.length} selectedIds={selectedIds}
                filters={{ category: filterCategory, status: filterStatus, state: filterState, city: filterCity }}
                onSend={async (opts) => {
                  const res = await fetch('/api/campaigns/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(opts),
                  })
                  return res.json()
                }} />
            </div>
          )}
        </div>
      </main>

      <LeadDetailModal lead={selectedLead} open={!!selectedLead}
        onClose={() => setSelectedLead(null)} onSave={handleSaveLead} />

      {(() => {
        const metricLabels: Record<string, string> = { total: 'Total Leads', phone: 'Con Telefono', website: 'Con Website', rating: 'Rating Promedio' }
        const metricLeadFilters: Record<string, (l: Lead) => boolean> = {
          total: () => true,
          phone: (l) => !!l.phone,
          website: (l) => !!l.website,
          rating: (l) => l.rating != null,
        }
        const f = metricFilter
        const filtered = f ? leads.filter(metricLeadFilters[f] || (() => false)) : []
        return (
          <MetricListModal title={metricLabels[f || ''] || ''} leads={filtered}
            open={!!f} onClose={() => setMetricFilter(null)}
            onSelectLead={setSelectedLead} onStatusChange={handleStatusChange} />
        )
      })()}
    </div>
  )
}