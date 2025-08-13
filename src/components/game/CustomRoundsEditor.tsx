"use client";
import { useState } from "react";
import type { Round } from "@/types/game";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";

export function CustomRoundsEditor({ rounds, onChange }: { rounds: Round[]; onChange: (r: Round[]) => void }) {
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
      <Button type="button" variant="secondary" onClick={addRound}>+ Add Round</Button>
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
    <Card className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs text-gray-500">R{index + 1}</span>
          <Input
            value={title}
            onChange={(e) => onTitle(e.target.value)}
            placeholder={`Round ${index + 1} title`}
            className="flex-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onMoveUp}>↑</Button>
          <Button size="sm" onClick={onMoveDown}>↓</Button>
          <Button size="sm" onClick={onRemove}>Remove</Button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Input
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
          className="flex-1"
        />
        <Button size="sm" variant="secondary" onClick={() => { onAddTarget(word); setWord(""); }}>Add</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(targets || []).map((t) => (
          <Tag key={t} onRemove={() => onRemoveTarget(t)}>{t}</Tag>
        ))}
      </div>
    </Card>
  );
}

