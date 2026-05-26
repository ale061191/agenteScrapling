import { NextResponse } from 'next/server'
import { getStats } from '@/lib/data'

export async function GET() {
  const stats = getStats()
  return NextResponse.json(stats)
}
