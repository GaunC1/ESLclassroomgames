import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// List all minesweeper question sets
export async function GET() {
  const sets = await prisma.minesweeperGame.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { questions: true } } },
  })
  // Keep property name as roundsCount to reuse GameChooser type
  return NextResponse.json(
    sets.map((s) => ({ id: s.id, name: s.name, description: s.description, roundsCount: s._count.questions }))
  )
}

// Create a new question set
export async function POST(req: Request) {
  try {
    const body: { name?: unknown; description?: unknown; questions?: unknown } = await req.json()
    const name = (body?.name ?? '').toString().trim()
    const description = body?.description ? String(body.description) : null
    const questions = Array.isArray(body?.questions) ? (body.questions as unknown[]) : []

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    if (!questions.length) return NextResponse.json({ error: 'At least one question is required' }, { status: 400 })

    const qCreates = questions.map((q: unknown, idx: number) => {
      const obj = (q ?? {}) as Record<string, unknown>
      const prompt = (obj?.prompt ?? '').toString()
      const choicesArr: string[] = Array.isArray(obj?.choices) ? (obj.choices as unknown[]).map((c) => String(c)) : []
      const ciRaw = (obj as { correctIndex?: unknown })?.correctIndex
      const correctIndex = Number.isFinite(ciRaw) ? Number(ciRaw) : 0
      const explanation = (obj as { explanation?: unknown })?.explanation ? String((obj as { explanation?: unknown }).explanation) : null
      const imageUrl = (obj as { imageUrl?: unknown })?.imageUrl ? String((obj as { imageUrl?: unknown }).imageUrl) : null
      if (!prompt) throw new Error('Question prompt is required')
      if (choicesArr.length < 2) throw new Error('Each question must have at least 2 choices')
      if (correctIndex < 0 || correctIndex >= choicesArr.length) throw new Error('correctIndex out of range')
      return {
        index: idx,
        prompt,
        choices: JSON.stringify(choicesArr),
        correctIndex,
        explanation,
        imageUrl,
      }
    })

    const set = await prisma.minesweeperGame.create({
      data: {
        name,
        description,
        questions: { create: qCreates },
      },
      include: { _count: { select: { questions: true } } },
    })

    return NextResponse.json({ id: set.id, name: set.name, roundsCount: set._count.questions }, { status: 201 })
  } catch (e: unknown) {
    if (typeof (e as { code?: unknown })?.code === 'string' && (e as { code: string }).code === 'P2002') return NextResponse.json({ error: 'A set with that name already exists' }, { status: 409 })
    const msg = typeof (e as { message?: unknown })?.message === 'string' ? (e as { message: string }).message : 'Failed to create set'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
