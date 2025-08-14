"use client";
import { useEffect, useState } from "react";
import type { GameListItem } from "@/types/game";
import { Card } from "@/components/ui/Card";
// No button; selection happens by clicking the card

export function GameChooser({ selectedId, onSelect, onLoaded, onError, kind = 'SENTENCE', endpoint, onEdit, onCreateBuild, onCreateGenerate }: {
  selectedId: number | null,
  onSelect: (id: number | null) => void,
  onLoaded: (games: GameListItem[]) => void,
  onError: (msg: string | null) => void,
  kind?: 'SENTENCE' | 'HANGMAN',
  endpoint?: string,
  onEdit?: (id: number) => void,
  onCreateBuild?: () => void,
  onCreateGenerate?: () => void,
}) {
  const [games, setGames] = useState<GameListItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const url = endpoint || `/api/games?kind=${encodeURIComponent(kind)}`
        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to load games')
        const data = await res.json()
        if (!cancelled) {
          setGames(data)
          onLoaded(data)
          onError(null)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          onError('Could not load games list')
          setLoading(false)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) return <div className="text-xs text-gray-500">Loading games…</div>
  if (!games.length) return (
    <div className="text-xs text-gray-600">
      No games yet. Create one with 
      {" "}
      <a href="#" className="underline" onClick={(e) => { e.preventDefault(); onCreateBuild?.() }}>Build New Game</a>
      {" "}or{" "}
      <a href="#" className="underline" onClick={(e) => { e.preventDefault(); onCreateGenerate?.() }}>Generate Game</a>.
    </div>
  )

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {games.map((g, i) => {
        const selected = selectedId === g.id
        const accents = ['#FFB3D1', '#BFD6FF', '#FFE29A', '#C2F0C2', '#E1C2FF', '#FFC9A3']
        const accent = accents[i % accents.length]
        const baseEndpoint = (endpoint || '/api/games').split('?')[0]
        return (
          <div key={g.id}>
            <Card
              className={[
                "cursor-pointer transition h-full flex flex-col min-h-[128px] relative",
                selected ? "" : "hover:bg-white",
              ].join(" ")}
              style={selected ? { borderColor: accent, borderWidth: 2 } as React.CSSProperties : undefined}
              accent={accent}
              onClick={() => onSelect(g.id)}
            >
              <div className="absolute top-2 right-2 flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Edit game"
                  className="p-1 rounded hover:bg-gray-50 text-gray-700"
                  onClick={(e) => { e.stopPropagation(); onEdit ? onEdit(g.id) : onSelect(g.id) }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="Delete game"
                  className="p-1 rounded hover:bg-rose-50 text-rose-700"
                  onClick={async (e) => {
                    e.stopPropagation()
                    try {
                      const ok = window.confirm(`Delete ${g.name}? This cannot be undone.`)
                      if (!ok) return
                      const res = await fetch(`${baseEndpoint}/${g.id}`, { method: 'DELETE' })
                      if (!res.ok && res.status !== 204) throw new Error('Failed to delete')
                      setGames((prev) => {
                        const next = prev.filter((x) => x.id !== g.id)
                        onLoaded(next)
                        if (selectedId === g.id) onSelect(next[0]?.id ?? null)
                        return next
                      })
                    } catch (err) {
                      onError('Could not delete game')
                      setTimeout(() => onError(null), 1500)
                    }
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
              <div className="flex items-start justify-between gap-3 flex-1">
                <div>
                  <div className="font-medium">{g.name}</div>
                  {g.description && (
                    <div className="text-xs text-gray-600 mt-0.5 line-clamp-2">{g.description}</div>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between min-h-[1.25rem]">
                <div className="text-[11px] text-gray-500">{selected ? 'Selected' : ''}</div>
                <div
                  className="text-[10px] font-medium whitespace-nowrap rounded-full px-2 py-0.5 border"
                  style={{ borderColor: accent }}
                >
                  {g.roundsCount} {endpoint?.includes('/api/hangman') ? 'words' : 'rounds'}
                </div>
              </div>
            </Card>
          </div>
        )
      })}
    </div>
  )
}
