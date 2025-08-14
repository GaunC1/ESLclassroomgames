"use client";
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { TextArea } from '@/components/ui/TextArea'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { SelectionCard } from '@/components/ui/SelectionCard'
import { GameChooser } from '@/components/game/GameChooser'
import { QuestionSetEditor, type MCQuestion } from '@/components/minesweeper/QuestionSetEditor'

type SetupStep = 'select' | 'configure' | 'teams'
type Mode = 'choose' | 'build' | 'generate' | null
type Phase = 'slot' | 'question' | 'grid' | 'nextOverlay' | 'finished'

type Cell = { r: number; c: number; owner: number | -1 } // owner: team index; -1 = bomb

export default function MinesweeperPage() {
  // Setup
  const [setupStep, setSetupStep] = useState<SetupStep>('select')
  const [mode, setMode] = useState<Mode>(null)
  const [isSetup, setIsSetup] = useState(true)

  // Teams
  const [teamInputs, setTeamInputs] = useState<string[]>(Array.from({ length: 8 }, (_, i) => `Team ${i + 1}`)) // up to 16
  const [teams, setTeams] = useState<string[]>([])

  // Questions
  const [questions, setQuestions] = useState<MCQuestion[]>([])
  const [gamesError, setGamesError] = useState<string | null>(null)
  const [selectedSetId, setSelectedSetId] = useState<number | null>(null)
  const [newName, setNewName] = useState<string>('')
  const [newDesc, setNewDesc] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  // AI gen
  const [aiText, setAiText] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiNumQuestions, setAiNumQuestions] = useState<number>(10)
  const [aiChoices, setAiChoices] = useState<number>(4)

  // Gameplay
  const [phase, setPhase] = useState<Phase>('slot')
  const [grid, setGrid] = useState<Cell[][]>([])
  const [rows, setRows] = useState(0)
  const [cols, setCols] = useState(0)
  const [alive, setAlive] = useState<boolean[]>([])
  const [currentPlayer, setCurrentPlayer] = useState<number | null>(null)
  const [pickedBefore, setPickedBefore] = useState<Set<number>>(new Set())
  const [qIndex, setQIndex] = useState(0)
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null)
  const [selectedForQIndex, setSelectedForQIndex] = useState<number | null>(null)
  const [hitCell, setHitCell] = useState<{ r: number; c: number } | null>(null)
  const [mergeTargetOwner, setMergeTargetOwner] = useState<number | null>(null)
  const [nextPlayerAfterMerge, setNextPlayerAfterMerge] = useState<number | null>(null)
  // Slot machine animation state (smooth)
  const [slotProgress, setSlotProgress] = useState<number>(0) // fractional index progress through aliveOrder
  const [slotTarget, setSlotTarget] = useState<number | null>(null)
  const slotAnimFrameRef = useRef<number | null>(null)
  const slotStartTimeRef = useRef<number | null>(null)
  const slotDurationRef = useRef<number>(0)
  const slotStartRef = useRef<number>(0)
  const slotDistanceRef = useRef<number>(0)
  const [slotHolding, setSlotHolding] = useState<boolean>(false)
  const slotHoldTimeoutRef = useRef<number | null>(null)

  // Disable page scrolling during gameplay overlays (not during setup)
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (isSetup) return
    if (phase !== 'grid' && phase !== 'question' && phase !== 'nextOverlay' && phase !== 'slot') return
    const prevHtml = document.documentElement.style.overflow
    const prevBody = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = prevHtml
      document.body.style.overflow = prevBody
    }
  }, [phase, isSetup])

  const palette = useMemo(() => [
    '#C9D6EA','#E7D4E8','#E8E1C9','#D4E7D1','#EAD9C9','#D9EAEA','#E5D9C9','#D1D9E7',
    '#D9E5C9','#E6D4D4','#D4E6E6','#E6E4D4','#D4E6D8','#E6D4E0','#D4D9E6','#E3D6C9'
  ], [])

  function shuffle<T>(arr: T[]): T[] { const a = arr.slice(); for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]] } return a }

  async function loadSet(id: number) {
    try {
      const res = await fetch(`/api/minesweeper/games/${id}`)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      const qs: MCQuestion[] = Array.isArray(data?.questions) ? data.questions.map((q: any) => ({
        prompt: String(q.prompt || ''),
        choices: Array.isArray(q?.choices) ? q.choices.map((c: any) => String(c)) : [],
        correctIndex: Number(q?.correctIndex ?? 0) || 0,
        explanation: q?.explanation ? String(q.explanation) : undefined,
        imageUrl: q?.imageUrl ? String(q.imageUrl) : undefined,
      })) : []
      setQuestions(qs)
    } catch (e) { setGamesError('Could not load selected set') }
  }

  async function saveSet() {
    setSaveMsg(null)
    if (!newName.trim()) { setSaveMsg('Please provide a name.'); return }
    if (!questions.length) { setSaveMsg('Add at least one question.'); return }
    setSaving(true)
    try {
      const payload = { name: newName.trim(), description: newDesc.trim() || null, questions }
      const res = await fetch('/api/minesweeper/games', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to save')
      setSaveMsg('Saved!')
      setSelectedSetId(data.id)
    } catch (e: any) {
      setSaveMsg(e?.message || 'Could not save')
    } finally { setSaving(false) }
  }

  function startGame() {
    const cleanedTeams = teamInputs.map((t) => t.trim()).filter(Boolean).slice(0, 16)
    if (!cleanedTeams.length || !questions.length) return
    setTeams(cleanedTeams)
    setAlive(Array.from({ length: cleanedTeams.length }, () => true))
    // initialize grid
    const { rows, cols, grid } = createInitialGrid(cleanedTeams.length)
    setRows(rows); setCols(cols); setGrid(grid)
    // start flow
    setPickedBefore(new Set())
    setCurrentPlayer(null)
    setQIndex(0)
    setPhase('slot')
    setIsSetup(false)
  }

  // Grid generation: near-square; leftover cells are bombs; ensure each player has a player neighbor orthogonally (where possible)
  function createInitialGrid(nTeams: number): { rows: number; cols: number; grid: Cell[][] } {
    // choose near-square dims
    let best = { rows: 1, cols: nTeams }
    let bestScore = Infinity
    for (let r = 1; r <= Math.ceil(Math.sqrt(nTeams)) + 3; r++) {
      const c = Math.ceil(nTeams / r)
      const cells = r * c
      const score = Math.abs(r - c) + (cells - nTeams) // prefer square-ish and minimal slack
      if (cells >= nTeams && score < bestScore) { best = { rows: r, cols: c }; bestScore = score }
    }
    let positions: { r: number; c: number }[] = []
    // place teams ensuring adjacency pairs
    if (best.cols >= 2) {
      outer: for (let r = 0; r < best.rows; r++) {
        for (let c = 0; c < best.cols; c += 2) {
          if (positions.length >= nTeams) break outer
          positions.push({ r, c })
          if (positions.length >= nTeams) break outer
          if (c + 1 < best.cols) positions.push({ r, c: c + 1 })
        }
      }
    } else {
      for (let r = 0; r < best.rows && positions.length < nTeams; r++) positions.push({ r, c: 0 })
    }
    // build grid
    const grid: Cell[][] = Array.from({ length: best.rows }, (_, r) => (
      Array.from({ length: best.cols }, (_, c) => ({ r, c, owner: -1 as number | -1 }))
    ))
    positions.slice(0, nTeams).forEach((pos, i) => { grid[pos.r][pos.c].owner = i })
    // all leftover cells are bombs
    return { rows: best.rows, cols: best.cols, grid }
  }

  // Weighted random: weight 2 if never picked, else 1
  function pickRandomPlayer() {
    const candidates = teams.map((_, i) => i).filter((i) => alive[i])
    if (!candidates.length) return null
    const weights = candidates.map((i) => (pickedBefore.has(i) ? 1 : 2))
    const total = weights.reduce((a, b) => a + b, 0)
    let r = Math.random() * total
    for (let i = 0; i < candidates.length; i++) { r -= weights[i]; if (r <= 0) return candidates[i] }
    return candidates[candidates.length - 1]
  }

  // Compute shuffled choice order for current question before render to avoid flash
  const choiceOrder = useMemo(() => {
    const q = questions[qIndex % (questions.length || 1)]
    if (!q || !Array.isArray(q.choices)) return []
    const arr = Array.from({ length: q.choices.length }, (_, i) => i)
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }, [qIndex, questions.length])

  // Compute a single label position per contiguous territory (owner-connected component)
  const labelPositions = useMemo(() => {
    const labels = new Set<string>()
    if (!rows || !cols) return labels
    const visited: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false))
    const inBounds = (r: number, c: number) => r >= 0 && r < rows && c >= 0 && c < cols
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (visited[r][c]) continue
        const owner = grid[r]?.[c]?.owner
        if (owner == null || owner < 0) { visited[r][c] = true; continue }
        // BFS collect this territory component
        const queue: [number, number][] = [[r, c]]
        visited[r][c] = true
        const cells: [number, number][] = []
        while (queue.length) {
          const [rr, cc] = queue.shift() as [number, number]
          cells.push([rr, cc])
          const deltas = [[1,0],[-1,0],[0,1],[0,-1]] as const
          for (const [dr, dc] of deltas) {
            const nr = rr + dr, nc = cc + dc
            if (!inBounds(nr, nc) || visited[nr][nc]) continue
            if (grid[nr][nc].owner === owner) {
              visited[nr][nc] = true
              queue.push([nr, nc])
            }
          }
        }
        if (cells.length) {
          // choose a representative cell near the centroid
          let sumR = 0, sumC = 0
          for (const [rr, cc] of cells) { sumR += rr; sumC += cc }
          const ar = sumR / cells.length, ac = sumC / cells.length
          let best: [number, number] = cells[0]
          let bestD = Infinity
          for (const [rr, cc] of cells) {
            const d = (rr - ar) * (rr - ar) + (cc - ac) * (cc - ac)
            if (d < bestD) { bestD = d; best = [rr, cc] }
          }
          labels.add(`${best[0]},${best[1]}`)
        }
      }
    }
    return labels
  }, [grid, rows, cols])

  // Derive alive owners from the grid (source of truth for win condition and header)
  const ownersWithCells = useMemo(() => {
    const s = new Set<number>()
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ow = grid[r]?.[c]?.owner
        if (ow != null && ow >= 0) s.add(ow)
      }
    }
    return s
  }, [grid, rows, cols])

  // Slot machine animation to choose next player (smooth RAF with easing)
  const aliveOrder = useMemo(() => teams.map((_, i) => i).filter((i) => alive[i]), [teams, alive])
  useEffect(() => {
    if (isSetup || phase !== 'slot' || aliveOrder.length === 0) return

    const target = pickRandomPlayer()
    if (target == null) return
    setSlotTarget(target)

    const len = aliveOrder.length
    const start = Math.random() * len
    const targetPos = aliveOrder.indexOf(target)
    const startFloor = Math.floor(start) % len
    const startFrac = start - Math.floor(start)
    const stepsToTarget = (targetPos - startFloor + len) % len
    const cycles = 2 * len // start slower overall (fewer cycles)
    // Ensure final progress lands exactly on target row center (integer + 0.5)
    // We start at start+0.5 and add distance so final = cycles + startFloor + stepsToTarget + 0.5
    const distance = cycles + stepsToTarget - startFrac
    const duration = 3500 // ms, half as long total duration

    // Start centered on a row
    slotStartRef.current = start + 0.5
    slotDistanceRef.current = distance
    slotDurationRef.current = duration
    slotStartTimeRef.current = null

    // Linear deceleration: starts at constant speed and only slows down
    // Integrated form of v(t) = v0 * (1 - t/T) gives progress factor f(u) = 2u - u^2
    function decel(u: number) { return 2 * u - u * u }
    function tick(ts: number) {
      if (slotStartTimeRef.current == null) slotStartTimeRef.current = ts
      const elapsed = ts - (slotStartTimeRef.current ?? 0)
      const u = Math.min(1, elapsed / (slotDurationRef.current || 1))
      const factor = decel(u)
      const progress = (slotStartRef.current || 0) + (slotDistanceRef.current || 0) * factor
      setSlotProgress(progress)
      if (u < 1) {
        slotAnimFrameRef.current = requestAnimationFrame(tick)
      } else {
        // Snap to exact final position and compute landed team from center slot
        const finalProg = (slotStartRef.current || 0) + (slotDistanceRef.current || 0)
        setSlotProgress(finalProg)
        const lenNow = aliveOrder.length || 1
        const centerIndex = ((Math.floor(finalProg) % lenNow) + lenNow) % lenNow
        const landedTeam = aliveOrder[centerIndex]
        setCurrentPlayer(landedTeam)
        setPickedBefore((prev) => new Set(prev).add(landedTeam))
        setSelectedChoice(null)
        setSelectedForQIndex(null)
        setSlotHolding(true)
        // Pause for 1000ms to showcase the chosen team before moving to question
        if (slotHoldTimeoutRef.current) window.clearTimeout(slotHoldTimeoutRef.current)
        slotHoldTimeoutRef.current = window.setTimeout(() => {
          setSlotHolding(false)
          setPhase('question')
        }, 1000)
      }
    }
    slotAnimFrameRef.current = requestAnimationFrame(tick)

    return () => {
      if (slotAnimFrameRef.current != null) cancelAnimationFrame(slotAnimFrameRef.current)
      slotAnimFrameRef.current = null
      if (slotHoldTimeoutRef.current) { window.clearTimeout(slotHoldTimeoutRef.current); slotHoldTimeoutRef.current = null }
    }
  }, [phase, isSetup, aliveOrder.length])

  function answerQuestion(idx: number) {
    const q = questions[qIndex % questions.length]
    const originalIndex = choiceOrder[idx]
    const correct = originalIndex === q.correctIndex
    setSelectedChoice(idx)
    setSelectedForQIndex(qIndex)
    setTimeout(() => {
      if (correct) {
        setPhase('grid')
        setHitCell(null)
        setMergeTargetOwner(null)
      } else {
        // incorrect → random next
        setQIndex((i) => (i + 1) % questions.length)
        setPhase('slot')
      }
    }, 400)
  }

  function onGridCellClick(r: number, c: number) { setHitCell({ r, c }) }

  function ownersAdjacentTo(owner: number): number[] {
    const neigh = new Set<number>()
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (grid[r][c].owner !== owner) continue
      const deltas = [[1,0],[-1,0],[0,1],[0,-1]]
      for (const [dr, dc] of deltas) {
        const rr = r + dr, cc = c + dc
        if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue
        const ow = grid[rr][cc].owner
        if (ow >= 0 && ow !== owner) neigh.add(ow)
      }
    }
    return Array.from(neigh)
  }

  function eligibleNeighborOwners(targetOwner: number): number[] {
    const neighbors = ownersAdjacentTo(targetOwner)
    if (neighbors.length <= 1) return neighbors
    if (currentPlayer == null) return neighbors
    // Omit current player's own team unless it is the only neighbor
    return neighbors.filter((o) => o !== currentPlayer)
  }

  function reassignOwner(from: number, to: number) {
    setGrid((prev) => prev.map((row) => row.map((cell) => (cell.owner === from ? { ...cell, owner: to } : cell))))
  }

  function confirmHit() {
    if (!hitCell || currentPlayer == null) return
    const cell = grid[hitCell.r][hitCell.c]
    if (cell.owner === -1) {
      // bomb: add to current player's territory; lose turn
      setGrid((prev) => prev.map((row, r) => row.map((c, cc) => (r === hitCell.r && cc === hitCell.c ? { ...c, owner: currentPlayer } : c))))
      setQIndex((i) => (i + 1) % questions.length)
      setPhase('slot')
      setHitCell(null)
      return
    }
    const targetOwner = cell.owner
    if (!alive[targetOwner]) { setHitCell(null); return }
    // eliminate target, choose neighbor owner to merge into
    const neighbors = ownersAdjacentTo(targetOwner)
    if (neighbors.length === 0) {
      // fallback: merge into current player
      setMergeTargetOwner(currentPlayer)
      finalizeMerge(targetOwner, currentPlayer)
      return
    }
    const elig = eligibleNeighborOwners(targetOwner)
    if (elig.length === 0) {
      // the only neighbor was current player; auto-merge to self
      setMergeTargetOwner(currentPlayer)
      finalizeMerge(targetOwner, currentPlayer)
      return
    }
    if (elig.length === 1) {
      const recipient = elig[0]
      setMergeTargetOwner(recipient)
      finalizeMerge(targetOwner, recipient)
      return
    }
    // multiple eligible neighbors: wait for user to choose
    setMergeTargetOwner(null)
  }

  function finalizeMerge(fromOwner: number, toOwner: number) {
    // eliminate player
    setAlive((prev) => prev.map((a, i) => (i === fromOwner ? false : a)))
    // reassign entire territory
    reassignOwner(fromOwner, toOwner)
    setNextPlayerAfterMerge(toOwner)
    setTimeout(() => {
      setHitCell(null)
      setPhase('nextOverlay')
    }, 2000)
  }

  function onChooseMergeOwnerByClick(r: number, c: number) {
    if (!hitCell) return
    const cell = grid[r][c]
    if (cell.owner >= 0) {
      const targetOwner = grid[hitCell.r][hitCell.c].owner
      if (targetOwner >= 0 && cell.owner !== targetOwner) {
        const elig = eligibleNeighborOwners(targetOwner)
        if (elig.includes(cell.owner)) finalizeMerge(targetOwner, cell.owner)
      }
    }
  }

  // Setup view
  if (isSetup) {
    return (
      <main className="min-h-screen p-6 sm:p-10 bg-fun">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-sm underline">Home</Link>
            <div className="text-sm text-gray-600">Up to 16 teams</div>
          </div>

          {setupStep === 'select' && (
            <section className="space-y-3">
              <h1 className="text-2xl font-bold">Classroom Minesweeper</h1>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SelectionCard title="Choose Question Set" subtitle="Pick a saved set" onClick={() => { setMode('choose'); setSetupStep('configure'); }} />
                <SelectionCard title="Build Using GUI" subtitle="Create your own questions" onClick={() => { setMode('build'); setSetupStep('configure'); }} />
                <SelectionCard title="Generate Using AI" subtitle="Paste text → MCQs" onClick={() => { setMode('generate'); setSetupStep('configure'); }} />
              </div>
            </section>
          )}

          {setupStep === 'configure' && (
            <section className="space-y-4">
              <SectionHeader title={mode === 'choose' ? 'Choose a question set' : mode === 'build' ? 'Build your question set' : 'Generate a question set'} onBack={() => setSetupStep('select')} />

              {mode === 'choose' && (
                <Card>
                  <GameChooser
                    selectedId={selectedSetId}
                    onSelect={(id) => {
                      if (id == null) { setSelectedSetId(null); setQuestions([]); return }
                      setSelectedSetId(id); loadSet(id)
                    }}
                    onError={setGamesError}
                    onLoaded={() => {}}
                    endpoint="/api/minesweeper/games"
                    onCreateBuild={() => { setMode('build'); setSetupStep('configure') }}
                    onCreateGenerate={() => { setMode('generate'); setSetupStep('configure') }}
                    onEdit={async (id) => {
                      try {
                        const res = await fetch(`/api/minesweeper/games/${id}`)
                        if (!res.ok) throw new Error('Failed to load')
                        const data = await res.json()
                        const qs: MCQuestion[] = Array.isArray(data?.questions) ? data.questions.map((q: any) => ({
                          prompt: String(q.prompt || ''),
                          choices: Array.isArray(q?.choices) ? q.choices.map((c: any) => String(c)) : [],
                          correctIndex: Number(q?.correctIndex ?? 0) || 0,
                          explanation: q?.explanation ? String(q.explanation) : undefined,
                          imageUrl: q?.imageUrl ? String(q.imageUrl) : undefined,
                        })) : []
                        setQuestions(qs)
                        setNewName(data.name || '')
                        setNewDesc(data.description || '')
                        setSelectedSetId(id)
                        setMode('build')
                      } catch (e) {}
                    }}
                  />
                  {gamesError && <div className="text-xs text-rose-600">{gamesError}</div>}
                  <div className="flex justify-end pt-2">
                    <Button variant="primary" disabled={!selectedSetId || !questions.length} onClick={() => setSetupStep('teams')}>Continue</Button>
                  </div>
                </Card>
              )}

              {mode === 'build' && (
                <div className="space-y-4">
                  <QuestionSetEditor questions={questions} onChange={setQuestions} accent="#C2F0C2" />
                  <Card title="Save question set (optional)" accent="#BFD6FF">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Set name" className="flex-1" />
                      <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description (optional)" className="flex-1" />
                      <Button type="button" variant="secondary" onClick={saveSet} disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                      </Button>
                    </div>
                    {saveMsg && <div className="text-xs text-emerald-700">{saveMsg}</div>}
                  </Card>
                  <div className="flex justify-end pt-2">
                    <Button variant="primary" disabled={!questions.length} onClick={() => setSetupStep('teams')}>Continue</Button>
                  </div>
                </div>
              )}

              {mode === 'generate' && (
                <Card title="Generate questions from text (AI)" accent="#E1C2FF">
                  <TextArea value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="Paste a short text here (1–3 paragraphs)" />
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-700">Questions</label>
                      <Input type="number" min={1} max={100} value={aiNumQuestions} onChange={(e) => setAiNumQuestions(Math.max(1, Math.min(100, parseInt(e.target.value || '10', 10))))} className="w-24" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-700">Choices per question</label>
                      <Input type="number" min={2} max={6} value={aiChoices} onChange={(e) => setAiChoices(Math.max(2, Math.min(6, parseInt(e.target.value || '4', 10))))} className="w-24" />
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      disabled={aiBusy || !aiText.trim()}
                      onClick={async () => {
                        try {
                          setAiBusy(true); setAiError(null)
                          const res = await fetch('/api/minesweeper/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: aiText, numQuestions: aiNumQuestions, choicesPerQuestion: aiChoices }) })
                          const data = await res.json()
                          if (!res.ok) throw new Error(data?.error || 'Failed to generate')
                          const qs: MCQuestion[] = (Array.isArray(data?.questions) ? data.questions : []).map((q: any) => ({
                            prompt: String(q.prompt || ''),
                            choices: Array.isArray(q?.choices) ? q.choices.map((c: any) => String(c)) : [],
                            correctIndex: Number(q?.correctIndex ?? 0) || 0,
                            explanation: q?.explanation ? String(q.explanation) : undefined,
                            imageUrl: q?.imageUrl ? String(q.imageUrl) : undefined,
                          }))
                          setQuestions(qs)
                          setMode('build')
                        } catch (e: any) { setAiError(e?.message || 'Could not generate') }
                        finally { setAiBusy(false) }
                      }}
                    >{aiBusy ? 'Generating…' : 'Generate'}</Button>
                    {aiError && <div className="text-xs text-rose-600">{aiError}</div>}
                  </div>
                  {questions.length > 0 && (
                    <div className="mt-3">
                      <div className="text-sm font-medium mb-2">Review & edit generated questions</div>
                      <QuestionSetEditor questions={questions} onChange={setQuestions} />
                      <div className="flex justify-end mt-3"><Button variant="primary" onClick={() => setSetupStep('teams')}>Continue</Button></div>
                    </div>
                  )}
                </Card>
              )}
            </section>
          )}

          {setupStep === 'teams' && (
            <section className="space-y-4">
              <SectionHeader title="Create Teams" onBack={() => setSetupStep('configure')} />
              <p className="text-sm text-gray-600">Add teams for this game. Up to 16.</p>
              <div className="space-y-2">
                {teamInputs.map((name, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-16 text-xs text-gray-600">Team {i + 1}</span>
                    <Input value={name} onChange={(e) => setTeamInputs((prev) => prev.map((t, idx) => (idx === i ? e.target.value : t)))} className="flex-1 px-3 py-2" placeholder={`Team ${i + 1}`} />
                    <Button size="sm" onClick={() => setTeamInputs((prev) => prev.filter((_, idx) => idx !== i))}>Remove</Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={() => setTeamInputs((prev) => (prev.length >= 16 ? prev : [...prev, `Team ${prev.length + 1}`]))} disabled={teamInputs.length >= 16}>Add Team</Button>
                <Button variant="primary" className="ml-auto" onClick={startGame} disabled={teamInputs.every((t) => !t.trim()) || !questions.length}>Play Game</Button>
              </div>
            </section>
          )}
        </div>
      </main>
    )
  }

  // Gameplay view
  const teamColors = teams.map((_, i) => palette[i % palette.length])
  const aliveCount = ownersWithCells.size
  const currentQ = questions[qIndex % questions.length]

  // Minimal header height to maximize grid size
  const HEADER_H = 44

  return (
    <div className="min-h-screen flex flex-col bg-fun">
      <div className="flex items-center justify-between px-3" style={{ height: HEADER_H }}>
        <Link href="/" className="text-xs underline">Home</Link>
        <div className="text-[11px] text-gray-600">{aliveCount} players alive</div>
      </div>
      <div className={(phase === 'grid' || phase === 'question' || phase === 'nextOverlay' || phase === 'slot') ? 'flex-1 overflow-hidden min-h-0 flex flex-col' : 'flex-1 p-4 sm:p-8 space-y-6'}>
        {/* Slot machine / current player */}
        {phase === 'slot' && (
          <div className="text-center text-lg">Selecting next player…</div>
        )}

        {/* Removed separate current-player text; highlight in-grid instead */}

        {/* Question overlay will render inside the grid container to keep continuity */}

        {/* Grid phase */}
        {(phase === 'grid' || phase === 'question' || phase === 'nextOverlay' || phase === 'slot') && (
          <Card className="h-full p-0 flex-1 min-h-0">
            <div className="relative w-full h-full overflow-hidden" style={{ height: `calc(100vh - ${HEADER_H}px)` }}>
              <div
                className="grid w-full h-full"
                style={{
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  gridTemplateRows: `repeat(${rows}, 1fr)`,
                  // Blur only during question and slot phases; keep grid sharp for nextOverlay
                  filter: (phase === 'question' || phase === 'slot') ? 'blur(4px)' : undefined,
                  // Disable pointer events only during question and slot
                  pointerEvents: (phase === 'question' || phase === 'slot') ? 'none' as any : 'auto',
                }}
              >
              {grid.flatMap((row, r) => row.map((cell, c) => {
                const isHit = !!hitCell && hitCell.r === r && hitCell.c === c
                const owner = cell.owner
                const bg = owner === -1 ? 'repeating-linear-gradient(45deg, #eee, #eee 6px, #f7f7f7 6px, #f7f7f7 12px)' : teamColors[owner]
                // Determine side borders: black between different team owners; gray otherwise
                const upOwner = r > 0 ? grid[r-1][c].owner : null
                const leftOwner = c > 0 ? grid[r][c-1].owner : null
                const rightOwner = c + 1 < cols ? grid[r][c+1].owner : null
                const downOwner = r + 1 < rows ? grid[r+1][c].owner : null
                const borderGray = '#e5e7eb'
                const borderBlackOrGray = (a: number | null, b: number) => (a != null && a >= 0 && b >= 0 && a !== b ? '#111111' : borderGray)
                const borderTopColor = borderBlackOrGray(upOwner, owner)
                const borderLeftColor = borderBlackOrGray(leftOwner, owner)
                const borderRightColor = borderBlackOrGray(rightOwner, owner)
                const borderBottomColor = borderBlackOrGray(downOwner, owner)
                // highlight eligible neighbor owners when selecting merge owner
                let highlight = ''
                let showGreenStripes = false
                const isSelecting = !!hitCell && mergeTargetOwner === null
                if (hitCell && owner >= 0) {
                  const targetOwner = grid[hitCell.r][hitCell.c].owner
                  if (targetOwner >= 0 && owner !== targetOwner) {
                    const elig = eligibleNeighborOwners(targetOwner)
                    if (elig.includes(owner)) {
                      highlight = '0 0 0 3px rgba(16,185,129,0.35) inset'
                      showGreenStripes = true
                    }
                  }
                }
                const isCurrentOwner = currentPlayer != null && currentPlayer === owner
                return (
                  <div key={`${r}-${c}`} onClick={() => {
                    if (hitCell && mergeTargetOwner == null) { onChooseMergeOwnerByClick(r, c) } else { onGridCellClick(r, c) }
                  }}
                    className="relative cursor-pointer"
                    style={{
                      background: bg,
                      borderTop: `1px solid ${borderTopColor}`,
                      borderLeft: `1px solid ${borderLeftColor}`,
                      borderRight: `1px solid ${borderRightColor}`,
                      borderBottom: `1px solid ${borderBottomColor}`,
                      outline: isHit ? '2px solid #ef4444' : undefined,
                      boxShadow: highlight,
                    }}
                    title={owner === -1 ? 'Bomb' : teams[owner]}
                  >
                    {/* Red diagonal stripes for the hit cell */}
                    {isHit && (
                      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(239,68,68,0.35) 0 10px, rgba(239,68,68,0.35) 10px 20px)' }} />
                    )}
                    {/* Green diagonal stripes for eligible neighbors when selecting */}
                    {isSelecting && showGreenStripes && (
                      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(16,185,129,0.35) 0 10px, rgba(16,185,129,0.35) 10px 20px)' }} />
                    )}
                    {isCurrentOwner && labelPositions.has(`${r},${c}`) && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="rounded-full border-2 border-emerald-500" style={{ width: '70%', height: '70%' }} />
                      </div>
                    )}
                    {owner >= 0 && labelPositions.has(`${r},${c}`) && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div
                          className={["px-1 text-[10px] sm:text-xs font-semibold truncate max-w-full",
                            currentPlayer === owner ? 'text-emerald-700' : 'text-gray-900'].join(' ')}
                        >
                          {teams[owner]}
                        </div>
                      </div>
                    )}
                  </div>
                )
              }))}
              </div>
              {phase === 'grid' && hitCell && (
                <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded px-3 py-2 shadow">
                  <div className="text-sm">Selected cell: ({hitCell.r + 1},{hitCell.c + 1})</div>
                  <Button variant="secondary" onClick={() => setHitCell(null)}>Change Target</Button>
                  <Button variant="primary" onClick={confirmHit}>Confirm Hit</Button>
                </div>
              )}

              {/* Question overlay content */}
              {phase === 'question' && currentQ && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="absolute inset-0" />
                  <Card className="relative max-w-3xl w-[min(92vw,900px)] m-4">
                    <div className="space-y-3">
                      {currentPlayer != null && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-600">Team to answer:</span>
                          <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full border" style={{ borderColor: teamColors[currentPlayer] }}>
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: teamColors[currentPlayer] }} />
                            <span className="font-medium">{teams[currentPlayer]}</span>
                          </span>
                        </div>
                      )}
                      <div className="text-base">{currentQ.prompt}</div>
                      {currentQ.imageUrl && <img src={currentQ.imageUrl} alt="" className="max-h-48 rounded" />}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {choiceOrder.map((idx, i) => (
                          <button key={`${qIndex}-${idx}`}
                            className={["text-left p-3 rounded border transition", (selectedForQIndex === qIndex && selectedChoice === i) ? (idx === currentQ.correctIndex ? 'bg-green-100 border-green-400' : 'bg-rose-100 border-rose-400') : 'hover:bg-gray-50 border-gray-200'].join(' ')}
                            onClick={() => answerQuestion(i)}
                          >{String.fromCharCode(65 + i)}. {currentQ.choices[idx]}</button>
                        ))}
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* Slot machine overlay: smooth track with linear deceleration */}
              {phase === 'slot' && aliveOrder.length > 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="absolute inset-0" />
                  <Card className="relative max-w-md w-[min(92vw,640px)] m-4">
                    <div className="relative overflow-hidden" style={{ height: 320 }}>
                      {/* Center band */}
                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-10 border-y border-emerald-400/60 pointer-events-none" />
                      {/* Top/bottom gradient fades */}
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/90 to-white/0" />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/90 to-white/0" />
                      {/* Repeated track */}
                      {(() => {
                        const len = aliveOrder.length
                        const REPEAT = 40
                        const rowH = 42
                        const centerY = 160 // 320/2
                        const total = len * REPEAT
                        const seq = Array.from({ length: total }, (_, i) => aliveOrder[i % len])
                        const translateY = centerY - (slotProgress * rowH)
                        return (
                          <div className="absolute inset-0 overflow-hidden">
                            <div className="will-change-transform" style={{ transform: `translateY(${translateY}px)` }}>
                              {seq.map((teamIdx, i) => {
                                const deltaRows = Math.abs(i - slotProgress)
                                const isCenter = deltaRows < 0.5
                                const scale = isCenter ? 1.12 : 1
                                const glow = isCenter ? '0 0 0 3px rgba(16,185,129,0.45)' : undefined
                                const borderColor = isCenter ? '#10b981' : teamColors[teamIdx]
                                const textColor = isCenter ? '#065f46' : undefined
                                return (
                                  <div key={`slot-row-${i}`} className="flex items-center justify-center" style={{ height: rowH }}>
                                    <span
                                      className="inline-flex items-center gap-2 px-2 py-1 rounded-full border bg-white/95 transition"
                                      style={{
                                        borderColor,
                                        boxShadow: glow,
                                        transform: `scale(${scale})`,
                                        color: textColor,
                                      }}
                                    >
                                      <span className="w-2 h-2 rounded-full" style={{ background: borderColor }} />
                                      <span className="truncate max-w-[14rem] sm:max-w-xs font-semibold">{teams[teamIdx]}</span>
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </Card>
                </div>
              )}

              {/* Next player banner at top; grid remains unblurred and visible */}
              {phase === 'nextOverlay' && nextPlayerAfterMerge != null && (
                <div className="absolute inset-x-0 top-2 flex items-center justify-center pointer-events-none">
                  <div className="pointer-events-auto inline-flex items-center gap-3 rounded-full border bg-white/90 px-3 py-2 shadow-sm"
                       style={{ borderColor: teamColors[nextPlayerAfterMerge] }}>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-600">Next player:</span>
                      <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full border"
                            style={{ borderColor: teamColors[nextPlayerAfterMerge] }}>
                        <span className="w-2.5 h-2.5 rounded-full"
                              style={{ background: teamColors[nextPlayerAfterMerge] }} />
                        <span className="font-medium">{teams[nextPlayerAfterMerge]}</span>
                      </span>
                    </div>
                    <Button variant="primary" onClick={() => { setCurrentPlayer(nextPlayerAfterMerge); setQIndex((i) => (i + 1) % questions.length); setPhase('question') }}>Ready</Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Next overlay now handled as an overlay within the grid container */}

        {/* Winner */}
        {aliveCount === 1 && (() => {
          const winnerIdx = Array.from(ownersWithCells.values())[0] ?? 0
          return (
          <Card>
            <div className="text-2xl font-bold text-center">Winner: {teams[winnerIdx]}</div>
            <div className="text-center mt-3">
              <Button variant="secondary" onClick={() => { setIsSetup(true); setSetupStep('select') }}>Return to Menu</Button>
            </div>
          </Card>
          )
        })()}
      </div>
    </div>
  )
}
