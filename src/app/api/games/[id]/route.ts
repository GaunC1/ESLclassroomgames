import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

type Params = { params: { id: string } }

export async function GET(_req: Request, { params }: Params) {
  const id = Number(params.id)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const game = await prisma.game.findUnique({
    where: { id },
    include: { rounds: { orderBy: { index: 'asc' } } },
  })
  if (!game) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    id: game.id,
    name: game.name,
    description: game.description,
    rounds: game.rounds.map((r) => ({
      index: r.index,
      title: r.title,
      targets: safeParseTargets(r.targets),
    })),
  })
}

function safeParseTargets(s: string): string[] {
  try {
    const v = JSON.parse(s)
    if (Array.isArray(v)) return v.map(String)
  } catch {}
  return []
}
