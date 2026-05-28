import { NextRequest, NextResponse } from 'next/server'
import { getAllLeads } from '@/lib/data'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const filters = {
    category: searchParams.get('category') || undefined,
    status: searchParams.get('status') || undefined,
    location: searchParams.get('location') || undefined,
    state: searchParams.get('state') || undefined,
    city: searchParams.get('city') || undefined,
    search: searchParams.get('search') || undefined,
  }
  const hasFilters = Object.values(filters).some(v => v !== undefined)
  const leads = await getAllLeads(hasFilters ? filters : undefined)
  return NextResponse.json({ leads })
}
