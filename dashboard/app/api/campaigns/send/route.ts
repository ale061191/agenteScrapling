import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

const PYTHON_EXE = 'C:\\Users\\Voltaje Plus\\AppData\\Local\\Python\\bin\\python.exe'
const MAIN_PY = path.join(process.cwd(), '..', 'main.py')
const CAMPAIGNS_DIR = path.join(process.cwd(), '..', 'leads_data', 'campaigns')

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { leadIds, subject, bodyHtml, files, filters } = body

  if (!subject || !bodyHtml) {
    return NextResponse.json({ error: 'subject and bodyHtml are required' }, { status: 400 })
  }

  const attachArgs: string[] = []
  if (files && files.length > 0) {
    for (const f of files) {
      attachArgs.push('--attach', path.join(CAMPAIGNS_DIR, f))
    }
  }

  const idsArg = leadIds && leadIds.length > 0 ? `--ids=${leadIds.join(',')}` : ''
  const filterArgs: string[] = []
  if (filters) {
    const parts: string[] = []
    if (filters.category) parts.push(`category=${filters.category}`)
    if (filters.status) parts.push(`status=${filters.status}`)
    if (filters.state) parts.push(`state=${filters.state}`)
    if (filters.city) parts.push(`city=${filters.city}`)
    if (filters.search) parts.push(`search=${filters.search}`)
    if (parts.length > 0) filterArgs.push('--filters', parts.join(','))
  }

  const procArgs = ['campaign', 'send', '--subject', subject, '--body', bodyHtml, ...attachArgs]
  if (idsArg) procArgs.push(idsArg)
  if (filterArgs.length > 0) procArgs.push(...filterArgs)

  return new Promise<NextResponse>((resolve) => {
    const proc = spawn(PYTHON_EXE, [MAIN_PY, ...procArgs], {
      cwd: path.join(process.cwd(), '..'),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    proc.stdout.on('data', (d: Buffer) => { output += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { output += d.toString() })
    proc.on('close', (code) => {
      const sentMatch = output.match(/Enviados:\s*(\d+)/)
      const sent = sentMatch ? parseInt(sentMatch[1]) : 0
      resolve(NextResponse.json({ success: code === 0, sent, output: output.slice(-1000) }))
    })
    proc.on('error', () => resolve(NextResponse.json({ success: false, error: 'Failed' }, { status: 500 })))
  })
}
