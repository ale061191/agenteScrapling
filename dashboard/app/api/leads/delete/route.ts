import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

const PYTHON_EXE = 'C:\\Users\\Voltaje Plus\\AppData\\Local\\Python\\bin\\python.exe'
const MAIN_PY = path.join(process.cwd(), '..', 'main.py')

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { ids, all } = body
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
