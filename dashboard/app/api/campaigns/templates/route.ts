import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'

export const dynamic = 'force-dynamic'

const IS_VERCEL = !!process.env.VERCEL
const DATA_DIR = IS_VERCEL ? '/tmp' : path.join(process.cwd(), '..', 'leads_data')
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json')

interface Template {
  id: string
  name: string
  category: string
  subject: string
  bodyPlain: string
  bodyHtml: string
  files: string[]
  createdAt: string
  updatedAt: string
}

function readTemplates(): Template[] {
  try {
    return JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf-8'))
  } catch { return [] }
}

function writeTemplates(templates: Template[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2), 'utf-8')
}

export async function GET() {
  const templates = readTemplates()
  return NextResponse.json({ templates })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { id, name, category, subject, bodyPlain, bodyHtml, files } = body
  if (!name || !subject || !bodyPlain) {
    return NextResponse.json({ error: 'name, subject, and bodyPlain are required' }, { status: 400 })
  }

  const templates = readTemplates()
  const now = new Date().toISOString()
  const existing = id ? templates.find(t => t.id === id) : null

  if (existing) {
    Object.assign(existing, {
      name, category: category || '', subject, bodyPlain, bodyHtml: bodyHtml || bodyPlain, files: files || [],
      updatedAt: now,
    })
  } else {
    templates.push({
      id: `tmpl_${Date.now()}`,
      name, category: category || '', subject, bodyPlain, bodyHtml: bodyHtml || bodyPlain, files: files || [],
      createdAt: now, updatedAt: now,
    })
  }

  writeTemplates(templates)
  return NextResponse.json({ success: true, templates })
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const templates = readTemplates().filter(t => t.id !== id)
  writeTemplates(templates)
  return NextResponse.json({ success: true })
}
