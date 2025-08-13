import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-xl w-full text-center space-y-6">
        <h1 className="text-3xl font-bold">Prepositions & Colors Game</h1>
        <p className="text-sm text-gray-600">
          Practice sentences with colors, prepositions, nouns, adjectives, and verbs.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/game"
            className="rounded-md bg-black text-white px-4 py-2 text-sm hover:opacity-90"
          >
            Start Game
          </Link>
          <Link
            href="/game/print"
            className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Printable Sheet
          </Link>
        </div>
      </div>
    </main>
  );
}
