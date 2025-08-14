import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-5-nano'

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'OPENAI_API_KEY is not set' }, { status: 500 })
    const body = await req.json().catch(() => ({}))
    const text: string = (body?.text ?? '').toString()
    const numQuestions: number = clampInt(body?.numQuestions, 1, 100) ?? 10
    const choicesPerQuestion: number = clampInt(body?.choicesPerQuestion, 2, 6) ?? 4
    const name: string | undefined = body?.name ? String(body.name) : undefined
    const description: string | undefined = body?.description ? String(body.description) : undefined
    if (!text.trim()) return NextResponse.json({ error: 'Missing text' }, { status: 400 })

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        questions: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['prompt', 'choices', 'correctIndex'],
            properties: {
              prompt: { type: 'string' },
              choices: { type: 'array', minItems: 2, maxItems: 6, items: { type: 'string' } },
              correctIndex: { type: 'integer', minimum: 0 },
              explanation: { type: 'string' },
              imageUrl: { type: 'string' },
            },
          },
        },
      },
      required: ['name', 'description', 'questions'],
    } as const

    const developer = 'You create age-appropriate ESL multiple-choice questions from a pasted text. Output only JSON.'
    const instructions = [
      `Create ${numQuestions} questions. Each with exactly ${choicesPerQuestion} choices.`,
      'Use simple, clear wording. Include plausible distractors. Avoid trick questions. Keep answers grounded in the provided text or basic vocabulary.',
      name || description ? `If name/description provided, prefer them.` : '',
    ].filter(Boolean).join('\n')

    const resp: any = await openai.responses.create({
      model: DEFAULT_MODEL,
      input: [
        { role: 'developer', content: [{ type: 'input_text', text: developer }] },
        { role: 'user', content: [{ type: 'input_text', text: instructions }] },
        { role: 'user', content: [{ type: 'input_text', text: ['--- BEGIN TEXT ---', text, '--- END TEXT ---'].join('\n') }] },
      ],
      text: {
        format: { type: 'json_schema', name: 'mcq_set', strict: true, schema: schema as any },
      },
    })

    const out = (resp as any).output?.[0]
    const jsonText: string | undefined = out?.type === 'output_text' ? out.text : (resp as any).output_text
    if (!jsonText) throw new Error('No JSON returned')
    const parsed = JSON.parse(jsonText)
    return NextResponse.json(parsed)
  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : 'Failed to generate'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function clampInt(v: any, min: number, max: number): number | undefined {
  const n = Number(v)
  if (!Number.isFinite(n)) return undefined
  return Math.max(min, Math.min(max, Math.floor(n)))
}

