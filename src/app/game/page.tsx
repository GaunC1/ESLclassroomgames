"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Round = {
  title: string;
  targets: string[];
};

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

function clamp(n: number, min = 0, max = Infinity) {
  return Math.max(min, Math.min(max, n));
}

export default function GamePage() {
  // Setup
  const [isSetup, setIsSetup] = useState(true);
  const [teamInputs, setTeamInputs] = useState<string[]>(["Team 1", "Team 2"]);
  const [useCustomRounds, setUseCustomRounds] = useState(false);
  const [customRounds, setCustomRounds] = useState<Round[]>([]);
  const [customError, setCustomError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Rounds + gameplay
  const [rounds, setRounds] = useState<Round[]>(DEFAULT_ROUNDS);
  const [teams, setTeams] = useState<string[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("prompt");

  // Available games from DB
  type GameListItem = { id: number; name: string; description?: string | null; roundsCount: number };
  const [games, setGames] = useState<GameListItem[]>([]);
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
  const [penalties, setPenalties] = useState<number[][]>([]); // [team][round]

  // Grading workflow
  const [gradingTeamIndex, setGradingTeamIndex] = useState(0);
  const sentenceRef = useRef<HTMLTextAreaElement>(null);

  // Writing timer
  const [secondsLeft, setSecondsLeft] = useState(60);

  const round = rounds[roundIndex];
  const perRoundMax = useMemo(() => rounds.map((r) => r.targets.length + 1), [rounds]);
  const teamTotalMax = perRoundMax.reduce((a, b) => a + b, 0);

  // Scoring helpers
  function normalizeInput(str: string) {
    return str.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  }
  function phraseToRegex(phrase: string): RegExp {
    const parts = phrase
      .toLowerCase()
      .split(/\s+/)
      .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const pattern = `\\b${parts.join("\\s+")}\\b`;
    return new RegExp(pattern, "i");
  }
  function scoreSentence(sentence: string, targets: string[]) {
    const normalized = normalizeInput(sentence);
    const used = new Set<string>();
    for (const t of targets) {
      const re = phraseToRegex(t);
      if (re.test(normalized)) used.add(t);
    }
    const base = used.size;
    const bonus = used.size === targets.length ? 1 : 0;
    return { used: Array.from(used), score: base + bonus, bonus };
  }

  async function startGame() {
    const cleaned = teamInputs
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .slice(0, 10);
    if (cleaned.length === 0) return;

    let resolved = DEFAULT_ROUNDS;
    if (useCustomRounds) {
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
    } else if (selectedGameId) {
      try {
        const res = await fetch(`/api/games/${selectedGameId}`);
        if (!res.ok) throw new Error('Failed to load game');
        const data = await res.json();
        const mapped: Round[] = (data.rounds || []).map((r: any) => ({ title: r.title, targets: (r.targets || []).map(String) }));
        if (mapped.length) {
          resolved = mapped;
        }
      } catch (e: any) {
        setGamesError('Could not load selected game. Falling back to default rounds.');
      }
    }

    setTeams(cleaned);
    setRounds(resolved);
    setSentences(Array.from({ length: cleaned.length }, () => Array(resolved.length).fill("")));
    setPenalties(Array.from({ length: cleaned.length }, () => Array(resolved.length).fill(0)));
    setRoundIndex(0);
    setPhase("prompt");
    setIsSetup(false);
  }

  async function saveCustomGame() {
    setSaveMsg(null);
    setCustomError(null);
    if (!useCustomRounds) {
      setCustomError('Enable "Build a custom game" first.');
      return;
    }
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
      // Refresh list
      try {
        const listRes = await fetch('/api/games');
        if (listRes.ok) {
          const list = await listRes.json();
          setGames(list);
        }
      } catch {}
    } catch (e: any) {
      setCustomError(e?.message || 'Could not save game');
    } finally {
      setSaving(false);
    }
  }

  // Derived totals
  const finalScore = (ti: number, ri: number) => {
    const base = scoreSentence(sentences[ti]?.[ri] ?? "", rounds[ri].targets).score;
    const pen = penalties[ti]?.[ri] ?? 0;
    return clamp(base - pen, 0);
  };
  const perTeamTotals = useMemo(
    () => teams.map((_, ti) => rounds.reduce((sum, _r, ri) => sum + finalScore(ti, ri), 0)),
    [teams, rounds, sentences, penalties]
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

  // Setup view
  if (isSetup) {
    return (
      <main className="min-h-screen p-6 sm:p-10 bg-fun">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-sm underline">Home</Link>
            <div className="text-sm text-gray-600">Up to 10 teams</div>
          </div>

          <h1 className="text-2xl font-bold">Create Teams</h1>
          <p className="text-sm text-gray-600">Add teams and pick a game, or build your own rounds.</p>

          <div className="space-y-2">
            {teamInputs.map((name, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-16 text-xs text-gray-600">Team {i + 1}</span>
                <input
                  value={name}
                  onChange={(e) => {
                    const v = e.target.value;
                    setTeamInputs((prev) => prev.map((t, idx) => (idx === i ? v : t)));
                  }}
                  className="flex-1 rounded border px-3 py-2 text-sm"
                  placeholder={`Team ${i + 1}`}
                />
                <button
                  onClick={() => setTeamInputs((prev) => prev.filter((_, idx) => idx !== i))}
                  className="px-2 py-2 rounded border text-xs hover:bg-gray-50"
                  aria-label={`Remove Team ${i + 1}`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setTeamInputs((prev) => (prev.length >= 10 ? prev : [...prev, `Team ${prev.length + 1}`]))}
              disabled={teamInputs.length >= 10}
              className="px-3 py-2 rounded border text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Add Team
            </button>
          </div>

          {/* Generate from text (AI) */}
          <div className="rounded-lg border p-3 sm:p-4 space-y-2 bg-white/70">
            <div className="text-sm font-medium">Generate rounds from text (AI)</div>
            <textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              className="w-full min-h-32 rounded border p-3 text-sm"
              placeholder="Paste a short text here (1–3 paragraphs)"
            />
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="inline-flex items-center gap-1">Rounds
                <input type="number" min={1} max={15} value={aiNumRounds} onChange={(e) => setAiNumRounds(parseInt(e.target.value || '10', 10))} className="w-16 rounded border px-2 py-1" />
              </label>
              <label className="inline-flex items-center gap-1">Min targets
                <input type="number" min={1} max={10} value={aiMinTargets} onChange={(e) => setAiMinTargets(parseInt(e.target.value || '6', 10))} className="w-16 rounded border px-2 py-1" />
              </label>
              <label className="inline-flex items-center gap-1">Max targets
                <input type="number" min={aiMinTargets} max={12} value={aiMaxTargets} onChange={(e) => setAiMaxTargets(parseInt(e.target.value || '10', 10))} className="w-16 rounded border px-2 py-1" />
              </label>
              <button
                type="button"
                className="ml-auto px-3 py-2 btn-fun-secondary text-sm"
                disabled={aiBusy || !aiText.trim()}
                onClick={async () => {
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
                    const rounds = (data?.rounds || []).map((r: any) => ({ title: String(r.title || ''), targets: (r.targets || []).map((t: any) => String(t)) }));
                    if (!rounds.length) throw new Error('No rounds returned');
                    setUseCustomRounds(true);
                    setCustomRounds(rounds);
                    // Pre-fill name/desc if provided
                    if (typeof data?.name === 'string' && !newGameName) setNewGameName(data.name);
                    if (typeof data?.description === 'string' && !newGameDesc) setNewGameDesc(data.description);
                  } catch (e: any) {
                    setAiError(e?.message || 'Could not generate');
                  } finally {
                    setAiBusy(false);
                  }
                }}
              >
                {aiBusy ? 'Generating…' : 'Generate'}
              </button>
            </div>
            {aiError && <div className="text-xs text-rose-600">{aiError}</div>}
          </div>

          {/* Game chooser */}
          <div className="rounded-lg border p-3 sm:p-4 space-y-2 bg-white/70">
            <div className="text-sm font-medium">Choose a game</div>
            <GameChooser
              selectedId={selectedGameId}
              onSelect={setSelectedGameId}
              onError={setGamesError}
              onLoaded={(list) => {
                setGames(list);
                if (list.length && selectedGameId == null) setSelectedGameId(list[0].id);
              }}
            />
            {gamesError && <div className="text-xs text-rose-600">{gamesError}</div>}
          </div>

          <div className="rounded-lg border p-3 sm:p-4 space-y-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useCustomRounds} onChange={(e) => setUseCustomRounds(e.target.checked)} />
              Build a custom game
            </label>
            {useCustomRounds && (
              <div className="space-y-3">
                <CustomRoundsEditor rounds={customRounds} onChange={setCustomRounds} />
                <div className="rounded border p-3 bg-white/70 space-y-2">
                  <div className="text-sm font-medium">Save custom game</div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      value={newGameName}
                      onChange={(e) => setNewGameName(e.target.value)}
                      placeholder="Game name (required)"
                      className="flex-1 rounded border px-2 py-1 text-sm"
                    />
                    <input
                      value={newGameDesc}
                      onChange={(e) => setNewGameDesc(e.target.value)}
                      placeholder="Description (optional)"
                      className="flex-1 rounded border px-2 py-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={saveCustomGame}
                      disabled={saving}
                      className="px-3 py-2 btn-fun-primary text-sm disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Save Game'}
                    </button>
                  </div>
                  {saveMsg && <div className="text-xs text-emerald-700">{saveMsg}</div>}
                </div>
                {customError && <div className="text-xs text-rose-600">{customError}</div>}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={startGame}
              disabled={teamInputs.every((t) => !t.trim())}
              className="px-4 py-2 btn-fun-primary text-sm disabled:opacity-50"
            >
              Start Game
            </button>
          </div>
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
                return (
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Target Words/Phrases</div>
                    <div className="flex flex-wrap gap-2">
                      {round.targets.map((t) => {
                        const used = res.used.includes(t);
                        return (
                          <span key={t} className={`inline-flex items-center gap-1 px-3 py-1 chip text-xs ${used ? "chip-used" : ""}`}>
                            {used ? "✅" : "⭕️"} {t}
                            {used && <span className="text-[10px] ml-1">+1</span>}
                          </span>
                        );
                      })}
                    </div>
                    <div className="text-sm text-gray-700">
                      Base: <span className="font-medium">{res.score}</span>{res.bonus ? " (includes +1 bonus)" : ""}
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

// Inline component to fetch and display games
function GameChooser({ selectedId, onSelect, onLoaded, onError }: {
  selectedId: number | null,
  onSelect: (id: number) => void,
  onLoaded: (games: { id: number; name: string; description?: string | null; roundsCount: number }[]) => void,
  onError: (msg: string | null) => void
}) {
  const [games, setGames] = useState<{ id: number; name: string; description?: string | null; roundsCount: number }[]>([])
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/games')
        if (!res.ok) throw new Error('Failed to load games')
        const data = await res.json()
        if (!cancelled) {
          setGames(data)
          onLoaded(data)
          onError(null)
        }
      } catch (e) {
        if (!cancelled) onError('Could not load games list')
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (!games.length) return <div className="text-xs text-gray-500">Loading games…</div>

  return (
    <div className="flex flex-col gap-2">
      {games.map((g) => (
        <label key={g.id} className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="game-choice"
            checked={selectedId === g.id}
            onChange={() => onSelect(g.id)}
          />
          <span className="font-medium">{g.name}</span>
          <span className="text-xs text-gray-600">({g.roundsCount} rounds)</span>
        </label>
      ))}
    </div>
  )
}

// Visual editor for custom rounds
function CustomRoundsEditor({ rounds, onChange }: { rounds: Round[]; onChange: (r: Round[]) => void }) {
  function addRound() {
    onChange([...rounds, { title: `Round ${rounds.length + 1}`, targets: [] }]);
  }
  function removeRound(idx: number) {
    const next = rounds.filter((_, i) => i !== idx);
    onChange(next);
  }
  function updateTitle(idx: number, title: string) {
    const next = rounds.map((r, i) => (i === idx ? { ...r, title } : r));
    onChange(next);
  }
  function addTarget(idx: number, word: string) {
    const v = word.trim();
    if (!v) return;
    const next = rounds.map((r, i) => (i === idx ? { ...r, targets: Array.from(new Set([...(r.targets || []), v])) } : r));
    onChange(next);
  }
  function removeTarget(idx: number, word: string) {
    const next = rounds.map((r, i) => (i === idx ? { ...r, targets: (r.targets || []).filter((t) => t !== word) } : r));
    onChange(next);
  }
  function moveRound(idx: number, dir: -1 | 1) {
    const to = idx + dir;
    if (to < 0 || to >= rounds.length) return;
    const next = rounds.slice();
    const [item] = next.splice(idx, 1);
    next.splice(to, 0, item);
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {rounds.map((r, idx) => (
        <RoundEditorRow
          key={idx}
          index={idx}
          title={r.title}
          targets={r.targets}
          onTitle={(t) => updateTitle(idx, t)}
          onAddTarget={(w) => addTarget(idx, w)}
          onRemoveTarget={(w) => removeTarget(idx, w)}
          onMoveUp={() => moveRound(idx, -1)}
          onMoveDown={() => moveRound(idx, +1)}
          onRemove={() => removeRound(idx)}
        />
      ))}
      <button type="button" onClick={addRound} className="px-3 py-2 btn-fun-secondary text-sm">+ Add Round</button>
    </div>
  );
}

function RoundEditorRow({
  index,
  title,
  targets,
  onTitle,
  onAddTarget,
  onRemoveTarget,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  index: number;
  title: string;
  targets: string[];
  onTitle: (t: string) => void;
  onAddTarget: (w: string) => void;
  onRemoveTarget: (w: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const [word, setWord] = useState("");
  return (
    <div className="rounded border p-3 bg-white/70 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs text-gray-500">R{index + 1}</span>
          <input
            value={title}
            onChange={(e) => onTitle(e.target.value)}
            placeholder={`Round ${index + 1} title`}
            className="flex-1 rounded border px-2 py-1 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onMoveUp} className="px-2 py-1 rounded border text-xs hover:bg-gray-50">↑</button>
          <button type="button" onClick={onMoveDown} className="px-2 py-1 rounded border text-xs hover:bg-gray-50">↓</button>
          <button type="button" onClick={onRemove} className="px-2 py-1 rounded border text-xs hover:bg-rose-50">Remove</button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onAddTarget(word);
              setWord("");
            }
          }}
          placeholder="Add target word/phrase and press Enter"
          className="flex-1 rounded border px-2 py-1 text-sm"
        />
        <button type="button" onClick={() => { onAddTarget(word); setWord(""); }} className="px-3 py-1.5 btn-fun-secondary text-xs">Add</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(targets || []).map((t) => (
          <span key={t} className="chip inline-flex items-center gap-1 text-xs">
            {t}
            <button type="button" onClick={() => onRemoveTarget(t)} className="ml-1 px-1 rounded border text-[10px] hover:bg-gray-50">✖</button>
          </span>
        ))}
      </div>
    </div>
  );
}
