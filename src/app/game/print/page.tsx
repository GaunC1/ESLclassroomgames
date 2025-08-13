export default function PrintPage() {
  const rounds: { title: string; targets: string[] }[] = [
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

  return (
    <main className="mx-auto max-w-4xl p-8 print:p-0">
      <h1 className="text-2xl font-bold mb-6 text-center">Prepositions & Colors Game — Printable Sheet</h1>
      <p className="text-sm text-gray-600 mb-6">
        Instructions: Write a grammatically correct sentence using as many target words/phrases as possible.
        Scoring: 1 point per target used. Bonus +1 if all targets are used.
      </p>
      <div className="space-y-6">
        {rounds.map((r, idx) => (
          <section key={idx} className="break-inside-avoid rounded border p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">{r.title}</h2>
              <div className="text-sm">Score: ____ / {r.targets.length + 1}</div>
            </div>
            <div className="text-sm mb-2"><span className="font-medium">Word Bank:</span> {r.targets.join(" | ")}</div>
            <div className="h-24 border rounded"></div>
          </section>
        ))}
      </div>
      <style>{`
        @media print {
          .print\:p-0 { padding: 0 !important; }
          section { page-break-inside: avoid; margin-bottom: 12px; }
        }
      `}</style>
    </main>
  );
}

