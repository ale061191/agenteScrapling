import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

export const dynamic = 'force-dynamic'

const IS_VERCEL = !!process.env.VERCEL
const DATA_DIR = path.join(process.cwd(), '..', 'leads_data')
const JOBS_FILE = path.join(DATA_DIR, 'search_jobs.json')
const PYTHON_EXE = 'C:\\Users\\Voltaje Plus\\AppData\\Local\\Python\\bin\\python.exe'
const MAIN_PY = path.join(process.cwd(), '..', 'main.py')

interface Job {
  jobId: string
  category: string
  state: string
  city: string
  parish?: string
  sector?: string
  deep: boolean
  googleSearch: boolean
  paginasAmarillas: boolean
  social: boolean
  tiktok: boolean
  status: 'running' | 'done' | 'error'
  started: string
  finished?: string
  leadsFound?: number
  output?: string
}

function readJobs(): Record<string, Job> {
  try {
    return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8'))
  } catch { return {} }
}

function writeJobs(jobs: Record<string, Job>) {
  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2), 'utf-8')
}

export async function POST(request: NextRequest) {
  if (IS_VERCEL) {
    return NextResponse.json({ error: 'La busqueda de leads solo funciona en modo local (tu PC). El dashboard en la nube solo muestra y gestiona leads existentes.' }, { status: 400 })
  }

  const body = await request.json()
  const { category, state, city, parish, sector, deep, googleSearch, paginasAmarillas, social, tiktok } = body
  if (!category || !state || !city) {
    return NextResponse.json({ error: 'category, state, and city are required' }, { status: 400 })
  }

  const jobId = `search_${Date.now()}`
  const job: Job = { jobId, category, state, city, parish, sector, deep: !!deep, googleSearch: !!googleSearch, paginasAmarillas: !!paginasAmarillas, social: !!social, tiktok: !!tiktok, status: 'running', started: new Date().toISOString() }

  const jobs = readJobs()
  jobs[jobId] = job
  writeJobs(jobs)

  const cityArg = city.replace(/ /g, '_')
  const flags = [
    ...(deep ? ['--deep'] : []),
    ...(googleSearch ? ['--gs'] : []),
    ...(paginasAmarillas ? ['--pa'] : []),
    ...(social ? ['--social'] : []),
    ...(tiktok ? ['--tiktok'] : []),
  ]
  const args = ['run', ...flags, category, state, cityArg]

  if (parish) args.push(parish.replace(/ /g, '_'))
  if (sector) args.push(sector.replace(/ /g, '_'))

  const proc = spawn(PYTHON_EXE, [MAIN_PY, ...args], {
    cwd: path.join(process.cwd(), '..'),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let output = ''
  proc.stdout.on('data', (data) => { output += data.toString() })
  proc.stderr.on('data', (data) => { output += data.toString() })

  proc.on('close', (code) => {
    const j = readJobs()
    const match = output.match(/(\d+)\s*encontrados/)
    const leadsFound = match ? parseInt(match[1]) : undefined
    j[jobId] = { ...j[jobId], status: code === 0 ? 'done' : 'error', finished: new Date().toISOString(), output: output.slice(-2000), leadsFound }
    writeJobs(j)
  })

  return NextResponse.json({ jobId, status: 'running' })
}

export async function GET(request: NextRequest) {
  if (IS_VERCEL) {
    return NextResponse.json({ jobs: [] })
  }

  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('jobId')
  const jobs = readJobs()
  if (jobId) {
    return NextResponse.json({ job: jobs[jobId] || null })
  }
  const recent = Object.values(jobs).sort((a, b) => b.started.localeCompare(a.started)).slice(0, 20)
  return NextResponse.json({ jobs: recent })
}

export async function DELETE(request: NextRequest) {
  if (IS_VERCEL) {
    return NextResponse.json({ success: true })
  }

  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('jobId')
  const jobs = readJobs()
  if (jobId) {
    delete jobs[jobId]
    writeJobs(jobs)
    return NextResponse.json({ success: true })
  }
  writeJobs({})
  return NextResponse.json({ success: true, message: 'History cleared' })
}
