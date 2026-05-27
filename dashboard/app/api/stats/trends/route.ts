import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

export const dynamic = 'force-dynamic'
const IS_VERCEL = !!process.env.VERCEL
const PYTHON_EXE = 'C:\\Users\\Voltaje Plus\\AppData\\Local\\Python\\bin\\python.exe'
const MAIN_PY = path.join(process.cwd(), '..', 'main.py')

export async function GET() {
  if (IS_VERCEL) return NextResponse.json({ lead_trend: [], campaign_trend: [] })

  return new Promise<NextResponse>((resolve) => {
    const proc = spawn(PYTHON_EXE, [MAIN_PY, 'stats', '--trend'], {
      cwd: path.join(process.cwd(), '..'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    proc.stdout.on('data', (d: Buffer) => { output += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { output += d.toString() })
    proc.on('close', () => {
      try { resolve(NextResponse.json(JSON.parse(output))) }
      catch { resolve(NextResponse.json({ lead_trend: [], campaign_trend: [] })) }
    })
    proc.on('error', () => resolve(NextResponse.json({ lead_trend: [], campaign_trend: [] })))
  })
}
