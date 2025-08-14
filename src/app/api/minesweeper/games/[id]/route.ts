import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

function parseChoices(s: string): string[] {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v.map(String) : [] } catch { return [] }
}

type IdParams = { params: { id: string } }

export async function GET(_req: Request, context: IdParams) {
  const id = Number(context?.params?.id)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const set = await prisma.minesweeperGame.findUnique({
    where: { id },
    include: { questions: { orderBy: { index: 'asc' } } },
  })
  if (!set) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    id: set.id,
    name: set.name,
    description: set.description,
    questions: set.questions.map((q) => ({
      index: q.index,
      prompt: q.prompt,
      choices: parseChoices(q.choices),
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      imageUrl: q.imageUrl,
    })),
  })
}

export async function DELETE(_req: Request, context: IdParams) {
  const id = Number(context?.params?.id)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  // delete questions first
  await prisma.minesweeperQuestion.deleteMany({ where: { gameId: id } })
  await prisma.minesweeperGame.delete({ where: { id } }).catch(() => {})
  return new Response(null, { status: 204 })
}
