import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SCRAPER_API_URL = process.env.SCRAPER_API_URL || ''
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY || ''

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { category, state, city, parish, sector, deep, googleSearch, paginasAmarillas, social, tiktok, instagram, maxDeep } = body

  if (!category || !state || !city) {
    return NextResponse.json({ error: 'category, state, and city are required' }, { status: 400 })
  }

  // If we have a scraper microservice URL, use it
  if (SCRAPER_API_URL) {
    try {
      const res = await fetch(`${SCRAPER_API_URL}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(SCRAPER_API_KEY ? { 'Authorization': `Bearer ${SCRAPER_API_KEY}` } : {}),
        },
        body: JSON.stringify({ category, state, city, parish, sector, deep, googleSearch, paginasAmarillas, social, tiktok, instagram, maxDeep }),
      })
      const data = await res.json()
      return NextResponse.json({ jobId: data.jobId, status: data.status, leadsFound: data.leadsFound, message: data.message })
    } catch (err) {
      return NextResponse.json({ error: 'Microservicio no disponible' }, { status: 503 })
    }
  }

  // Fallback for local development - check if we're in dev mode
  const isDev = process.env.NODE_ENV === 'development'
  
  if (!isDev && !SCRAPER_API_URL) {
    return NextResponse.json({ 
      error: 'Busqueda no disponible en la nube', 
      hint: 'La busqueda de nuevos leads requiere configurar SCRAPER_API_URL. Despliega el microservicio en Render.com y configura la variable de entorno.',
      docs: 'https://render.com/docs/deployments'
    }, { status: 503 })
  }

  // Local development fallback - spawn Python process
  const { spawn } = await import('child_process')
  const path = await import('path')
  
  const PYTHON_EXE = 'C:\\Users\\Voltaje Plus\\AppData\\Local\\Python\\bin\\python.exe'
  const MAIN_PY = path.join(process.cwd(), '..', 'main.py')

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

  const jobId = `search_${Date.now()}`

  const proc = spawn(PYTHON_EXE, [MAIN_PY, ...args], {
    cwd: path.join(process.cwd(), '..'),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let output = ''
  proc.stdout.on('data', (data) => { output += data.toString() })
  proc.stderr.on('data', (data) => { output += data.toString() })

  proc.on('close', (code) => {
    const match = output.match(/(\d+)\s*encontrados/)
    const leadsFound = match ? parseInt(match[1]) : 0
    console.log(`Local search done: ${leadsFound} leads`)
  })

  return NextResponse.json({ jobId, status: 'running', message: 'Buscando localmente...' })
}