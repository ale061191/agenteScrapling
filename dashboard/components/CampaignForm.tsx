'use client'

import { useState, useEffect } from 'react'

function plainTextToHtml(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map(block => {
      const lines = block.split('\n').filter(l => l.trim())
      if (lines.length <= 1) return lines.join('<br>')
      return lines.map(l => l.trim()).join('<br>')
    })
    .map(p => `<p style="margin:0 0 12px 0;line-height:1.6">${p}</p>`)
    .join('')
}

interface Props {
  leadsCount: number
  onSend: (opts: {
    leadIds: number[]
    subject: string
    bodyHtml: string
    files: string[]
    filters?: { category?: string; status?: string; state?: string; city?: string }
  }) => Promise<{ sent: number; output?: string }>
  selectedIds: number[]
  filters: { category: string; status: string; state: string; city: string }
}

export default function CampaignForm({ leadsCount, onSend, selectedIds, filters }: Props) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ type: 'ok' | 'error'; msg: string } | null>(null)
  const [mode, setMode] = useState<'selected' | 'filtered'>('selected')
  const [showPreview, setShowPreview] = useState(false)
  const [historyTab, setHistoryTab] = useState<'all' | 'sent' | 'failed'>('all')
  const [history, setHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const fetchHistory = async () => {
    setLoadingHistory(true)
    try {
      const res = await fetch('/api/campaigns/history')
      const data = await res.json()
      const lines = (data.output || '').split('\n').filter((l: string) => l.trim() && l.includes('->'))
      setHistory(lines.map((l: string) => {
        const m = l.match(/\[(.+?)\]\s*Lead\s*(\d+)\s*->\s*(.+?):\s*(sent|error)\s*(.*)/)
        return m ? { time: m[1], leadId: m[2], recipient: m[3], status: m[4], error: m[5] } : { raw: l }
      }))
    } catch { setHistory([]) }
    setLoadingHistory(false)
  }

  useEffect(() => { fetchHistory() }, [])

  const handleSend = async () => {
    if (!subject || !body) return
    setSending(true)
    setResult(null)
    try {
      const bodyHtml = plainTextToHtml(body)
      const res = await onSend({
        subject,
        bodyHtml,
        files,
        filters: mode === 'filtered' ? {
          ...(filters.category ? { category: filters.category } : {}),
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.state ? { state: filters.state } : {}),
          ...(filters.city ? { city: filters.city } : {}),
        } : undefined,
        leadIds: mode === 'selected' ? selectedIds : [],
      })
      if (res.sent > 0) {
        setResult({ type: 'ok', msg: `Enviado a ${res.sent} destinatarios exitosamente` })
        setBody('')
        setSubject('')
      } else {
        setResult({ type: 'error', msg: `No se pudo enviar. Detalles: ${res.output || 'revise la configuracion SMTP'}` })
      }
      fetchHistory()
    } catch (e: any) {
      setResult({ type: 'error', msg: `Error: ${e.message || 'desconocido'}` })
    }
    setSending(false)
  }

  const filteredHistory = history.filter((h: any) => {
    if (historyTab === 'sent') return h.status === 'sent'
    if (historyTab === 'failed') return h.status === 'error'
    return true
  })

  return (
    <div className="space-y-6 section-enter">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-700 mb-1">Nueva Campa\u00f1a de Correo</h3>
        <p className="text-xs text-gray-400 mb-5">Redacta en texto plano, nosotros lo convertimos a HTML</p>

        <div className="flex gap-4 mb-5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={mode === 'selected'}
              onChange={() => setMode('selected')} className="accent-blue-600" />
            <span className="text-sm text-gray-600">
              Enviar a seleccionados ({selectedIds.length})
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={mode === 'filtered'}
              onChange={() => setMode('filtered')} className="accent-blue-600" />
            <span className="text-sm text-gray-600">
              Enviar a todos los filtrados ({leadsCount})
            </span>
          </label>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Asunto</label>
          <input value={subject} onChange={e => setSubject(e.target.value)}
            placeholder="Ej: Oferta especial para su negocio"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all" />
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-gray-600">Mensaje</label>
            <button onClick={() => setShowPreview(!showPreview)}
              className="text-xs text-blue-600 hover:text-blue-700 transition-colors">
              {showPreview ? 'Editar' : 'Vista previa'}
            </button>
          </div>
          {showPreview ? (
            <div className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm min-h-[160px] bg-gray-50 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: plainTextToHtml(body) || '<span class="text-gray-300">Sin contenido</span>' }} />
          ) : (
            <textarea value={body} onChange={e => setBody(e.target.value)}
              placeholder="Escribe tu mensaje aqui&#10;&#10;Deja lineas en blanco entre parrafos&#10;El sistema convierte automaticamente tu texto a HTML"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-40 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all" />
          )}
        </div>

        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Archivos adjuntos</label>
          <div className="flex items-center gap-2 mb-2">
            <label className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 cursor-pointer transition-colors">
              Subir archivo
              <input type="file" onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const fd = new FormData()
                fd.append('file', file)
                const r = await fetch('/api/campaigns/upload', { method: 'POST', body: fd })
                const d = await r.json()
                if (d.success) setFiles(prev => [...prev, d.name])
              }} className="hidden" />
            </label>
          </div>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map(f => (
                <span key={f} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded-md">
                  {f}
                  <button onClick={async () => {
                    await fetch(`/api/campaigns/upload?name=${f}`, { method: 'DELETE' })
                    setFiles(prev => prev.filter(x => x !== f))
                  }} className="text-gray-400 hover:text-red-500">&times;</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <button onClick={handleSend} disabled={sending || !subject || !body || (mode === 'selected' && selectedIds.length === 0)}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
            sending || !subject || !body || (mode === 'selected' && selectedIds.length === 0)
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm hover:shadow'
          }`}>
          {sending ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/>
              </svg>
              Enviar Campa\u00f1a
            </>
          )}
        </button>

        {result && (
          <div className={`mt-4 p-3 rounded-lg text-sm border section-enter ${
            result.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
          }`}>
            <strong>{result.type === 'error' ? 'Error:' : 'Exito:'}</strong> {result.msg}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-700">Historial de Env\u00edos</h3>
          <button onClick={fetchHistory} className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            disabled={loadingHistory}>
            {loadingHistory ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>

        <div className="flex gap-1 mb-4 border-b border-gray-100">
          {(['all', 'sent', 'failed'] as const).map(tab => (
            <button key={tab} onClick={() => setHistoryTab(tab)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
                historyTab === tab
                  ? 'border-rose-500 text-rose-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              {tab === 'all' ? 'Todos' : tab === 'sent' ? 'Enviados' : 'Fallidos'}
            </button>
          ))}
        </div>

        <div className="max-h-64 overflow-y-auto space-y-1">
          {filteredHistory.length === 0 ? (
            <div className="text-center text-gray-400 py-8 text-sm">
              {loadingHistory ? 'Cargando...' : 'No hay env\u00edos registrados'}
            </div>
          ) : (
            filteredHistory.map((h: any, i: number) => (
              <div key={i} className={`flex items-center justify-between text-xs p-2 rounded-lg ${
                h.status === 'sent' ? 'bg-green-50' : h.status === 'error' ? 'bg-red-50' : 'bg-gray-50'
              }`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    h.status === 'sent' ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span className="text-gray-700 truncate">{h.recipient || 'Lead ' + h.leadId}</span>
                  {h.error && <span className="text-red-500 truncate max-w-[200px]">{h.error}</span>}
                </div>
                <span className="text-gray-400 shrink-0 ml-2">{h.time?.slice(5, 16) || ''}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
