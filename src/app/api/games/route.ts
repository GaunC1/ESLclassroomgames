import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const kind = url.searchParams.get('kind') as any | null
  const where = kind ? { kind } : {}
  const games = await prisma.game.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { rounds: true } } },
  })
  return NextResponse.json(
    games.map((g) => ({ id: g.id, name: g.name, description: g.description, roundsCount: g._count.rounds }))
  )
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const name = (body?.name ?? '').toString().trim()
    const description = body?.description ? String(body.description) : null
    const rounds = Array.isArray(body?.rounds) ? body.rounds : []
    const kind = (body?.kind === 'HANGMAN' || body?.kind === 'SENTENCE') ? body.kind : 'SENTENCE'

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    if (!rounds.length) return NextResponse.json({ error: 'At least one round is required' }, { status: 400 })

    const roundCreates = rounds.map((r: any, idx: number) => {
      const title = (r?.title ?? `Round ${idx + 1}`).toString()
      const targetsArr = Array.isArray(r?.targets) ? r.targets.map((t: any) => String(t)) : []
      if (!targetsArr.length) throw new Error('Each round must include at least one target')
      return { index: idx, title, targets: JSON.stringify(targetsArr) }
    })

    const game = await prisma.game.create({
      data: {
        name,
        description,
        kind,
        rounds: { create: roundCreates },
      },
      include: { _count: { select: { rounds: true } } },
    })

    return NextResponse.json({ id: game.id, name: game.name, roundsCount: game._count.rounds }, { status: 201 })
  } catch (e: any) {
    // Unique constraint
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'A game with that name already exists' }, { status: 409 })
    }
    const msg = typeof e?.message === 'string' ? e.message : 'Failed to create game'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
