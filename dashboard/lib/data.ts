import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), '..', 'leads_data')
const LEADS_FILE = path.join(DATA_DIR, 'leads.json')
const STATUS_FILE = path.join(DATA_DIR, 'status.json')

export interface Lead {
  id: number
  name: string
  category: string
  location: string
  state: string | null
  city: string | null
  address: string | null
  phone: string | null
  website: string | null
  email: string | null
  facebook: string | null
  instagram: string | null
  twitter: string | null
  rating: number | null
  reviews_count: number | null
  source: string
  source_url: string
  timestamp: string
  notes: string
  status: string
  changed_at?: string
}

interface StatusEntry {
  status: string
  notes: string
  changed_at?: string
}

function readJSON<T>(file: string, fallback: T): T {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'))
    }
  } catch {}
  return fallback
}

function readStatusMap(): Record<string, StatusEntry> {
  return readJSON<Record<string, StatusEntry>>(STATUS_FILE, {})
}

function cleanStatus(s: string | null | undefined): string {
  const v = (s || 'frio').toLowerCase()
  return ['frio', 'tibio', 'caliente', 'contactado', 'aceptado', 'rechazado'].includes(v) ? v : 'frio'
}

export function getAllLeads(filters?: {
  category?: string; status?: string; location?: string; state?: string; city?: string; search?: string
}): Lead[] {
  const raw = readJSON<any[]>(LEADS_FILE, [])
  const statusMap = readStatusMap()

  const leads: Lead[] = raw.map((item: any, idx: number) => {
    const id = item.id || idx + 1
    const saved = statusMap[String(id)] || {}
    return {
      id,
      name: item.name || '',
      category: item.category || '',
      location: item.location || '',
      state: item.state || null,
      city: item.city || null,
      address: item.address || null,
      phone: item.phone || null,
      website: item.website || null,
      email: item.email || null,
      facebook: item.facebook || null,
      instagram: item.instagram || null,
      twitter: item.twitter || null,
      rating: item.rating ?? null,
      reviews_count: item.reviews_count ?? null,
      source: item.source || 'google_maps',
      source_url: item.source_url || '',
      timestamp: item.timestamp || '',
      notes: saved.notes || item.notes || '',
      status: cleanStatus(saved.status || item.status),
      changed_at: saved.changed_at,
    }
  })

  let filtered = leads
  if (filters?.category) filtered = filtered.filter(l => l.category === filters.category)
  if (filters?.status) filtered = filtered.filter(l => l.status === filters.status)
  if (filters?.location) filtered = filtered.filter(l => l.location === filters.location)
  if (filters?.state) filtered = filtered.filter(l => l.state === filters.state)
  if (filters?.city) filtered = filtered.filter(l => l.city === filters.city)
  if (filters?.search) {
    const q = filters.search.toLowerCase()
    filtered = filtered.filter(l =>
      l.name.toLowerCase().includes(q) ||
      (l.address && l.address.toLowerCase().includes(q)) ||
      (l.phone && l.phone.includes(q)) ||
      l.notes.toLowerCase().includes(q)
    )
  }
  return filtered
}

export function getLeadById(id: number): Lead | null {
  return getAllLeads().find(l => l.id === id) || null
}

export function updateLead(id: number, data: Partial<{ status: string; notes: string }>): boolean {
  const statusMap = readStatusMap()
  const key = String(id)
  const entry = statusMap[key] || { status: 'frio', notes: '' }
  if (data.status) {
    entry.status = cleanStatus(data.status)
    entry.changed_at = new Date().toISOString().slice(0, 10)
  }
  if (data.notes !== undefined) entry.notes = data.notes
  statusMap[key] = entry
  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(statusMap, null, 2), 'utf-8')
    return true
  } catch { return false }
}

export function getStats() {
  const leads = getAllLeads()
  const total = leads.length
  const withPhone = leads.filter(l => l.phone).length
  const withWebsite = leads.filter(l => l.website).length
  const withAddress = leads.filter(l => l.address).length
  const ratings = leads.filter(l => l.rating != null).map(l => l.rating!)
  const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0

  const byStatus: Record<string, number> = {}
  const byCategory: Record<string, number> = {}
  const byLocation: Record<string, number> = {}
  const byState: Record<string, number> = {}

  leads.forEach(l => {
    byStatus[l.status] = (byStatus[l.status] || 0) + 1
    byCategory[l.category] = (byCategory[l.category] || 0) + 1
    byLocation[l.location] = (byLocation[l.location] || 0) + 1
    if (l.state) byState[l.state] = (byState[l.state] || 0) + 1
  })

  return { total, withPhone, withWebsite, withAddress, avgRating: Math.round(avgRating * 100) / 100, byStatus, byCategory, byLocation, byState }
}
