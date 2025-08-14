import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

type GameKind = 'HANGMAN' | 'SENTENCE'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const kindParam = url.searchParams.get('kind')
  const kind: GameKind | undefined = kindParam === 'HANGMAN' || kindParam === 'SENTENCE' ? kindParam : undefined
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

type CreateGameBody = {
  name?: unknown
  description?: unknown
  kind?: unknown
  rounds?: unknown
}

export async function POST(req: Request) {
  try {
    const body: CreateGameBody = await req.json()
    const name = (body?.name ?? '').toString().trim()
    const description = body?.description ? String(body.description) : null
    const roundsRaw = Array.isArray(body?.rounds) ? body.rounds : []
    const kind: GameKind = (body?.kind === 'HANGMAN' || body?.kind === 'SENTENCE') ? (body.kind as GameKind) : 'SENTENCE'

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    if (!roundsRaw.length) return NextResponse.json({ error: 'At least one round is required' }, { status: 400 })

    const roundCreates = roundsRaw.map((r: unknown, idx: number) => {
      const obj = (r ?? {}) as Record<string, unknown>
      const title = (obj?.title ?? `Round ${idx + 1}`).toString()
      const targetsArr = Array.isArray(obj?.targets) ? (obj.targets as unknown[]).map((t) => String(t)) : []
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
  } catch (e: unknown) {
    // Unique constraint
    if (typeof (e as { code?: unknown })?.code === 'string' && (e as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'A game with that name already exists' }, { status: 409 })
    }
    const msg = typeof (e as { message?: unknown })?.message === 'string' ? (e as { message: string }).message : 'Failed to create game'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
