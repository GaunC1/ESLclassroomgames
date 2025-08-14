"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const [lives, setLives] = useState<number[]>([]);
  const [maxLives] = useState<number>(6);
  const [guessFeedback, setGuessFeedback] = useState<null | 'wrong'>(null);
  const [remaining, setRemaining] = useState<number[]>([]);
  // derive current word number from remaining
  const [finished, setFinished] = useState<boolean>(false);
  // Random chooser state
  const [choosingTurn, setChoosingTurn] = useState<boolean>(false);
  const [pickedBefore, setPickedBefore] = useState<Set<number>>(new Set());

  const alphabet = useMemo(() => "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("") as string[], []);
  const currentWord = (words[currentIndex] || "").toUpperCase();
  const display = currentWord.split("").map((ch) => (alphabet.includes(ch) ? (guessed.has(ch) ? ch : "_") : ch)).join(" ");
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
    setLives(Array.from({ length: cleanedTeams.length }, () => maxLives));
    setFinished(false);
    setPickedBefore(new Set());
    setIsSetup(false);
    setChoosingTurn(true);
  }

  function startNewRound(teamCount = teams.length) {
    setGuessed(new Set());
    setWrong(new Set());
    setRoundPoints(Array.from({ length: teamCount }, () => 0));
    setLives(Array.from({ length: teamCount }, () => maxLives));
    setRemaining((prev) => {
      if (!prev.length) {
        setFinished(true);
        return [];
      }
      const [next, ...rest] = prev;
      setCurrentIndex(next);
      return rest;
    });
    // reset chooser weighting each round and pick a random starting team
    setPickedBefore(new Set());
    setChoosingTurn(true);
  }

  async function loadSelectedGameWords(id: number) {
    try {
      const res = await fetch(`/api/hangman/games/${id}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      const w = Array.isArray(data?.words) ? data.words.map((t: any) => String(t)) : [];
      setWords(Array.from(new Set(w)) as string[]);
    } catch (e) {
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
    } catch (e: any) {
      setSaveMsg(e?.message || 'Could not save');
    } finally { setSaving(false); }
  }

  function guessLetter(ch: string) {
    if (!alphabet.includes(ch)) return;
    if (guessed.has(ch) || wrong.has(ch)) return;
    const inWord = currentWord.includes(ch);
    if (inWord) {
      const next = new Set(guessed);
      next.add(ch);
      setGuessed(next);
      // award points for all occurrences
      const gain = currentWord.split("").filter((c) => c === ch).length;
      setRoundPoints((prev) => prev.map((p, i) => (i === currentTeamIndex ? p + gain : p)));
      // stay on same team after a correct guess
      // if solved, show Next Word button; do not auto-advance
    } else {
      const nextW = new Set(wrong);
      nextW.add(ch);
      setWrong(nextW);
      // decrement life immediately
      const newLives = [...lives];
      newLives[currentTeamIndex] = Math.max(0, (newLives[currentTeamIndex] || 0) - 1);
      setLives(newLives);
      // show wrong feedback, then move turn via random chooser
      setGuessFeedback('wrong');
      window.setTimeout(() => {
        const died = (newLives[currentTeamIndex] || 0) <= 0;
        if (died) {
          setRoundPoints((rp) => rp.map((p, i) => (i === currentTeamIndex ? 0 : p)));
        }
        const anyAlive = newLives.some((v) => (v || 0) > 0);
        if (!anyAlive) { endRound(false); }
        else { setChoosingTurn(true); }
        setGuessFeedback(null);
      }, 800);
    }
  }

  function nextAliveTeamIndex(lv: number[], from: number) {
    if (!teams.length) return -1;
    for (let step = 1; step <= teams.length; step++) {
      const idx = (from + step) % teams.length;
      if ((lv[idx] || 0) > 0) return idx;
    }
    return -1;
  }

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
                        const w = Array.isArray(data?.words) ? data.words.map((t: any) => String(t)) : []
                        setWords(Array.from(new Set(w)) as string[])
                        setNewGameName(data.name || '')
                        setNewGameDesc(data.description || '')
                        setSelectedGameId(id)
                        setMode('build')
                      } catch (e) {}
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
                          const flat = (Array.from(new Set((data?.rounds || []).flatMap((r: any) => (r.targets || []).map((t: any) => String(t))))) as string[])
                            .filter(Boolean) as string[];
                          setWords(flat);
                          setMode('build'); // go to editor for review
                        } catch (e: any) {
                          setAiError(e?.message || 'Could not generate');
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
            <div className="text-center space-y-3">
              <div className="text-xs text-gray-600">Word {Math.max(1, words.length - remaining.length)} of {words.length}</div>
              <div className="text-3xl font-mono tracking-widest">{display}</div>
              <div className="text-xs text-gray-600">Wrong: {[...wrong].join(" ") || "–"}</div>
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
                    <div className="mt-1" aria-label={`Lives remaining: ${lives[i] ?? maxLives}`}>
                      <HangmanMini stage={Math.max(0, maxLives - (lives[i] ?? maxLives))} color={accent} size={64} />
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
                    disabled={used || choosingTurn}
                    onClick={() => guessLetter(ch)}
                  >
                    {ch}
                  </Button>
                );
              })}
            </div>
            {solved && (
              <div className="mt-3 flex justify-end">
                <Button variant="primary" onClick={() => endRound(true)}>Next Word</Button>
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
        {choosingTurn && teams.length > 0 && (
          <RandomPlayerChooser
            candidates={teams.map((t, i) => ({ id: i, label: t, color: accents[i % accents.length] }))
              .filter((c) => (lives[c.id] || 0) > 0)}
            pickedBefore={pickedBefore}
            onChosen={(teamId) => {
              setCurrentTeamIndex(teamId);
              setPickedBefore((prev) => new Set(prev).add(teamId));
              setChoosingTurn(false);
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

function HangmanMini({ stage, color = '#111', size = 72 }: { stage: number; color?: string; size?: number }) {
  // stage: 0 = none, 1=head, 2=+body, 3=+left arm, 4=+right arm, 5=+left leg, 6=+right leg
  const s = Math.max(0, Math.min(6, Math.floor(stage || 0)));
  const gallows = '#9ca3af';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* gallows */}
      <line x1="8" y1="58" x2="56" y2="58" stroke={gallows} strokeWidth="3" />
      <line x1="16" y1="58" x2="16" y2="8" stroke={gallows} strokeWidth="3" />
      <line x1="16" y1="8" x2="40" y2="8" stroke={gallows} strokeWidth="3" />
      <line x1="40" y1="8" x2="40" y2="14" stroke={gallows} strokeWidth="3" />
      {/* man drawn in 6 steps */}
      {/* 1: head */}
      {s >= 1 && <circle cx="40" cy="20" r="6" stroke={color} strokeWidth="3" fill="none" />}
      {/* 2: body */}
      {s >= 2 && <line x1="40" y1="26" x2="40" y2="40" stroke={color} strokeWidth="3" />}
      {/* 3: left arm */}
      {s >= 3 && <line x1="40" y1="30" x2="32" y2="36" stroke={color} strokeWidth="3" />}
      {/* 4: right arm */}
      {s >= 4 && <line x1="40" y1="30" x2="48" y2="36" stroke={color} strokeWidth="3" />}
      {/* 5: left leg */}
      {s >= 5 && <line x1="40" y1="40" x2="34" y2="54" stroke={color} strokeWidth="3" />}
      {/* 6: right leg */}
      {s >= 6 && <line x1="40" y1="40" x2="46" y2="54" stroke={color} strokeWidth="3" />}
    </svg>
  );
}
