"use client";
import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { TextArea } from '@/components/ui/TextArea'

export type MCQuestion = {
  prompt: string
  choices: string[]
  correctIndex: number
  explanation?: string
  imageUrl?: string
}

export function QuestionSetEditor({ questions, onChange, accent = '#C2F0C2' }: { questions: MCQuestion[]; onChange: (q: MCQuestion[]) => void; accent?: string }) {
  const [newQPrompt, setNewQPrompt] = useState('')
  const [newChoiceCount, setNewChoiceCount] = useState(4)

  function addQuestion() {
    const prompt = newQPrompt.trim()
    const n = Math.max(2, Math.min(6, Number(newChoiceCount) || 4))
    if (!prompt) return
    const base: MCQuestion = { prompt, choices: Array.from({ length: n }, (_, i) => (i === 0 ? 'Correct answer' : `Choice ${i + 1}`)), correctIndex: 0 }
    onChange([...(questions || []), base])
    setNewQPrompt('')
  }

  function updateQuestion(i: number, patch: Partial<MCQuestion>) {
    onChange(questions.map((q, idx) => (idx === i ? { ...q, ...patch } : q)))
  }

  function removeQuestion(i: number) {
    onChange(questions.filter((_, idx) => idx !== i))
  }

  return (
    <Card title="Questions" accent={accent}>
      <div className="space-y-3">
        {/* builder */}
        <div className="flex flex-col sm:flex-row gap-2 items-start">
          <Input value={newQPrompt} onChange={(e) => setNewQPrompt(e.target.value)} placeholder="Question prompt" className="flex-1" />
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-700">Choices</label>
            <Input type="number" min={2} max={6} value={newChoiceCount} onChange={(e) => setNewChoiceCount(parseInt(e.target.value || '4', 10))} className="w-20" />
          </div>
          <Button onClick={addQuestion} disabled={!newQPrompt.trim()}>Add</Button>
        </div>

        {/* list */}
        {(questions || []).length === 0 && (
          <div className="text-xs text-gray-600">No questions yet. Add one above.</div>
        )}

        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={i} className="border rounded p-3">
              <div className="flex items-start gap-2">
                <div className="text-xs text-gray-500 w-6">Q{i + 1}</div>
                <div className="flex-1 space-y-2">
                  <Input value={q.prompt} onChange={(e) => updateQuestion(i, { prompt: e.target.value })} placeholder="Prompt" />
                  <div className="space-y-2">
                    {q.choices.map((c, ci) => (
                      <div key={ci} className="flex items-center gap-2">
                        <input type="radio" name={`correct-${i}`} checked={q.correctIndex === ci} onChange={() => updateQuestion(i, { correctIndex: ci })} />
                        <Input
                          value={c}
                          onChange={(e) => {
                            const next = q.choices.slice()
                            next[ci] = e.target.value
                            updateQuestion(i, { choices: next })
                          }}
                          className="flex-1"
                        />
                        <Button size="sm" onClick={() => {
                          const next = q.choices.filter((_, idx) => idx !== ci)
                          const newIdx = q.correctIndex === ci ? 0 : q.correctIndex > ci ? q.correctIndex - 1 : q.correctIndex
                          updateQuestion(i, { choices: next, correctIndex: Math.max(0, Math.min(newIdx, next.length - 1)) })
                        }} disabled={q.choices.length <= 2}>Del</Button>
                      </div>
                    ))}
                    <div>
                      <Button size="sm" onClick={() => updateQuestion(i, { choices: [...q.choices, `Choice ${q.choices.length + 1}`] })} disabled={q.choices.length >= 6}>Add Choice</Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input value={q.imageUrl || ''} onChange={(e) => updateQuestion(i, { imageUrl: e.target.value || undefined })} placeholder="Image URL (optional)" />
                    <TextArea value={q.explanation || ''} onChange={(e) => updateQuestion(i, { explanation: e.target.value || undefined })} placeholder="Explanation (optional)" />
                  </div>
                </div>
                <Button size="sm" onClick={() => removeQuestion(i)}>Remove</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

