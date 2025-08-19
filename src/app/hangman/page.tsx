"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SelectionCard } from "@/components/ui/SelectionCard";
import { GameChooser } from "@/components/game/GameChooser";
import { WordListEditor } from "@/components/game/WordListEditor";
import { RandomPlayerChooser } from "@/components/game/RandomPlayerChooser";

type SetupStep = 'select' | 'configure' | 'teams';
type Mode = 'choose' | 'build' | 'generate' | null;

export default function HangmanPage() {
  // Setup
  const [setupStep, setSetupStep] = useState<SetupStep>('select');
  const [mode, setMode] = useState<Mode>(null);
  const [isSetup, setIsSetup] = useState(true);

  // Teams
  const [teamInputs, setTeamInputs] = useState<string[]>(["Team 1", "Team 2"]);
  const [teams, setTeams] = useState<string[]>([]);

  // Words
  const [words, setWords] = useState<string[]>([]);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [newGameName, setNewGameName] = useState<string>("");
  const [newGameDesc, setNewGameDesc] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [aiText, setAiText] = useState<string>("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiWordCount, setAiWordCount] = useState<number>(12);

  // Gameplay
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [guessed, setGuessed] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<Set<string>>(new Set());
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [roundPoints, setRoundPoints] = useState<number[]>([]);
  // unified gallows state: wrong parts with team attribution
  type Part = { teamId: number; color: string };
  const [parts, setParts] = useState<Part[]>([]);
  const [maxParts] = useState<number>(6);
  // Penalty sequence state when round is lost (full gallows)
  const [penaltyActive, setPenaltyActive] = useState<boolean>(false);
  const [penaltyIndex, setPenaltyIndex] = useState<number | null>(null);
  const penaltyStartedRef = useRef<boolean>(false);
  // Turn timer (10s per turn)
  const [turnEndsAt, setTurnEndsAt] = useState<number | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState<number>(0);
  const [timerEnabled, setTimerEnabled] = useState<boolean>(true);
  const [timerDurationSec, setTimerDurationSec] = useState<number>(10);
  // After penalties complete, wait for manual Next Word and reveal the word in red
  const [awaitingNextAfterPenalty, setAwaitingNextAfterPenalty] = useState<boolean>(false);
  const [guessFeedback, setGuessFeedback] = useState<null | 'wrong'>(null);
  const [remaining, setRemaining] = useState<number[]>([]);
  // derive current word number from remaining
  const [finished, setFinished] = useState<boolean>(false);
  // Random chooser state
  const [choosingTurn, setChoosingTurn] = useState<boolean>(false);
  // Track how many times each team has answered across the entire game
  const [answerCounts, setAnswerCounts] = useState<number[]>([]);

  const alphabet = useMemo(() => "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("") as string[], []);
  const currentWord = (words[currentIndex] || "").toUpperCase();
  // display handled via WordSlots component for better layout (letters above lines)
  const solved = currentWord && currentWord.split("").every((ch) => !alphabet.includes(ch) || guessed.has(ch));
  const accents = ['#FFB3D1', '#BFD6FF', '#FFE29A', '#C2F0C2', '#E1C2FF', '#FFC9A3'];

  function shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function startGame() {
    const cleanedTeams = teamInputs.map((t) => t.trim()).filter(Boolean).slice(0, 10);
    if (!cleanedTeams.length) return;
    if (!words.length) return;
    setTeams(cleanedTeams);
    setScores(Array.from({ length: cleanedTeams.length }, () => 0));
    // create word order
    const order = shuffle(Array.from({ length: words.length }, (_, i) => i));
    const [first, ...rest] = order;
    setRemaining(rest);
    setCurrentIndex(first ?? 0);
    // initialize first round state (starting team chosen randomly via chooser)
    setGuessed(new Set());
    setWrong(new Set());
    setRoundPoints(Array.from({ length: cleanedTeams.length }, () => 0));
    setParts([]);
    setFinished(false);
    setAnswerCounts(Array.from({ length: cleanedTeams.length }, () => 0));
    setIsSetup(false);
    setChoosingTurn(true);
    penaltyStartedRef.current = false;
    setTurnEndsAt(null);
    setTimeLeftMs(0);
    // keep user timer preferences (timerEnabled, timerDurationSec)
    setAwaitingNextAfterPenalty(false);
  }

  function startNewRound(teamCount = teams.length) {
    setGuessed(new Set());
    setWrong(new Set());
    setRoundPoints(Array.from({ length: teamCount }, () => 0));
    setParts([]);
    setRemaining((prev) => {
      if (!prev.length) {
        setFinished(true);
        return [];
      }
      const [next, ...rest] = prev;
      setCurrentIndex(next);
      return rest;
    });
    // keep answerCounts across rounds; weighted chooser favors teams with fewer answers overall
    setChoosingTurn(true);
    penaltyStartedRef.current = false;
    setTurnEndsAt(null);
    setTimeLeftMs(0);
    setAwaitingNextAfterPenalty(false);
  }

  async function loadSelectedGameWords(id: number) {
    try {
      const res = await fetch(`/api/hangman/games/${id}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      const w = Array.isArray((data as { words?: unknown })?.words)
        ? ((data as { words: unknown[] }).words).map((t) => String(t))
        : [];
      setWords(Array.from(new Set(w)) as string[]);
    } catch {
      setGamesError('Could not load selected game');
    }
  }

  async function saveWordsAsGame() {
    setSaveMsg(null);
    if (!newGameName.trim()) { setSaveMsg('Please provide a game name.'); return; }
    if (!words.length) { setSaveMsg('Add at least one word.'); return; }
    setSaving(true);
    try {
      const payload = {
        name: newGameName.trim(),
        description: newGameDesc.trim() || null,
        words,
      };
      const res = await fetch('/api/hangman/games', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to save');
      setSaveMsg('Saved!');
      setSelectedGameId(data.id);
    } catch (e: unknown) {
      const msg = typeof (e as { message?: unknown })?.message === 'string' ? (e as { message: string }).message : 'Could not save'
      setSaveMsg(msg);
    } finally { setSaving(false); }
  }

  function guessLetter(ch: string) {
    if (!alphabet.includes(ch)) return;
    if (guessed.has(ch) || wrong.has(ch)) return;
    const inWord = currentWord.includes(ch);
    if (inWord) {
      const next = new Set(guessed);
      next.add(ch);
      // Compute if this guess solves the word
      const wouldSolve = currentWord
        .split("")
        .every((c) => !alphabet.includes(c) || next.has(c));
      setGuessed(next);
      // award points for all occurrences
      const gain = currentWord.split("").filter((c) => c === ch).length;
      setRoundPoints((prev) => prev.map((p, i) => (i === currentTeamIndex ? p + gain : p)));
      // do NOT allow another turn on correct guess — pass turn selection (unless solved by this guess)
      if (!wouldSolve) {
        setChoosingTurn(true);
      } else {
        // stop timer when solved
        setTurnEndsAt(null);
        setTimeLeftMs(0);
      }
    } else {
      const nextW = new Set(wrong);
      nextW.add(ch);
      setWrong(nextW);
      // add a colored body part for this wrong guess
      const teamColor = accents[currentTeamIndex % accents.length];
      setParts((prev) => {
        const updated = [...prev, { teamId: currentTeamIndex, color: teamColor }];
        if (updated.length >= maxParts) {
          if (!penaltyStartedRef.current) {
            penaltyStartedRef.current = true;
            startPenaltySequence(updated);
          }
        } else {
          setGuessFeedback('wrong');
          window.setTimeout(() => {
            setGuessFeedback(null);
            setChoosingTurn(true);
          }, 400);
        }
        return updated;
      });
    }
  }

  function startPenaltySequence(currentParts: Part[]) {
    setPenaltyActive(true);
    setChoosingTurn(false);
    setGuessFeedback(null);
    // stop the turn timer during penalties
    setTurnEndsAt(null);
    setTimeLeftMs(0);
    const total = currentParts.length;
    function step(i: number) {
      if (i >= total) {
        // After all deductions, award any round points earned for correct letters
        setScores((prev) => prev.map((s, idx) => s + (roundPoints[idx] || 0)));
        setPenaltyIndex(null);
        setPenaltyActive(false);
        // Do not auto-advance. Reveal word and wait for Next Word click.
        setAwaitingNextAfterPenalty(true);
        penaltyStartedRef.current = false;
        return;
      }
      const idx = total - 1 - i; // reverse chronological
      const part = currentParts[idx];
      setPenaltyIndex(idx);
      // deduct 1 point from the team who owns this part
      setScores((prev) => {
        const next = [...prev];
        next[part.teamId] = (next[part.teamId] || 0) - 1;
        return next;
      });
      window.setTimeout(() => step(i + 1), 400);
    }
    step(0);
  }

  // Manage 10s countdown per turn
  useEffect(() => {
    if (!timerEnabled || choosingTurn || penaltyActive || awaitingNextAfterPenalty || finished) {
      // pause/clear timer when not a team's turn
      setTurnEndsAt(null);
      setTimeLeftMs(0);
      return;
    }
    if (turnEndsAt == null) return;
    let timerId: number | null = null;
    const tick = () => {
      const ms = Math.max(0, turnEndsAt - Date.now());
      setTimeLeftMs(ms);
      if (ms <= 0) {
        // time up: select a new random player
        setTurnEndsAt(null);
        setChoosingTurn(true);
        return;
      }
      timerId = window.setTimeout(tick, 100);
    };
    timerId = window.setTimeout(tick, 100);
    return () => { if (timerId != null) window.clearTimeout(timerId); };
  }, [turnEndsAt, choosingTurn, penaltyActive, awaitingNextAfterPenalty, finished, timerEnabled]);

  // nextAliveTeamIndex removed (unused)

  function endRound(solvedRound: boolean) {
    if (solvedRound) {
      // add round points to totals
      setScores((prev) => prev.map((s, i) => s + (roundPoints[i] || 0)));
    }
    if (remaining.length === 0) {
      setFinished(true);
    } else {
      startNewRound(teams.length);
    }
  }

  // Old turn-change banner removed in favor of RandomPlayerChooser

  // Setup view
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
              <h1 className="text-2xl font-bold">Hangman</h1>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SelectionCard title="Choose Game" subtitle="Pick a saved word list" onClick={() => { setMode('choose'); setSetupStep('configure'); }} />
                <SelectionCard title="Build New Game" subtitle="Create a word list" onClick={() => { setMode('build'); setSetupStep('configure'); }} />
                <SelectionCard title="Generate Game" subtitle="Use AI to suggest words" onClick={() => { setMode('generate'); setSetupStep('configure'); }} />
              </div>
            </section>
          )}

          {setupStep === 'configure' && (
            <section className="space-y-4">
              <SectionHeader title={mode === 'choose' ? 'Choose a game' : mode === 'build' ? 'Build your word list' : 'Generate a word list'} onBack={() => setSetupStep('select')} />

              {mode === 'choose' && (
                <Card>
                  <GameChooser
                    selectedId={selectedGameId}
                    onSelect={(id) => {
                      if (id == null) {
                        setSelectedGameId(null)
                        setWords([])
                        return
                      }
                      setSelectedGameId(id)
                      loadSelectedGameWords(id)
                    }}
                    onError={setGamesError}
                    onLoaded={() => {}}
                    kind="HANGMAN"
                    endpoint="/api/hangman/games"
                    onCreateBuild={() => { setMode('build'); setSetupStep('configure'); }}
                    onCreateGenerate={() => { setMode('generate'); setSetupStep('configure'); }}
                    onEdit={async (id) => {
                      try {
                        const res = await fetch(`/api/hangman/games/${id}`)
                        if (!res.ok) throw new Error('Failed to load')
                        const data = await res.json()
                        const w = Array.isArray((data as { words?: unknown })?.words)
                          ? ((data as { words: unknown[] }).words).map((t) => String(t))
                          : []
                        setWords(Array.from(new Set(w)) as string[])
                        setNewGameName(data.name || '')
                        setNewGameDesc(data.description || '')
                        setSelectedGameId(id)
                        setMode('build')
                      } catch {}
                    }}
                  />
                  {gamesError && <div className="text-xs text-rose-600">{gamesError}</div>}
                  <div className="flex justify-end pt-2">
                    <Button variant="primary" disabled={!selectedGameId || !words.length} onClick={() => setSetupStep('teams')}>Continue</Button>
                  </div>
                </Card>
              )}

              {mode === 'build' && (
                <div className="space-y-4">
                  <WordListEditor words={words} onChange={setWords} accent="#FFE29A" />
                  <Card title="Save word list (optional)" accent="#BFD6FF">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input value={newGameName} onChange={(e) => setNewGameName(e.target.value)} placeholder="Game name" className="flex-1" />
                      <Input value={newGameDesc} onChange={(e) => setNewGameDesc(e.target.value)} placeholder="Description (optional)" className="flex-1" />
                      <Button type="button" variant="secondary" onClick={saveWordsAsGame} disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                      </Button>
                    </div>
                    {saveMsg && <div className="text-xs text-emerald-700">{saveMsg}</div>}
                  </Card>
                  <div className="flex justify-end pt-2">
                    <Button variant="primary" disabled={!words.length} onClick={() => setSetupStep('teams')}>Continue</Button>
                  </div>
                </div>
              )}

              {mode === 'generate' && (
                <Card title="Generate words from text (AI)" accent="#E1C2FF">
                  <TextArea value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="Paste a short text here (1–3 paragraphs)" />
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-700">Number of words</label>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={aiWordCount}
                        onChange={(e) => setAiWordCount(() => {
                          const v = parseInt(e.target.value || '0', 10)
                          if (Number.isNaN(v)) return 1
                          return Math.max(1, Math.min(100, v))
                        })}
                        className="w-24"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      disabled={aiBusy || !aiText.trim()}
                      onClick={async () => {
                        try {
                          setAiBusy(true);
                          setAiError(null);
                          const res = await fetch('/api/ai/generate', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              text: aiText,
                              config: {
                                NUM_ROUNDS: 1,
                                MIN_TARGETS_PER_ROUND: aiWordCount,
                                MAX_TARGETS_PER_ROUND: aiWordCount,
                              },
                            })
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data?.error || 'Failed to generate');
                          const roundsArr: unknown[] = Array.isArray((data as { rounds?: unknown })?.rounds)
                            ? (data as { rounds: unknown[] }).rounds
                            : []
                          const flat = (Array.from(new Set(roundsArr.flatMap((r) => {
                            const obj = (r ?? {}) as Record<string, unknown>
                            const targets = Array.isArray(obj.targets) ? (obj.targets as unknown[]).map((t) => String(t)) : []
                            return targets
                          }))) as string[])
                            .filter(Boolean) as string[];
                          setWords(flat);
                          setMode('build'); // go to editor for review
                        } catch (e: unknown) {
                          const msg = typeof (e as { message?: unknown })?.message === 'string' ? (e as { message: string }).message : 'Could not generate'
                          setAiError(msg);
                        } finally { setAiBusy(false); }
                      }}
                    >{aiBusy ? 'Generating…' : 'Generate'}</Button>
                    {aiError && <div className="text-xs text-rose-600">{aiError}</div>}
                  </div>
                  {words.length > 0 && (
                    <div className="mt-3">
                      <div className="text-sm font-medium mb-2">Review & edit generated words</div>
                      <WordListEditor words={words} onChange={setWords} />
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
                    <Button size="sm" onClick={() => setTeamInputs((prev) => prev.filter((_, idx) => idx !== i))}>Remove</Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={() => setTeamInputs((prev) => (prev.length >= 10 ? prev : [...prev, `Team ${prev.length + 1}`]))} disabled={teamInputs.length >= 10}>
                  Add Team
                </Button>
                <Button variant="primary" className="ml-auto" onClick={startGame} disabled={teamInputs.every((t) => !t.trim()) || !words.length}>
                  Start Game
                </Button>
              </div>
            </section>
          )}
        </div>
      </main>
    );
  }

  // Gameplay view
  return (
    <div className="min-h-screen flex flex-col bg-fun">
      <div className="p-4 flex items-center justify-between">
        <Link href="/" className="text-sm underline">Home</Link>
        <div className="text-sm text-gray-600">Hangman</div>
      </div>
      <div className="flex-1 px-4 sm:px-8 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <Card>
            <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              {/* Timer toggle + seconds in top-left of this box */}
              <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const enabled = !timerEnabled;
                    setTimerEnabled(enabled);
                    if (!enabled) {
                      setTurnEndsAt(null);
                      setTimeLeftMs(0);
                    } else {
                      if (!choosingTurn && !penaltyActive && !awaitingNextAfterPenalty && !finished && timerDurationSec > 0) {
                        const ms = Math.max(1, Math.floor(timerDurationSec * 1000));
                        setTurnEndsAt(Date.now() + ms);
                        setTimeLeftMs(ms);
                      }
                    }
                  }}
                  className={[
                    "inline-flex items-center justify-center w-9 h-9 rounded-md border transition",
                    timerEnabled ? "bg-rose-600 border-rose-600 text-white" : "bg-white border-gray-300 text-gray-700"
                  ].join(" ")}
                  aria-pressed={timerEnabled}
                  title="Toggle turn timer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
                    <path d="M9 2h6v2H9z"/>
                    <path d="M12 6a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12Zm1 3h-2v4l3 2 .999-1.733L13 12.868V11Z"/>
                  </svg>
                </button>
                <input
                  type="number"
                  min={3}
                  max={120}
                  step={1}
                  value={timerDurationSec}
                  onChange={(e) => {
                    const v = parseInt(e.target.value || '0', 10);
                    const clamped = Math.max(3, Math.min(120, Number.isFinite(v) ? v : 10));
                    setTimerDurationSec(clamped);
                    if (timerEnabled && !choosingTurn && !penaltyActive && !awaitingNextAfterPenalty && !finished) {
                      const ms = clamped * 1000;
                      setTurnEndsAt(Date.now() + ms);
                      setTimeLeftMs(ms);
                    }
                  }}
                  className="w-16 h-9 px-2 py-1 text-sm border rounded-md bg-white"
                  aria-label="Turn timer seconds"
                />
              </div>
              <div className="text-center space-y-3">
                <div className="text-xs text-gray-600">Word {Math.max(1, words.length - remaining.length)} of {words.length}</div>
                <WordSlots
                  word={currentWord}
                  guessed={guessed}
                  alphabet={alphabet}
                  revealAll={awaitingNextAfterPenalty}
                  color={awaitingNextAfterPenalty ? '#dc2626' : undefined}
                />
                {timerEnabled && !choosingTurn && !penaltyActive && !solved && (
                  <div className="text-xs text-gray-700">Time left: {Math.ceil(timeLeftMs / 1000)}s</div>
                )}
                <div className="text-xs text-gray-600">Wrong: {[...wrong].join(" ") || "–"}</div>
              </div>
              <div className="flex justify-center">
                <BigGallows parts={parts} penaltyIndex={penaltyActive ? penaltyIndex : null} size={220} />
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {teams.map((t, i) => {
                const active = i === currentTeamIndex;
                const accent = accents[i % accents.length];
                const displayScore = (scores[i] || 0) + (roundPoints[i] || 0);
                return (
                  <div
                    key={t + i}
                    className={["p-2 rounded-lg bg-white/80 shadow-sm relative border flex flex-col items-center text-center min-w-[120px]", active ? "" : ""].join(" ")}
                    style={active ? { borderColor: accent, borderWidth: 2 } as React.CSSProperties : undefined}
                  >
                    <div className="text-xs font-bold">{t}</div>
                    <div className="mt-1 flex items-center gap-1">
                      <span className="text-[10px] text-gray-700">Score:</span>
                      <span className="inline-flex items-center justify-center min-w-6 px-1.5 py-0.5 rounded-full bg-black text-white text-[10px] font-bold">
                        {displayScore}
                      </span>
                    </div>
                    {active && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full" style={{ backgroundColor: accent }} />}
                  </div>
                );
              })}
            </div>
          </Card>
          {!finished && (
          <Card>
            <div className="grid grid-cols-13 sm:grid-cols-13 gap-1 sm:gap-2">
              {alphabet.map((ch) => {
                const isCorrect = guessed.has(ch);
                const isWrong = wrong.has(ch);
                const used = isCorrect || isWrong;
                return (
                  <Button
                    key={ch}
                    size="sm"
                    variant={used ? 'ghost' : 'secondary'}
                    className={used ? (isCorrect ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white') : ''}
                    disabled={used || choosingTurn || penaltyActive || awaitingNextAfterPenalty}
                    onClick={() => guessLetter(ch)}
                  >
                    {ch}
                  </Button>
                );
              })}
            </div>
            {(solved || awaitingNextAfterPenalty) && (
              <div className="mt-3 flex justify-end">
                <Button variant="primary" onClick={() => endRound(!!solved)}>Next Word</Button>
              </div>
            )}
          </Card>
          )}
          {finished && (
            <Card title="Game Over">
              <div className="space-y-2">
                <div className="text-sm text-gray-700">Final scores:</div>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  {teams.map((t, i) => (
                    <div key={t + i} className="px-2 py-1 rounded-full border bg-white/80 shadow-sm">
                      <span className="text-xs font-bold mr-2">{t}</span>
                      <span className="inline-flex items-center justify-center min-w-6 px-1.5 py-0.5 rounded-full bg-black text-white text-[10px] font-bold">{scores[i] || 0}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end pt-2">
                  <Button onClick={() => { setIsSetup(true); }}>New Game</Button>
                </div>
              </div>
            </Card>
          )}
        </div>
        {/* Old turn banner removed */}
        {/* Random player chooser overlay for selecting next team */}
        {choosingTurn && !penaltyActive && teams.length > 0 && (
          <RandomPlayerChooser
            candidates={teams.map((t, i) => ({ id: i, label: t, color: accents[i % accents.length] }))}
            // weight by teams with fewer answers so far this game
            weightsById={Object.fromEntries(teams.map((_, i) => {
              const counts = answerCounts.length === teams.length ? answerCounts : Array.from({ length: teams.length }, () => 0);
              const maxC = Math.max(0, ...counts);
              const w = (maxC - (counts[i] || 0)) + 1; // at least 1
              return [i, w];
            }))}
            onChosen={(teamId) => {
              setCurrentTeamIndex(teamId);
              setAnswerCounts((prev) => {
                const next = prev.length === teams.length ? [...prev] : Array.from({ length: teams.length }, () => 0);
                next[teamId] = (next[teamId] || 0) + 1;
                return next;
              });
              setChoosingTurn(false);
              // start a fresh turn timer if enabled
              if (timerEnabled && timerDurationSec > 0) {
                const ms = Math.max(1, Math.floor(timerDurationSec * 1000));
                setTurnEndsAt(Date.now() + ms);
                setTimeLeftMs(ms);
              } else {
                setTurnEndsAt(null);
                setTimeLeftMs(0);
              }
            }}
          />
        )}
        {guessFeedback === 'wrong' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="rounded-full bg-rose-600 text-white px-5 py-2 text-sm shadow-lg">Wrong!</div>
          </div>
        )}
      </div>
    </div>
  );
}

// Unified big gallows with color-coded parts by wrong guess order
function BigGallows({ parts, penaltyIndex = null, size = 220 }: { parts: { teamId: number; color: string }[]; penaltyIndex?: number | null; size?: number }) {
  const s = Math.max(0, Math.min(6, parts.length));
  const gallows = '#9ca3af';
  const w = size;
  const h = size;
  // scale drawing to fit size (original base was 64)
  // Use fixed stroke widths in viewBox units for thinner lines at large sizes
  const gallowsStroke = 1.4;
  const partStroke = 1.0;
  const p = parts;
  const pos: { x: number; y: number }[] = [
    { x: 40, y: 13 }, // head
    { x: 40, y: 33 }, // body
    { x: 34, y: 33 }, // left arm
    { x: 46, y: 33 }, // right arm
    { x: 36, y: 48 }, // left leg
    { x: 44, y: 48 }, // right leg
  ];
  return (
    <svg width={w} height={h} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* gallows */}
      <line x1="8" y1="58" x2="56" y2="58" stroke={gallows} strokeWidth={gallowsStroke} />
      <line x1="16" y1="58" x2="16" y2="8" stroke={gallows} strokeWidth={gallowsStroke} />
      <line x1="16" y1="8" x2="40" y2="8" stroke={gallows} strokeWidth={gallowsStroke} />
      <line x1="40" y1="8" x2="40" y2="14" stroke={gallows} strokeWidth={gallowsStroke} />
      {/* parts 1..6 colored by who missed */}
      {s >= 1 && <circle cx="40" cy="20" r="5" stroke={p[0].color} strokeWidth={partStroke} fill="none" />}
      {s >= 2 && <line x1="40" y1="26" x2="40" y2="40" stroke={p[1].color} strokeWidth={partStroke} />}
      {s >= 3 && <line x1="40" y1="30" x2="32" y2="36" stroke={p[2].color} strokeWidth={partStroke} />}
      {s >= 4 && <line x1="40" y1="30" x2="48" y2="36" stroke={p[3].color} strokeWidth={partStroke} />}
      {s >= 5 && <line x1="40" y1="40" x2="34" y2="54" stroke={p[4].color} strokeWidth={partStroke} />}
      {s >= 6 && <line x1="40" y1="40" x2="46" y2="54" stroke={p[5].color} strokeWidth={partStroke} />}

      {/* penalty floating -1 near current deduction */}
      {penaltyIndex != null && penaltyIndex >= 0 && penaltyIndex < pos.length && (
        <text x={pos[penaltyIndex].x} y={pos[penaltyIndex].y - 6} textAnchor="middle" fontSize="8" fill={p[penaltyIndex]?.color || '#ef4444'}>
          -1
        </text>
      )}
    </svg>
  );
}

// Renders underscores as lines and places revealed letters above the line
function WordSlots({ word, guessed, alphabet, revealAll = false, color }: { word: string; guessed: Set<string>; alphabet: string[]; revealAll?: boolean; color?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-center gap-x-2 gap-y-3">
      {word.split("").map((ch, i) => {
        const isAlpha = alphabet.includes(ch);
        if (!isAlpha) {
          return (
            <span key={`sep-${i}`} className="px-1 text-2xl font-mono">
              {ch}
            </span>
          );
        }
        const revealed = revealAll || guessed.has(ch);
        return (
          <span key={`slot-${i}`} className="relative inline-flex items-end justify-center h-12 w-8">
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-800" />
            {revealed && (
              <span className="absolute bottom-3 text-2xl font-mono" style={color ? { color } : undefined}>{ch}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}
