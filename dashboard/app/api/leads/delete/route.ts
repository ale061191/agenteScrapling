import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { spawn } from 'child_process'
import path from 'path'

export const dynamic = 'force-dynamic'

const IS_VERCEL = !!process.env.VERCEL
const PYTHON_EXE = 'C:\\Users\\Voltaje Plus\\AppData\\Local\\Python\\bin\\python.exe'
const MAIN_PY = path.join(process.cwd(), '..', 'main.py')

async function deleteFromSupabase(ids?: number[]) {
  const supabase = getSupabase()
  let query = supabase.from('leads').delete()
  if (ids && ids.length > 0) {
    query = query.in('id', ids)
  }
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { ids, all } = body

  if (IS_VERCEL) {
    try {
      const deleted = await deleteFromSupabase(all ? undefined : ids)
      const count = all ? (deleted?.length || 0) : (ids?.length || 0)
      return NextResponse.json({ success: true, deletedCount: count, cloud: true })
    } catch (err: any) {
      return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
  }

  if (!all && (!ids || !Array.isArray(ids) || ids.length === 0)) {
    return NextResponse.json({ error: 'Provide ids array or all: true' }, { status: 400 })
  }

  let args: string[]
  if (all) {
    args = ['delete', '--all']
  } else {
    args = ['delete', '--ids', ids.join(',')]
  }

  return new Promise<NextResponse>((resolve) => {
    const proc = spawn(PYTHON_EXE, [MAIN_PY, ...args], {
      cwd: path.join(process.cwd(), '..'),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    proc.stdout.on('data', (data) => { output += data.toString() })
    proc.stderr.on('data', (data) => { output += data.toString() })
    proc.on('close', (code) => {
      const match = output.match(/(\d+)\s*lead/)
      const deletedCount = match ? parseInt(match[1]) : 0
      resolve(NextResponse.json({ success: code === 0, deletedCount, output: output.slice(-500) }))
    })
    proc.on('error', () => {
      resolve(NextResponse.json({ success: false, error: 'Failed to spawn process' }, { status: 500 }))
    })
  })
}
