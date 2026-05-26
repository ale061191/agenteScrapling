import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'

const CAMPAIGNS_DIR = path.join(process.cwd(), '..', 'leads_data', 'campaigns')

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    fs.mkdirSync(CAMPAIGNS_DIR, { recursive: true })
    const buffer = Buffer.from(await file.arrayBuffer())
    const filePath = path.join(CAMPAIGNS_DIR, file.name)
    fs.writeFileSync(filePath, buffer)

    return NextResponse.json({ success: true, name: file.name, path: filePath })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function GET() {
  try {
    fs.mkdirSync(CAMPAIGNS_DIR, { recursive: true })
    const files = fs.readdirSync(CAMPAIGNS_DIR).filter(f => f !== '.gitkeep')
    return NextResponse.json({ files })
  } catch {
    return NextResponse.json({ files: [] })
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const fp = path.join(CAMPAIGNS_DIR, name)
  if (fs.existsSync(fp)) fs.unlinkSync(fp)
  return NextResponse.json({ success: true })
}
