import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET(_req: Request, context: any) {
  const id = Number(context?.params?.id)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const game = await prisma.hangmanGame.findUnique({
    where: { id },
    include: { words: { orderBy: { index: 'asc' } } },
  })
  if (!game) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ id: game.id, name: game.name, description: game.description, words: (game.words || []).map((w) => w.text) })
}

export async function DELETE(_req: Request, context: any) {
  const id = Number(context?.params?.id)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  await prisma.hangmanWord.deleteMany({ where: { gameId: id } })
  await prisma.hangmanGame.delete({ where: { id } }).catch(() => {})
  return new Response(null, { status: 204 })
}
