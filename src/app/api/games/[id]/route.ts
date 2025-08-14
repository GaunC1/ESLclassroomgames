import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET(_req: Request, context: any) {
  const id = Number(context?.params?.id)
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

export async function DELETE(_req: Request, context: any) {
  const id = Number(context?.params?.id)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  // Delete dependent rounds first, then the game
  await prisma.round.deleteMany({ where: { gameId: id } })
  await prisma.game.delete({ where: { id } }).catch(() => {})
  return new Response(null, { status: 204 })
}

function safeParseTargets(s: string): string[] {
  try {
    const v = JSON.parse(s)
    if (Array.isArray(v)) return v.map(String)
  } catch {}
  return []
}
