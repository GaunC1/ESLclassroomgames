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
            // Strict schema requires listing every property in `required`
            required: ['prompt', 'choices', 'correctIndex', 'explanation', 'imageUrl'],
            properties: {
              prompt: { type: 'string' },
              choices: { type: 'array', minItems: choicesPerQuestion, maxItems: choicesPerQuestion, items: { type: 'string' } },
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
      'Always include keys: prompt, choices, correctIndex, explanation, imageUrl. Use empty string for explanation/imageUrl when not needed.',
      name || description ? `If name/description provided, prefer them.` : '',
    ].filter(Boolean).join('\n')

    const resp: unknown = await openai.responses.create({
      model: DEFAULT_MODEL,
      input: [
        { role: 'developer', content: [{ type: 'input_text', text: developer }] },
        { role: 'user', content: [{ type: 'input_text', text: instructions }] },
        { role: 'user', content: [{ type: 'input_text', text: ['--- BEGIN TEXT ---', text, '--- END TEXT ---'].join('\n') }] },
      ],
      text: {
        // Cast schema to unknown to avoid 'any' while satisfying SDK type
        format: { type: 'json_schema', name: 'mcq_set', strict: true, schema: schema as unknown },
      },
    })

    type OutputChunk = { type?: unknown; text?: unknown }
    type ResponseLike = { output?: unknown; output_text?: unknown }
    const r = resp as ResponseLike
    let jsonText: string | undefined
    if (Array.isArray(r.output) && r.output.length > 0) {
      const first = r.output[0] as OutputChunk
      if (first && first.type === 'output_text' && typeof first.text === 'string') jsonText = first.text
    }
    if (!jsonText && typeof r.output_text === 'string') jsonText = r.output_text
    if (!jsonText) throw new Error('No JSON returned')
    const parsed = JSON.parse(jsonText)
    return NextResponse.json(parsed)
  } catch (e: unknown) {
    const msg = typeof (e as { message?: unknown })?.message === 'string' ? (e as { message: string }).message : 'Failed to generate'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function clampInt(v: unknown, min: number, max: number): number | undefined {
  const n = Number(v)
  if (!Number.isFinite(n)) return undefined
  return Math.max(min, Math.min(max, Math.floor(n)))
}
