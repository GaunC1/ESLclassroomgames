import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Classroom Games</h1>
          <p className="text-sm text-gray-600">Pick a game to set up and play with teams.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/game" className="rounded-lg border p-4 bg-white/80 hover:bg-white transition">
            <div className="font-semibold mb-1">Sentence Smash</div>
            <div className="text-xs text-gray-600">Write sentences using given words and phrases.</div>
            <div className="mt-3 inline-block rounded-full bg-black text-white text-xs px-3 py-1">Play</div>
          </Link>
          <Link href="/hangman" className="rounded-lg border p-4 bg-white/80 hover:bg-white transition">
            <div className="font-semibold mb-1">Hangman</div>
            <div className="text-xs text-gray-600">Teams guess letters to reveal a word.</div>
            <div className="mt-3 inline-block rounded-full bg-black text-white text-xs px-3 py-1">Play</div>
          </Link>
        </div>
      </div>
    </main>
  );
}
