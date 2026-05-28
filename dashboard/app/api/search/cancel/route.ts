import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

export const dynamic = 'force-dynamic'

const DATA_DIR = path.join(process.cwd(), '..', 'leads_data')
const JOBS_FILE = path.join(DATA_DIR, 'search_jobs.json')

interface Job {
  jobId: string; status: string; pid?: number; [key: string]: any
}

function readJobs(): Record<string, Job> {
  try { return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8')) } catch { return {} }
}

function writeJobs(jobs: Record<string, Job>) {
  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2), 'utf-8')
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { jobId } = body
  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 })
  }

  const jobs = readJobs()
  const job = jobs[jobId]

  if (job) {
    if (job.status === 'running') {
      job.status = 'cancelled'
      job.finished = new Date().toISOString()
    }
    if (job.pid) {
      try {
        execSync(`taskkill /F /T /PID ${job.pid}`, { stdio: 'ignore', timeout: 5000 })
      } catch {}
    }
    writeJobs(jobs)
  }

  return NextResponse.json({ success: true, cancelled: true })
}
