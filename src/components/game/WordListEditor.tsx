"use client";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";

export function WordListEditor({ words, onChange, accent }: { words: string[]; onChange: (w: string[]) => void; accent?: string }) {
  const [word, setWord] = useState("");
  const add = (w: string) => {
    const v = w.trim();
    if (!v) return;
    const next = Array.from(new Set([...(words || []), v]));
    onChange(next);
  };
  const remove = (w: string) => onChange((words || []).filter((t) => t !== w));
  const clear = () => onChange([]);
  return (
    <Card className="space-y-3" accent={accent}>
      <div className="flex items-center gap-2">
        <Input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(word);
              setWord("");
            }
          }}
          placeholder="Add a word and press Enter"
          className="flex-1"
        />
        <Button size="sm" variant="secondary" onClick={() => { add(word); setWord(""); }}>Add</Button>
        <Button size="sm" onClick={clear}>Clear</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(words || []).map((t) => (
          <Tag key={t} onRemove={() => remove(t)}>{t}</Tag>
        ))}
      </div>
    </Card>
  );
}

