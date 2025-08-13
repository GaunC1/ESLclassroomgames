import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  const games = await prisma.hangmanGame.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { words: true } } },
  })
  return NextResponse.json(
    games.map((g) => ({ id: g.id, name: g.name, description: g.description, roundsCount: g._count.words }))
  )
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const name = (body?.name ?? '').toString().trim()
    const description = body?.description ? String(body.description) : null
    const words = Array.isArray(body?.words) ? body.words.map((w: any, i: number) => ({ index: i, text: String(w) })) : []

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    if (!words.length) return NextResponse.json({ error: 'At least one word is required' }, { status: 400 })

    const game = await prisma.hangmanGame.create({
      data: {
        name,
        description,
        words: { create: words },
      },
      include: { _count: { select: { words: true } } },
    })
    return NextResponse.json({ id: game.id, name: game.name, roundsCount: game._count.words }, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'A game with that name already exists' }, { status: 409 })
    const msg = typeof e?.message === 'string' ? e.message : 'Failed to create game'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

