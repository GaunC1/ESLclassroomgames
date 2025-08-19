"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SelectionCard } from "@/components/ui/SelectionCard";
import { GameChooser } from "@/components/game/GameChooser";
import { CustomRoundsEditor } from "@/components/game/CustomRoundsEditor";
import type { Round } from "@/types/game";
import { clamp, scoreSentence } from "@/lib/scoring";

// Round type is shared

const DEFAULT_ROUNDS: Round[] = [
  { title: "Round 1 – 6 words", targets: ["ball", "pencil", "red", "blue", "in", "on"] },
  { title: "Round 2 – 7 words", targets: ["book", "chair", "green", "yellow", "under", "next to", "small"] },
  { title: "Round 3 – 8 words", targets: ["dog", "box", "pink", "black", "between", "in front of", "big", "cup"] },
  { title: "Round 4 – 9 words", targets: ["shoe", "bag", "white", "brown", "near", "across from", "happy", "sad", "table"] },
  { title: "Round 5 – 10 words", targets: ["cat", "door", "run", "jump", "over", "beside", "purple", "orange", "lamp", "hat"] },
  { title: "Round 6 – 10 words (more complex mix)", targets: ["car", "tree", "gold", "silver", "around", "underneath", "fast", "slow", "boy", "girl"] },
  { title: "Round 7 – 10 words (trickier nouns & adjectives)", targets: ["dragon", "window", "soft", "hard", "between", "next to", "tall", "short", "door", "chair"] },
  { title: "Round 8 – 10 words (verbs + time phrases)", targets: ["elephant", "box", "sing", "dance", "on top of", "behind", "morning", "night", "green", "red"] },
  { title: "Round 9 – 10 words (abstract + concrete)", targets: ["teacher", "desk", "smart", "funny", "in front of", "near", "book", "pencil", "blue", "yellow"] },
  { title: "Round 10 – 10 words (ultimate challenge)", targets: ["spaceship", "mountain", "giant", "tiny", "across from", "beside", "black", "white", "happy", "sad"] },
];

type Phase = "prompt" | "writing" | "grading" | "summary" | "finished";

// clamp imported from lib

export default function GamePage() {
  // Setup flow
  const [isSetup, setIsSetup] = useState(true);
  type SetupStep = 'select' | 'configure' | 'teams';
  type Mode = 'choose' | 'build' | 'generate' | null;
  const [setupStep, setSetupStep] = useState<SetupStep>('select');
  const [mode, setMode] = useState<Mode>(null);

  // Teams
  const [teamInputs, setTeamInputs] = useState<string[]>(["Team 1", "Team 2"]);

  // Build / edit
  const [customRounds, setCustomRounds] = useState<Round[]>([]);
  const [customError, setCustomError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Rounds + gameplay
  const [rounds, setRounds] = useState<Round[]>(DEFAULT_ROUNDS);
  const [teams, setTeams] = useState<string[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("prompt");

  // Available games from DB (choose mode)
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [newGameName, setNewGameName] = useState<string>("");
  const [newGameDesc, setNewGameDesc] = useState<string>("");
  // AI generation
  const [aiText, setAiText] = useState<string>("");
  const [aiNumRounds, setAiNumRounds] = useState<number>(10);
  const [aiMinTargets, setAiMinTargets] = useState<number>(6);
  const [aiMaxTargets, setAiMaxTargets] = useState<number>(10);
  const [aiBusy, setAiBusy] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Per-team/round
  const [sentences, setSentences] = useState<string[][]>([]); // [team][round]
  // Manually credited targets per team per round
  const [manualCredits, setManualCredits] = useState<string[][][]>([]); // [team][round] -> string[] of targets
  const [penalties, setPenalties] = useState<number[][]>([]); // [team][round]

  // Grading workflow
  const [gradingTeamIndex, setGradingTeamIndex] = useState(0);
  const sentenceRef = useRef<HTMLTextAreaElement>(null);

  // Writing timer
  const [secondsLeft, setSecondsLeft] = useState(60);

  const round = rounds[roundIndex];
  const perRoundMax = useMemo(() => rounds.map((r) => r.targets.length + 1), [rounds]);
  const teamTotalMax = perRoundMax.reduce((a, b) => a + b, 0);

  // scoring imported from lib

  async function startGame() {
    const cleaned = teamInputs
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .slice(0, 10);
    if (cleaned.length === 0) return;

    let resolved = DEFAULT_ROUNDS;
    if (mode === 'build' || mode === 'generate') {
      // Basic validation: at least 1 round and at least 1 target each
      if (!customRounds.length || customRounds.some((r) => !r.targets || r.targets.length === 0)) {
        setCustomError("Please add at least one round and one target word per round.");
        return;
      }
      resolved = customRounds.map((r, i) => ({
        title: r.title?.trim() ? r.title : `Round ${i + 1}`,
        targets: r.targets.map((t) => String(t).trim()).filter(Boolean),
      }));
      setCustomError(null);
    } else if (mode === 'choose' && selectedGameId) {
      try {
        const res = await fetch(`/api/games/${selectedGameId}`);
        if (!res.ok) throw new Error('Failed to load game');
        const data = await res.json();
        const mapped: Round[] = Array.isArray((data as { rounds?: unknown })?.rounds)
          ? ((data as { rounds: unknown[] }).rounds).map((r, i: number) => {
              const obj = (r ?? {}) as Record<string, unknown>
              const title = typeof obj.title === 'string' && obj.title.trim() ? obj.title : `Round ${i + 1}`
              const targets = Array.isArray(obj.targets) ? (obj.targets as unknown[]).map((t) => String(t)) : []
              return { title, targets }
            })
          : [];
        if (mapped.length) {
          resolved = mapped;
        }
      } catch {
        setGamesError('Could not load selected game. Falling back to default rounds.');
      }
    }

    setTeams(cleaned);
    setRounds(resolved);
    setSentences(Array.from({ length: cleaned.length }, () => Array.from({ length: resolved.length }, () => "")));
    setPenalties(Array.from({ length: cleaned.length }, () => Array.from({ length: resolved.length }, () => 0)));
    setManualCredits(Array.from({ length: cleaned.length }, () => Array.from({ length: resolved.length }, () => [])));
    setRoundIndex(0);
    setPhase("prompt");
    setIsSetup(false);
  }

  async function saveCustomGame() {
    setSaveMsg(null);
    setCustomError(null);
    if (!newGameName.trim()) {
      setCustomError('Please provide a game name.');
      return;
    }
    if (!customRounds.length || customRounds.some((r) => !r.targets || r.targets.length === 0)) {
      setCustomError('Add at least one round and one target per round.');
      return;
    }
    const payload = {
      name: newGameName.trim(),
      description: newGameDesc.trim() || null,
      kind: 'SENTENCE' as const,
      rounds: customRounds.map((r, i) => ({
        title: r.title?.trim() ? r.title : `Round ${i + 1}`,
        targets: r.targets.map((t) => String(t).trim()).filter(Boolean),
      })),
    };
    setSaving(true);
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to save');
      setSaveMsg('Saved!');
      setSelectedGameId(data.id);
      // Optionally refresh list in chooser (handled by GameChooser on next open)
      try { await fetch('/api/games') } catch {}
      } catch (e: unknown) {
      const msg = typeof (e as { message?: unknown })?.message === 'string' ? (e as { message: string }).message : 'Could not save game'
      setCustomError(msg);
      } finally {
        setSaving(false);
      }
  }

  // Derived totals
  // Compute score with manual credits merged with automatic detection
  const finalScore = useCallback((ti: number, ri: number) => {
    const s = sentences[ti]?.[ri] ?? "";
    const targets = rounds[ri].targets;
    const auto = scoreSentence(s, targets);
    const manual = new Set(manualCredits[ti]?.[ri] ?? []);
    const unionUsed = new Set<string>([...auto.used, ...manual]);
    const base = unionUsed.size;
    const bonus = unionUsed.size === targets.length ? 1 : 0;
    const pen = penalties[ti]?.[ri] ?? 0;
    return clamp(base + bonus - pen, 0);
  }, [sentences, rounds, penalties, manualCredits]);
  const perTeamTotals = useMemo(
    () => teams.map((_, ti) => rounds.reduce((sum, _r, ri) => sum + finalScore(ti, ri), 0)),
    [teams, rounds, finalScore]
  );

  // Timer effect
  useEffect(() => {
    if (phase !== "writing") return;
    setSecondsLeft(60);
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          setPhase("grading");
          setGradingTeamIndex(0);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Focus sentence input during grading
  useEffect(() => {
    if (phase === "grading") {
      sentenceRef.current?.focus();
      sentenceRef.current?.select();
    }
  }, [phase, gradingTeamIndex]);

  function setPenaltyForCurrentTeam(val: number) {
    setPenalties((prev) => {
      const next = prev.map((row) => [...row]);
      const current = next[gradingTeamIndex][roundIndex] ?? 0;
      next[gradingTeamIndex][roundIndex] = current === val ? 0 : clamp(val, 0, 3);
      return next;
    });
  }

  function nextTeamOrSummary() {
    if (gradingTeamIndex < teams.length - 1) setGradingTeamIndex((i) => i + 1);
    else setPhase("summary");
  }
  function prevTeam() {
    if (gradingTeamIndex > 0) setGradingTeamIndex((i) => i - 1);
  }
  function goToNextRound() {
    if (roundIndex < rounds.length - 1) {
      setRoundIndex((i) => i + 1);
      setPhase("prompt");
    } else setPhase("finished");
  }

  // Setup view (multi-step)
  if (isSetup) {
    return (
      <main className="min-h-screen p-6 sm:p-10 bg-fun">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-sm underline">Home</Link>
            <div className="text-sm text-gray-600">Up to 10 teams</div>
          </div>

          {setupStep === 'select' && (
            <section className="space-y-3">
              <h1 className="text-2xl font-bold">Choose how to start</h1>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SelectionCard title="Choose Game" subtitle="Pick from your saved games" onClick={() => { setMode('choose'); setSetupStep('configure'); }} />
                <SelectionCard title="Build New Game" subtitle="Create rounds and targets" onClick={() => { setMode('build'); setSetupStep('configure'); }} />
                <SelectionCard title="Generate Game" subtitle="Use AI to suggest rounds" onClick={() => { setMode('generate'); setSetupStep('configure'); }} />
              </div>
            </section>
          )}

          {setupStep === 'configure' && (
            <section className="space-y-4">
              <SectionHeader title={mode === 'choose' ? 'Choose a game' : mode === 'build' ? 'Build your game' : 'Generate a game'} onBack={() => setSetupStep('select')} />

              {mode === 'choose' && (
                <Card>
                  <GameChooser
                    selectedId={selectedGameId}
                    onSelect={setSelectedGameId}
                    onError={setGamesError}
                    onLoaded={(list) => {
                      if (list.length && selectedGameId == null) setSelectedGameId(list[0].id);
                    }}
                    kind="SENTENCE"
                    onCreateBuild={() => { setMode('build'); setSetupStep('configure'); }}
                    onCreateGenerate={() => { setMode('generate'); setSetupStep('configure'); }}
                    onEdit={async (id) => {
                      try {
                        const res = await fetch(`/api/games/${id}`)
                        if (!res.ok) throw new Error('Failed to load')
                        const data = await res.json()
                        const rounds: Round[] = Array.isArray((data as { rounds?: unknown })?.rounds)
                          ? ((data as { rounds: unknown[] }).rounds).map((r, i: number) => {
                              const obj = (r ?? {}) as Record<string, unknown>
                              const title = typeof obj.title === 'string' && obj.title.trim() ? obj.title : `Round ${i + 1}`
                              const targets = Array.isArray(obj.targets) ? (obj.targets as unknown[]).map((t) => String(t)) : []
                              return { title, targets }
                            })
                          : []
                        setCustomRounds(rounds)
                        setNewGameName(data.name || '')
                        setNewGameDesc(data.description || '')
                        setSelectedGameId(id)
                        setMode('build')
                      } catch {}
                    }}
                  />
                  {gamesError && <div className="text-xs text-rose-600">{gamesError}</div>}
                  <div className="flex justify-end pt-2">
                    <Button variant="primary" disabled={!selectedGameId} onClick={() => setSetupStep('teams')}>Continue</Button>
                  </div>
                </Card>
              )}

              {mode === 'build' && (
                <div className="space-y-4">
                  <CustomRoundsEditor rounds={customRounds.length ? customRounds : DEFAULT_ROUNDS.slice(0,3)} onChange={setCustomRounds} />
                  <Card title="Save custom game (optional)" accent="#BFD6FF">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input value={newGameName} onChange={(e) => setNewGameName(e.target.value)} placeholder="Game name" className="flex-1" />
                      <Input value={newGameDesc} onChange={(e) => setNewGameDesc(e.target.value)} placeholder="Description (optional)" className="flex-1" />
                      <Button type="button" variant="secondary" onClick={saveCustomGame} disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                      </Button>
                    </div>
                    {saveMsg && <div className="text-xs text-emerald-700">{saveMsg}</div>}
                    {customError && <div className="text-xs text-rose-600">{customError}</div>}
                  </Card>
                  <div className="flex justify-end pt-2">
                    <Button variant="primary" onClick={() => setSetupStep('teams')}>Continue</Button>
                  </div>
                </div>
              )}

              {mode === 'generate' && (
                <Card title="Generate rounds from text (AI)">
                  <TextArea value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="Paste a short text here (1–3 paragraphs)" />
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <label className="inline-flex items-center gap-1">Rounds
                      <Input type="number" min={1} max={15} value={aiNumRounds} onChange={(e) => setAiNumRounds(parseInt(e.target.value || '10', 10))} className="w-16" />
                    </label>
                    <label className="inline-flex items-center gap-1">Min number of words
                      <Input type="number" min={1} max={10} value={aiMinTargets} onChange={(e) => setAiMinTargets(parseInt(e.target.value || '6', 10))} className="w-16" />
                    </label>
                    <label className="inline-flex items-center gap-1">Max number of words
                      <Input type="number" min={aiMinTargets} max={12} value={aiMaxTargets} onChange={(e) => setAiMaxTargets(parseInt(e.target.value || '10', 10))} className="w-16" />
                    </label>
                    <Button type="button" variant="primary" className="ml-auto" disabled={aiBusy || !aiText.trim()} onClick={async () => {
                        try {
                          setAiBusy(true);
                          setAiError(null);
                          const res = await fetch('/api/ai/generate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              text: aiText,
                              config: {
                                NUM_ROUNDS: aiNumRounds,
                                MIN_TARGETS_PER_ROUND: aiMinTargets,
                                MAX_TARGETS_PER_ROUND: aiMaxTargets,
                              },
                              name: newGameName || undefined,
                              description: newGameDesc || undefined,
                            }),
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data?.error || 'Failed to generate');
                          const rounds: Round[] = Array.isArray((data as { rounds?: unknown })?.rounds)
                            ? ((data as { rounds: unknown[] }).rounds).map((r) => {
                                const obj = (r ?? {}) as Record<string, unknown>
                                const title = typeof obj.title === 'string' ? obj.title : ''
                                const targets = Array.isArray(obj.targets) ? (obj.targets as unknown[]).map((t) => String(t)) : []
                                return { title, targets }
                              })
                            : []
                          if (!rounds.length) throw new Error('No rounds returned');
                          // Move to editor with generated rounds
                          setMode('build');
                          setCustomRounds(rounds);
                          if (typeof data?.name === 'string' && !newGameName) setNewGameName(data.name);
                          if (typeof data?.description === 'string' && !newGameDesc) setNewGameDesc(data.description);
                        } catch (e: unknown) {
                          const msg = typeof (e as { message?: unknown })?.message === 'string' ? (e as { message: string }).message : 'Could not generate'
                          setAiError(msg);
                        } finally {
                          setAiBusy(false);
                        }
                      }}>{aiBusy ? 'Generating…' : 'Generate'}</Button>
                  </div>
                  {aiError && <div className="text-xs text-rose-600">{aiError}</div>}
                  {customRounds.length > 0 && (
                    <div className="mt-3">
                      <div className="text-sm font-medium mb-2">Review & edit generated rounds</div>
                      <CustomRoundsEditor rounds={customRounds} onChange={setCustomRounds} />
                      <div className="flex justify-end mt-3">
                        <Button variant="primary" onClick={() => setSetupStep('teams')}>Continue</Button>
                      </div>
                    </div>
                  )}
                </Card>
              )}
            </section>
          )}

          {setupStep === 'teams' && (
            <section className="space-y-4">
              <SectionHeader title="Create Teams" onBack={() => setSetupStep('configure')} />

              <p className="text-sm text-gray-600">Add teams for this game.</p>
              <div className="space-y-2">
                {teamInputs.map((name, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-16 text-xs text-gray-600">Team {i + 1}</span>
                    <Input
                      value={name}
                      onChange={(e) => {
                        const v = e.target.value;
                        setTeamInputs((prev) => prev.map((t, idx) => (idx === i ? v : t)));
                      }}
                      className="flex-1 px-3 py-2"
                      placeholder={`Team ${i + 1}`}
                    />
                    <Button size="sm" onClick={() => setTeamInputs((prev) => prev.filter((_, idx) => idx !== i))} aria-label={`Remove Team ${i + 1}`}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={() => setTeamInputs((prev) => (prev.length >= 10 ? prev : [...prev, `Team ${prev.length + 1}`]))} disabled={teamInputs.length >= 10}>
                  Add Team
                </Button>
                <Button variant="primary" className="ml-auto" onClick={startGame} disabled={teamInputs.every((t) => !t.trim())}>
                  Start Game
                </Button>
              </div>
            </section>
          )}
        </div>
      </main>
    );
  }

  // Game views
  return (
    <div className="min-h-screen flex flex-col bg-fun">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <Link href="/" className="text-sm underline">Home</Link>
        <div className="text-sm text-gray-600">Round {roundIndex + 1} / {rounds.length}</div>
      </div>

      {/* Main area */}
      <div className="flex-1 pb-24 px-4 sm:px-8 flex items-center justify-center">
        {phase === "prompt" && round && (
          <div className="w-full max-w-5xl text-center space-y-6">
            <h1 className="text-2xl sm:text-3xl font-bold">{round.title}</h1>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {round.targets.map((t, i) => {
                const palette = [
                  "bg-pink-100 text-pink-900 border-pink-200",
                  "bg-sky-100 text-sky-900 border-sky-200",
                  "bg-amber-100 text-amber-900 border-amber-200",
                  "bg-lime-100 text-lime-900 border-lime-200",
                  "bg-violet-100 text-violet-900 border-violet-200",
                  "bg-rose-100 text-rose-900 border-rose-200",
                ];
                const clr = palette[i % palette.length];
                return (
                  <div key={i} className={`text-xl sm:text-2xl md:text-3xl font-semibold border bubble-tile py-4 sm:py-6 ${clr}`}>
                    {t}
                  </div>
                );
              })}
            </div>
            <div className="text-sm text-gray-600">Max score this round: {perRoundMax[roundIndex]}</div>
            <button onClick={() => setPhase("writing")} className="mt-2 inline-flex items-center justify-center btn-fun-primary px-6 py-3 text-base">
              Start — 1 minute to write
            </button>
          </div>
        )}

        {phase === "writing" && round && (
          <div className="w-full max-w-5xl text-center space-y-8">
            <h1 className="text-2xl sm:text-3xl font-bold">{round.title}</h1>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {round.targets.map((t, i) => {
                const palette = [
                  "bg-pink-100 text-pink-900 border-pink-200",
                  "bg-sky-100 text-sky-900 border-sky-200",
                  "bg-amber-100 text-amber-900 border-amber-200",
                  "bg-lime-100 text-lime-900 border-lime-200",
                  "bg-violet-100 text-violet-900 border-violet-200",
                  "bg-rose-100 text-rose-900 border-rose-200",
                ];
                const clr = palette[i % palette.length];
                return (
                  <div key={i} className={`text-xl sm:text-2xl md:text-3xl font-semibold border bubble-tile py-4 sm:py-6 ${clr}`}>
                    {t}
                  </div>
                );
              })}
            </div>
            <div className="text-6xl font-extrabold tracking-tight animate-pulse-big">⏳ {Math.floor(secondsLeft / 60)}:{`${secondsLeft % 60}`.padStart(2, "0")}</div>
            <div className="text-sm text-gray-600">Time remaining</div>
            <div>
              <button
                onClick={() => {
                  setPhase("grading");
                  setGradingTeamIndex(0);
                }}
                className="inline-flex items-center justify-center btn-fun-secondary px-4 py-2 text-sm"
              >
                Skip — everyone finished
              </button>
            </div>
          </div>
        )}

        {phase === "grading" && round && (
          <div className="w-full max-w-3xl">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Grade — {round.title}</h2>
            </div>
            <div className="rounded-lg border p-4 sm:p-6 space-y-4 bg-white/70">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">{teams[gradingTeamIndex]}</div>
                <div className="text-sm text-gray-600">Max {perRoundMax[roundIndex]} pts</div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="sentence">Sentence</label>
                <textarea
                  id="sentence"
                  ref={sentenceRef}
                  value={sentences[gradingTeamIndex]?.[roundIndex] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSentences((prev) => {
                      const next = prev.map((row) => [...row]);
                      next[gradingTeamIndex][roundIndex] = v;
                      return next;
                    });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      nextTeamOrSummary();
                    }
                  }}
                  className="w-full min-h-[110px] rounded border p-3 text-sm"
                  placeholder="Type the team's sentence here... (Press Cmd/Ctrl+Enter to save & next)"
                />
              </div>

              {(() => {
                const s = sentences[gradingTeamIndex]?.[roundIndex] ?? "";
                const res = scoreSentence(s, round.targets);
                const manual = new Set(manualCredits[gradingTeamIndex]?.[roundIndex] ?? []);
                const unionUsed = new Set<string>([...res.used, ...manual]);
                const base = unionUsed.size;
                const bonus = base === round.targets.length ? 1 : 0;
                const onToggleManual = (t: string) => {
                  if (res.used.includes(t)) return; // already auto-counted; no need to toggle
                  setManualCredits((prev) => {
                    const next = prev.map((row) => row.map((arr) => [...arr]));
                    const list = new Set(next[gradingTeamIndex][roundIndex] ?? []);
                    if (list.has(t)) list.delete(t); else list.add(t);
                    next[gradingTeamIndex][roundIndex] = Array.from(list);
                    return next;
                  });
                };
                return (
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Target Words/Phrases</div>
                    <div className="flex flex-wrap gap-2">
                      {round.targets.map((t) => {
                        const autoUsed = res.used.includes(t);
                        const manUsed = manual.has(t);
                        const used = autoUsed || manUsed;
                        return (
                          <button
                            type="button"
                            key={t}
                            onClick={() => onToggleManual(t)}
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded chip text-xs border ${
                              used ? "chip-used" : "hover:bg-gray-50"
                            } ${autoUsed ? "cursor-default" : "cursor-pointer"}`}
                            title={autoUsed ? "Counted automatically" : (manUsed ? "Click to remove manual credit" : "Click to add manual credit")}
                          >
                            {autoUsed ? "✅" : manUsed ? "☑️" : "⭕️"} {t}
                            {used && <span className="text-[10px] ml-1">+1</span>}
                          </button>
                        );
                      })}
                    </div>
                    <div className="text-sm text-gray-700">
                      Base: <span className="font-medium">{base + bonus}</span>{bonus ? " (includes +1 bonus)" : ""}
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center gap-2">
                <div className="ml-0 flex items-center gap-2">
                  <span className="text-sm">Grammar:</span>
                  {[1, 2, 3].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPenaltyForCurrentTeam(p)}
                      className={`px-3 py-1.5 rounded border text-sm ${
                        (penalties[gradingTeamIndex]?.[roundIndex] ?? 0) === p
                          ? "text-white " + (p === 1 ? "bg-rose-500 border-rose-500" : p === 2 ? "bg-amber-500 border-amber-500" : "bg-violet-500 border-violet-500")
                          : (p === 1 ? "border-rose-300 hover:bg-rose-50" : p === 2 ? "border-amber-300 hover:bg-amber-50" : "border-violet-300 hover:bg-violet-50")
                      }`}
                      title={`Deduct ${p}`}
                    >
                      -{p}
                    </button>
                  ))}
                  <button onClick={() => setPenaltyForCurrentTeam(0)} className="px-3 py-1.5 rounded border text-sm hover:bg-gray-50" title="Clear deduction">
                    Clear
                  </button>
                </div>
              </div>

              <div className="text-sm text-gray-700">
                Final this round: <span className="font-semibold">{finalScore(gradingTeamIndex, roundIndex)}</span>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button onClick={prevTeam} disabled={gradingTeamIndex === 0} className="px-3 py-2 btn-fun-secondary text-sm disabled:opacity-50">
                  Prev team
                </button>
                <button onClick={nextTeamOrSummary} className="px-4 py-2 btn-fun-primary text-sm">
                  Enter
                </button>
              </div>
            </div>
          </div>
        )}

        {phase === "summary" && (
          <div className="w-full max-w-4xl space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Round {roundIndex + 1} Results</h2>
              <div className="text-sm text-gray-600">Max: {perRoundMax[roundIndex]} pts</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {teams.map((t, ti) => (
                <div key={t + ti} className="rounded-lg border p-4 bubble-tile bg-white">
                  <div className="font-medium text-lg">🏅 {t}</div>
                  <div className="text-sm">This round: {finalScore(ti, roundIndex)}</div>
                  <div className="text-sm text-gray-600">Total: {perTeamTotals[ti]} / {teamTotalMax}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end">
              <button onClick={goToNextRound} className="px-4 py-2 btn-fun-primary text-sm">
                {roundIndex < rounds.length - 1 ? "Next Round" : "Finish Game"}
              </button>
            </div>
          </div>
        )}

        {phase === "finished" && (
          <div className="w-full max-w-3xl text-center space-y-6">
            <h2 className="text-2xl font-semibold">Game Complete</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              {teams.map((t, ti) => (
                <div key={t + ti} className="rounded-lg border p-4 bubble-tile bg-white">
                  <div className="font-medium text-lg">🎉 {t}</div>
                  <div className="text-sm">Total: {perTeamTotals[ti]} / {teamTotalMax}</div>
                </div>
              ))}
            </div>
            <div className="text-sm text-gray-600">Refresh the page to start over.</div>
          </div>
        )}
      </div>

      {/* Bottom scoreboard bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-white/90 backdrop-blur bar-fun px-3 sm:px-6 py-2">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="text-xs sm:text-sm text-gray-700">Round {roundIndex + 1} / {rounds.length}</div>
          <div className="flex-1 flex flex-wrap items-center gap-2 justify-center">
            {teams.map((t, i) => (
              <div key={t + i} className="px-2 py-1 rounded-full border bg-white/80 shadow-sm" aria-label={`Team ${t} total ${perTeamTotals[i]} points`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-extrabold tracking-tight">{t}</span>
                  <span className="inline-flex items-center justify-center min-w-8 px-2 py-0.5 rounded-full bg-black text-white text-[10px] sm:text-xs font-bold">
                    {perTeamTotals[i]}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="text-xs sm:text-sm text-gray-700">Max total: {teamTotalMax}</div>
        </div>
      </div>
    </div>
  );
}

// moved GameChooser and CustomRoundsEditor to shared components
