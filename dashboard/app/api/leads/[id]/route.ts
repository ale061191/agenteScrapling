import { NextRequest, NextResponse } from 'next/server'
import { getLeadById, updateLead } from '@/lib/data'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)
  const lead = await getLeadById(id)
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ lead })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)
  const body = await request.json()
  const ok = await updateLead(id, { status: body.status, notes: body.notes })
  return NextResponse.json({ success: ok })
}
