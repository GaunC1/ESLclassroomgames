export function clamp(n: number, min = 0, max = Infinity) {
  return Math.max(min, Math.min(max, n));
}

export function normalizeInput(str: string) {
  return str.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function phraseToRegex(phrase: string): RegExp {
  const parts = phrase
    .toLowerCase()
    .split(/\s+/)
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = `\\b${parts.join("\\s+")}\\b`;
  return new RegExp(pattern, "i");
}

export function scoreSentence(sentence: string, targets: string[]) {
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

