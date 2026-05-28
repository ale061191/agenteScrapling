import { NextRequest, NextResponse } from 'next/server'
import { spawn, execSync } from 'child_process'
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
  instagram: boolean
  maxDeep?: number
  status: 'running' | 'done' | 'error' | 'cancelled'
  started: string
  finished?: string
  leadsFound?: number
  output?: string
  progress?: string
  pid?: number
}

function readJobs(): Record<string, Job> {
  try {
    return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8'))
  } catch { return {} }
}

function writeJobs(jobs: Record<string, Job>) {
  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2), 'utf-8')
}

function deleteJob(jobId: string) {
  const jobs = readJobs()
  delete jobs[jobId]
  writeJobs(jobs)
}

function killByPid(pid: number) {
  try { execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore', timeout: 5000 }) } catch {}
}

export async function POST(request: NextRequest) {
  if (IS_VERCEL) {
    return NextResponse.json({ error: 'Solo funciona en modo local' }, { status: 400 })
  }

  const body = await request.json()
  const { category, state, city, parish, sector, deep, googleSearch, paginasAmarillas, social, tiktok, instagram, maxDeep } = body
  if (!category || !state || !city) {
    return NextResponse.json({ error: 'category, state, and city are required' }, { status: 400 })
  }

  const jobId = `search_${Date.now()}`
  const job: Job = { jobId, category, state, city, parish, sector, deep: !!deep, googleSearch: !!googleSearch, paginasAmarillas: !!paginasAmarillas, social: !!social, tiktok: !!tiktok, instagram: !!instagram, status: 'running', started: new Date().toISOString() }

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
    ...(instagram ? ['--instagram'] : []),
    ...(maxDeep && maxDeep > 0 ? ['--max-deep', String(maxDeep)] : []),
  ]
  const args = ['run', ...flags, category, state, cityArg]
  if (parish) args.push(parish.replace(/ /g, '_'))
  if (sector) args.push(sector.replace(/ /g, '_'))

  const proc = spawn(PYTHON_EXE, [MAIN_PY, ...args], {
    cwd: path.join(process.cwd(), '..'),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const j = readJobs()
  j[jobId].pid = proc.pid
  writeJobs(j)

  let output = ''
  proc.stdout.on('data', (data) => { output += data.toString() })
  proc.stderr.on('data', (data) => { output += data.toString() })

  proc.on('close', (code) => {
    const jobs2 = readJobs()
    if (jobs2[jobId]?.status === 'cancelled') {
      writeJobs(jobs2)
      return
    }
    const match = output.match(/(\d+)\s*encontrados/)
    const leadsFound = match ? parseInt(match[1]) : undefined
    jobs2[jobId] = { ...jobs2[jobId], status: code === 0 ? 'done' : 'error', finished: new Date().toISOString(), output: output.slice(-2000), leadsFound }
    writeJobs(jobs2)
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
  if (jobId) {
    const jobs = readJobs()
    const job = jobs[jobId]
    if (job && job.pid) killByPid(job.pid)
    deleteJob(jobId)
    return NextResponse.json({ success: true })
  }
  writeJobs({})
  return NextResponse.json({ success: true })
}
