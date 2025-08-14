import OpenAI from 'openai'
import type { GeneratedGame } from '@/types/game'

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-5-nano'

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

export type GenerationConfig = {
  NUM_ROUNDS?: number
  MIN_TARGETS_PER_ROUND?: number
  MAX_TARGETS_PER_ROUND?: number
}

export async function generateGameFromText(options: {
  apiKey: string
  model?: string
  template: string
  text: string
  config?: GenerationConfig
  name?: string
  description?: string
}): Promise<GeneratedGame> {
  const { apiKey, model = DEFAULT_MODEL, text, template, config = {}, name, description } = options
  const openai = new OpenAI({ apiKey })

  const userSection = [
    '--- BEGIN TEXT ---',
    text.trim(),
    '--- END TEXT ---',
    '',
    '--- BEGIN CONFIG ---',
    ...(config.NUM_ROUNDS ? [`NUM_ROUNDS=${config.NUM_ROUNDS}`] : []),
    ...(config.MIN_TARGETS_PER_ROUND ? [`MIN_TARGETS_PER_ROUND=${config.MIN_TARGETS_PER_ROUND}`] : []),
    ...(config.MAX_TARGETS_PER_ROUND ? [`MAX_TARGETS_PER_ROUND=${config.MAX_TARGETS_PER_ROUND}`] : []),
    '--- END CONFIG ---',
  ].join('\n')

  const nameDescHint = name || description
    ? `Use this name/description if present:\nNAME=${name ?? ''}\nDESCRIPTION=${description ?? ''}`
    : ''

  const resp: unknown = await openai.responses.create({
    model,
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
        schema: jsonSchema as unknown,
      },
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
  if (!parsed || !Array.isArray(parsed.rounds)) throw new Error('Invalid JSON shape from model')
  return parsed as GeneratedGame
}
