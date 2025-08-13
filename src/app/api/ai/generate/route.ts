import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const MODEL = process.env.OPENAI_MODEL || 'gpt-5-nano'

// JSON schema the model must produce
const jsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    rounds: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'targets'],
        properties: {
          title: { type: 'string' },
          targets: {
            type: 'array',
            minItems: 1,
            items: { type: 'string' },
          },
        },
      },
    },
    notes: { type: 'string' },
  },
  required: ['name', 'description', 'rounds', 'notes'],
} as const

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

    // Assemble the user section with pasted text + config overrides
    const userSection = [
      '--- BEGIN TEXT ---',
      sourceText.trim(),
      '--- END TEXT ---',
      '',
      '--- BEGIN CONFIG ---',
      ...(numRounds ? [`NUM_ROUNDS=${numRounds}`] : []),
      ...(minTargets ? [`MIN_TARGETS_PER_ROUND=${minTargets}`] : []),
      ...(maxTargets ? [`MAX_TARGETS_PER_ROUND=${maxTargets}`] : []),
      '--- END CONFIG ---',
    ].join('\n')

    // If teacher provided name/description, prepend an instruction line
    const nameDescHint = providedName || providedDescription
      ? `Use this name/description if present:\nNAME=${providedName ?? ''}\nDESCRIPTION=${providedDescription ?? ''}`
      : ''

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const resp = await openai.responses.create({
      model: MODEL,
      input: [
        {
          role: 'developer',
          content: [
            { type: 'input_text', text: 'System role: You generate JSON rounds for an ESL sentence-writing game from a pasted text block. Follow the constraints exactly and output only JSON.' },
          ],
        },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: template },
          ],
        },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: [nameDescHint, userSection].filter(Boolean).join('\n\n') },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'esl_sentence_writing_game',
          strict: true,
          schema: jsonSchema as any,
        },
        verbosity: 'medium',
      },
    })

    // Extract JSON text from the response
    const out = resp.output?.[0]
    let jsonText: string | undefined
    if (out && out.type === 'output_text') {
      jsonText = out.text
    } else if (resp.output_text) {
      jsonText = resp.output_text
    }
    if (!jsonText) {
      return NextResponse.json({ error: 'No JSON returned' }, { status: 502 })
    }

    const parsed = JSON.parse(jsonText)
    // Basic validate
    if (!parsed || !Array.isArray(parsed.rounds)) {
      return NextResponse.json({ error: 'Invalid JSON shape from model' }, { status: 502 })
    }
    return NextResponse.json(parsed)
  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : 'Failed to generate'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function toInt(v: any): number | undefined {
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}
