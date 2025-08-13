"use client";
import { useEffect, useState } from "react";
import type { GameListItem } from "@/types/game";
import { Card } from "@/components/ui/Card";
// No button; selection happens by clicking the card

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
      {games.map((g, i) => {
        const selected = selectedId === g.id
        const accents = ['#FFB3D1', '#BFD6FF', '#FFE29A', '#C2F0C2', '#E1C2FF', '#FFC9A3']
        const accent = accents[i % accents.length]
        return (
          <div key={g.id}>
            <Card
              className={[
                "cursor-pointer transition h-full flex flex-col min-h-[128px]",
                selected ? "" : "hover:bg-white",
              ].join(" ")}
              style={selected ? { borderColor: accent, borderWidth: 2 } as React.CSSProperties : undefined}
              accent={accent}
              onClick={() => onSelect(g.id)}
            >
              <div className="flex items-start justify-between gap-3 flex-1">
                <div>
                  <div className="font-medium">{g.name}</div>
                  {g.description && (
                    <div className="text-xs text-gray-600 mt-0.5 line-clamp-2">{g.description}</div>
                  )}
                </div>
                <div
                  className="text-[10px] font-medium whitespace-nowrap rounded-full px-2 py-0.5 border"
                  style={{ borderColor: accent }}
                >
                  {g.roundsCount} rounds
                </div>
              </div>
              <div className="mt-3 text-right text-xs font-medium text-gray-700 min-h-[1rem]">
                {selected ? 'Selected' : ''}
              </div>
            </Card>
          </div>
        )
      })}
    </div>
  )
}
