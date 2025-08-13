"use client";
import { useEffect, useState } from "react";
import type { GameListItem } from "@/types/game";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {games.map((g) => {
        const selected = selectedId === g.id
        return (
          <div key={g.id}>
            <Card
              className={[
                "cursor-pointer transition",
                selected ? "ring-2 ring-black" : "hover:bg-white",
              ].join(" ")}
              onClick={() => onSelect(g.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{g.name}</div>
                  {g.description && (
                    <div className="text-xs text-gray-600 mt-0.5 line-clamp-2">{g.description}</div>
                  )}
                </div>
                <div className="text-xs text-gray-600 whitespace-nowrap">{g.roundsCount} rounds</div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button variant={selected ? "primary" : "outline"} onClick={(e) => { e.stopPropagation(); onSelect(g.id); }}>
                  {selected ? "Selected" : "Select"}
                </Button>
              </div>
            </Card>
          </div>
        )
      })}
    </div>
  )
}
