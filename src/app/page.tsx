import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-xl w-full text-center space-y-6">
        <h1 className="text-3xl font-bold">Sentence Smash</h1>
        <p className="text-sm text-gray-600">Write sentences using given words and phrases.</p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/game"
            className="rounded-md bg-black text-white px-4 py-2 text-sm hover:opacity-90"
          >
            Play Sentence Smash
          </Link>
        </div>
      </div>
    </main>
  );
}
