"use client";
import { useEffect, useState } from "react";
import type { GameListItem } from "@/types/game";

export function GameChooser({ selectedId, onSelect, onLoaded, onError }: {
  selectedId: number | null,
  onSelect: (id: number) => void,
  onLoaded: (games: GameListItem[]) => void,
  onError: (msg: string | null) => void
}) {
  const [games, setGames] = useState<GameListItem[]>([])
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

