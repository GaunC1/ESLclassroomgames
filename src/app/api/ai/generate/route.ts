import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { generateGameFromText } from '@/lib/ai/gameGeneration'


export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not set' }, { status: 500 })
    }

    const body = await req.json().catch(() => ({}))
    const sourceText: string = (body?.text ?? '').toString()
    const numRounds: number | undefined = toInt(body?.config?.NUM_ROUNDS)
    const minTargets: number | undefined = toInt(body?.config?.MIN_TARGETS_PER_ROUND)
    const maxTargets: number | undefined = toInt(body?.config?.MAX_TARGETS_PER_ROUND)
    const providedName: string | undefined = body?.name ? String(body.name) : undefined
    const providedDescription: string | undefined = body?.description ? String(body.description) : undefined

    if (!sourceText?.trim()) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 })
    }

    // Load prompt template
    const promptPath = path.join(process.cwd(), 'prompt.txt')
    const template = await readFile(promptPath, 'utf8')

    const result = await generateGameFromText({
      apiKey: process.env.OPENAI_API_KEY,
      text: sourceText,
      template,
      model: process.env.OPENAI_MODEL,
      config: {
        NUM_ROUNDS: numRounds,
        MIN_TARGETS_PER_ROUND: minTargets,
        MAX_TARGETS_PER_ROUND: maxTargets,
      },
      name: providedName,
      description: providedDescription,
    })
    return NextResponse.json(result)
  } catch (e: unknown) {
    const msg = typeof (e as { message?: unknown })?.message === 'string' ? (e as { message: string }).message : 'Failed to generate'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function toInt(v: unknown): number | undefined {
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}
