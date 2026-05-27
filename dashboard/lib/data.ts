import { getSupabase } from './supabase'

function db() { return getSupabase() }

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

const VALID_STATUSES = ['frio', 'tibio', 'caliente', 'contactado', 'aceptado', 'rechazado']

function cleanStatus(s: string | null | undefined): string {
  const v = (s || 'frio').toLowerCase()
  return VALID_STATUSES.includes(v) ? v : 'frio'
}

function rowToLead(row: any): Lead {
  return {
    id: row.id,
    name: row.name || '',
    category: row.category || '',
    location: row.location || '',
    state: row.state || null,
    city: row.city || null,
    address: row.address || null,
    phone: row.phone || null,
    website: row.website || null,
    email: row.email || null,
    facebook: row.facebook || null,
    instagram: row.instagram || null,
    twitter: row.twitter || null,
    rating: row.rating ?? null,
    reviews_count: row.reviews_count ?? null,
    source: row.source || 'google_maps',
    source_url: row.source_url || '',
    timestamp: row.timestamp || '',
    notes: row.notes || '',
    status: cleanStatus(row.status),
    changed_at: row.changed_at || undefined,
  }
}

export async function getAllLeads(filters?: {
  category?: string; status?: string; location?: string; state?: string; city?: string; search?: string
}): Promise<Lead[]> {
  let query = db().from('leads').select('*').order('id', { ascending: true })

  if (filters?.category) query = query.eq('category', filters.category)
  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.location) query = query.eq('location', filters.location)
  if (filters?.state) query = query.eq('state', filters.state)
  if (filters?.city) query = query.eq('city', filters.city)
  if (filters?.search) {
    const q = filters.search
    query = query.or(`name.ilike.%${q}%,address.ilike.%${q}%,phone.ilike.%${q}%,notes.ilike.%${q}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []).map(rowToLead)
}

export async function getLeadById(id: number): Promise<Lead | null> {
  const { data, error } = await db().from('leads').select('*').eq('id', id).single()
  if (error || !data) return null
  return rowToLead(data)
}

export async function updateLead(id: number, data: Partial<{ status: string; notes: string }>): Promise<boolean> {
  const updateData: Record<string, any> = {}
  if (data.status) {
    updateData.status = cleanStatus(data.status)
    updateData.changed_at = new Date().toISOString().slice(0, 10)
  }
  if (data.notes !== undefined) updateData.notes = data.notes
  if (Object.keys(updateData).length === 0) return false

  const { error } = await db().from('leads').update(updateData).eq('id', id)
  return !error
}

export async function getStats() {
  const { data: allLeads, error } = await db().from('leads').select('*')
  if (error || !allLeads) return {
    total: 0, withPhone: 0, withWebsite: 0, withAddress: 0,
    avgRating: 0, byStatus: {}, byCategory: {}, byLocation: {}, byState: {},
  }

  const total = allLeads.length
  const withPhone = allLeads.filter((l: any) => l.phone).length
  const withWebsite = allLeads.filter((l: any) => l.website).length
  const withAddress = allLeads.filter((l: any) => l.address).length
  const ratings = allLeads.filter((l: any) => l.rating != null).map((l: any) => l.rating!)
  const avgRating = ratings.length ? (ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length) : 0

  const byStatus: Record<string, number> = {}
  const byCategory: Record<string, number> = {}
  const byLocation: Record<string, number> = {}
  const byState: Record<string, number> = {}

  allLeads.forEach((l: any) => {
    const s = cleanStatus(l.status)
    byStatus[s] = (byStatus[s] || 0) + 1
    byCategory[l.category] = (byCategory[l.category] || 0) + 1
    byLocation[l.location] = (byLocation[l.location] || 0) + 1
    if (l.state) byState[l.state] = (byState[l.state] || 0) + 1
  })

  return { total, withPhone, withWebsite, withAddress, avgRating: Math.round(avgRating * 100) / 100, byStatus, byCategory, byLocation, byState }
}
