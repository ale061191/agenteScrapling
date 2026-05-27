import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

export const dynamic = 'force-dynamic'
const IS_VERCEL = !!process.env.VERCEL
const PYTHON_EXE = 'C:\\Users\\Voltaje Plus\\AppData\\Local\\Python\\bin\\python.exe'
const MAIN_PY = path.join(process.cwd(), '..', 'main.py')

export async function GET() {
  if (IS_VERCEL) return NextResponse.json({ output: '', cloud: true, message: 'Historial solo disponible en modo local' })

  return new Promise<NextResponse>((resolve) => {
    const proc = spawn(PYTHON_EXE, [MAIN_PY, 'campaign', 'history'], {
      cwd: path.join(process.cwd(), '..'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    proc.stdout.on('data', (d: Buffer) => { output += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { output += d.toString() })
    proc.on('close', () => resolve(NextResponse.json({ output: output.slice(-2000) })))
    proc.on('error', () => resolve(NextResponse.json({ output: '' })))
  })
}
