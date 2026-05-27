import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'

export const dynamic = 'force-dynamic'
const IS_VERCEL = !!process.env.VERCEL
const CAMPAIGNS_DIR = path.join(process.cwd(), '..', 'leads_data', 'campaigns')

function localPath(...parts: string[]) {
  return IS_VERCEL ? path.join('/tmp', 'campaigns', ...parts) : path.join(CAMPAIGNS_DIR, ...parts)
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const dir = localPath()
    fs.mkdirSync(dir, { recursive: true })
    const buffer = Buffer.from(await file.arrayBuffer())
    const filePath = localPath(file.name)
    fs.writeFileSync(filePath, buffer)

    return NextResponse.json({ success: true, name: file.name, path: filePath })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function GET() {
  try {
    const dir = localPath()
    fs.mkdirSync(dir, { recursive: true })
    const files = fs.readdirSync(dir).filter(f => f !== '.gitkeep')
    return NextResponse.json({ files })
  } catch {
    return NextResponse.json({ files: [] })
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const fp = localPath(name)
  if (fs.existsSync(fp)) fs.unlinkSync(fp)
  return NextResponse.json({ success: true })
}
