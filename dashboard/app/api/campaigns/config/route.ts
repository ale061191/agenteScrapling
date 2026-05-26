import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

const PYTHON_EXE = 'C:\\Users\\Voltaje Plus\\AppData\\Local\\Python\\bin\\python.exe'
const MAIN_PY = path.join(process.cwd(), '..', 'main.py')

export async function GET() {
  return new Promise<NextResponse>((resolve) => {
    const proc = spawn(PYTHON_EXE, [MAIN_PY, 'campaign', 'config', '--show'], {
      cwd: path.join(process.cwd(), '..'),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    proc.stdout.on('data', (d: Buffer) => { output += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { output += d.toString() })
    proc.on('close', () => {
      const configured = output.includes('smtp.gmail.com') || output.includes('Configurado')
      const email = output.match(/[\\w.+-]+@gmail\\.com/)
      resolve(NextResponse.json({ configured, email: email ? email[0] : null, output: output.slice(-500) }))
    })
    proc.on('error', () => resolve(NextResponse.json({ configured: false })))
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { host, port, user, password, fromName } = body
  if (!user || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }

  return new Promise<NextResponse>((resolve) => {
    const proc = spawn(PYTHON_EXE, [
      MAIN_PY, 'campaign', 'config', '--set',
      '--host', host || 'smtp.gmail.com',
      '--port', String(port || 587),
      '--user', user,
      '--password', password,
      '--from-name', fromName || 'Lead Finder',
    ], {
      cwd: path.join(process.cwd(), '..'),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    proc.stdout.on('data', (d: Buffer) => { output += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { output += d.toString() })
    proc.on('close', (code) => {
      resolve(NextResponse.json({ success: code === 0, output: output.slice(-500) }))
    })
    proc.on('error', () => resolve(NextResponse.json({ success: false }, { status: 500 })))
  })
}
