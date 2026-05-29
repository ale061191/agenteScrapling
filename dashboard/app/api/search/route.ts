import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const PYTHON_EXE = 'C:\\Users\\Voltaje Plus\\AppData\\Local\\Python\\bin\\python.exe'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { category, state, city, parish, sector, deep, googleSearch, paginasAmarillas, social, tiktok, instagram, maxDeep } = body

  if (!category || !state || !city) {
    return NextResponse.json({ error: 'category, state, and city are required' }, { status: 400 })
  }

  const isDev = process.env.NODE_ENV === 'development'

  // Only run locally in development mode, otherwise require microservice
  if (!isDev && !process.env.SCRAPER_API_URL) {
    return NextResponse.json({
      error: 'Busqueda no disponible en la nube',
      hint: 'Despliega el microservicio en Cyclic.sh y configura SCRAPER_API_URL en tu .env'
    }, { status: 503 })
  }

  // Use microservice if available
  if (process.env.SCRAPER_API_URL) {
    try {
      const res = await fetch(`${process.env.SCRAPER_API_URL}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.SCRAPER_API_KEY ? { 'Authorization': `Bearer ${process.env.SCRAPER_API_KEY}` } : {}),
        },
        body: JSON.stringify({ category, state, city, parish, sector, deep, googleSearch, paginasAmarillas, social, tiktok, instagram, maxDeep }),
      })
      const data = await res.json()
      return NextResponse.json({ jobId: data.jobId, status: data.status, leadsFound: data.leadsFound, message: data.message })
    } catch (err) {
      return NextResponse.json({ error: 'Microservicio no disponible' }, { status: 503 })
    }
  }

  // Local development: spawn Python synchronously and wait for result
  const MAIN_PY = path.join(process.cwd(), '..', 'main.py')

  const flags = [
    ...(deep ? ['--deep'] : []),
    ...(googleSearch ? ['--gs'] : []),
    ...(paginasAmarillas ? ['--pa'] : []),
    ...(social ? ['--social'] : []),
    ...(tiktok ? ['--tiktok'] : []),
    ...(instagram ? ['--instagram'] : []),
    ...(maxDeep && maxDeep > 0 ? ['--max-deep', String(maxDeep)] : []),
  ]

  // Build args: run <category> <state> <city> [parish] [sector]
  const cityArg = city.replace(/ /g, '_')
  const stateArg = state.replace(/ /g, '_')
  const parishArg = parish ? parish.replace(/ /g, '_') : null
  const sectorArg = sector ? sector.replace(/ /g, '_') : null

  const args = ['run', ...flags, category, stateArg, cityArg]
  if (parishArg) args.push(parishArg)
  if (sectorArg) args.push(sectorArg)

  const jobId = `search_${Date.now()}`

  console.log(`[SEARCH] Running: ${PYTHON_EXE} ${MAIN_PY} ${args.join(' ')}`)

  let output = '', stderr = ''
  let leadsFound = 0
  let errorMsg = null

  try {
    const proc = spawn(PYTHON_EXE, [MAIN_PY, ...args], {
      cwd: path.join(process.cwd(), '..'),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    // Wait for process to complete with timeout
    const exitCode = await new Promise((resolve) => {
      proc.stdout.on('data', (data) => { output += data.toString() })
      proc.stderr.on('data', (data) => { stderr += data.toString() })
      proc.on('error', (err) => {
        console.error('[SEARCH] Process error:', err)
        errorMsg = err.message
      })
      proc.on('close', (code) => {
        console.log(`[SEARCH] Python exited with code ${code}`)
        console.log(`[SEARCH] Output: ${output.substring(0, 500)}`)
        resolve(code)
      })

      // Timeout after 5 minutes
      setTimeout(() => {
        console.log('[SEARCH] Timeout - killing process')
        proc.kill()
        resolve(-1)
      }, 300000)
    })

    if (errorMsg) {
      return NextResponse.json({ error: `Error ejecutando Python: ${errorMsg}` }, { status: 500 })
    }

    // Parse output for results
    // Look for patterns like "30 encontrados" or "Found X" or "X leads"
    const patterns = [
      /(\d+)\s*encontrados?/i,
      /(\d+)\s*found/i,
      /(\d+)\s*leads?/i,
      /total:\s*(\d+)/i,
      /nuevos:\s*(\d+)/i,
    ]

    for (const pattern of patterns) {
      const match = output.match(pattern)
      if (match) {
        leadsFound = parseInt(match[1])
        break
      }
    }

    if (exitCode !== 0 && !leadsFound) {
      console.error(`[SEARCH] Non-zero exit: ${exitCode}, stderr: ${stderr.substring(0, 200)}`)
      if (stderr.includes('ModuleNotFoundError') || stderr.includes('ImportError')) {
        return NextResponse.json({
          error: 'Falta instalar librerias Python',
          hint: 'Ejecuta en terminal: pip install scrapling flask supabase playwright && python -m playwright install chromium --with-deps',
          detail: stderr.substring(0, 300)
        }, { status: 500 })
      }
      if (stderr.includes('playwright') || stderr.includes('browser') || stderr.includes('chromium') || stderr.includes('Executable')) {
        return NextResponse.json({
          error: 'Navegador de Playwright no instalado',
          hint: 'Ejecuta en terminal: python -m playwright install chromium --with-deps',
          detail: stderr.substring(0, 300)
        }, { status: 500 })
      }
    }

    console.log(`[SEARCH] Done: ${leadsFound} leads found`)

    return NextResponse.json({
      jobId,
      status: 'done',
      leadsFound,
      message: leadsFound > 0
        ? `${leadsFound} leads encontrados en ${city}, ${state}`
        : `Busqueda completada sin resultados en ${city}, ${state}`
    })

  } catch (err) {
    console.error('[SEARCH] Fatal error:', err)
    return NextResponse.json({ error: `Error: ${err.message}` }, { status: 500 })
  }
}