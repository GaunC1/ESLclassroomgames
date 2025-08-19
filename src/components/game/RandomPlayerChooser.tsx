"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";

export type RandomCandidate = {
  id: number;
  label: string;
  color?: string;
};

export function RandomPlayerChooser({
  candidates,
  pickedBefore,
  onChosen,
  durationMs = 3500,
  holdMs = 1000,
  height = 320,
  weightsById,
}: {
  candidates: RandomCandidate[];
  pickedBefore?: Set<number>;
  onChosen: (id: number) => void;
  durationMs?: number;
  holdMs?: number;
  height?: number;
  // Optional explicit weights (higher = more likely)
  weightsById?: Record<number, number>;
}) {
  const [progress, setProgress] = useState<number>(0);

  const startRef = useRef(0);
  const distRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const durRef = useRef<number>(durationMs);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  // Weighted random: use provided weights if given; otherwise weight 2 if never picked, else 1
  const pickWeighted = useCallback((): number | null => {
    if (!candidates.length) return null;
    const weights = candidates.map((c) => {
      if (weightsById && typeof weightsById[c.id] === 'number') {
        const w = weightsById[c.id];
        return Number.isFinite(w) && w > 0 ? w : 1;
      }
      return pickedBefore?.has(c.id) ? 1 : 2;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < candidates.length; i++) {
      r -= weights[i];
      if (r <= 0) return candidates[i].id;
    }
    return candidates[candidates.length - 1].id;
  }, [candidates, pickedBefore, weightsById]);

  useEffect(() => {
    if (!candidates.length) return;

    const ids = candidates.map((c) => c.id);
    const len = ids.length;
    const targetId = pickWeighted();
    if (targetId == null) return;
    const targetPos = ids.indexOf(targetId);

    // Start in the middle of a row for cleaner centering
    const start = Math.random() * len;
    const startFrac = start - Math.floor(start);
    const startFloor = Math.floor(start) % len;
    const stepsToTarget = (targetPos - startFloor + len) % len;
    const cycles = 2 * len; // total cycles through the list
    const distance = cycles + stepsToTarget - startFrac;

    startRef.current = start + 0.5;
    distRef.current = distance;
    durRef.current = durationMs;
    startTimeRef.current = null;

    function decel(u: number) {
      return 2 * u - u * u; // integrated linear decel
    }

    function tick(ts: number) {
      if (startTimeRef.current == null) startTimeRef.current = ts;
      const elapsed = ts - (startTimeRef.current ?? 0);
      const u = Math.min(1, elapsed / (durRef.current || 1));
      const factor = decel(u);
      const prog = (startRef.current || 0) + (distRef.current || 0) * factor;
      setProgress(prog);
      if (u < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        const finalProg = (startRef.current || 0) + (distRef.current || 0);
        setProgress(finalProg);
        const centerIndex = ((Math.floor(finalProg) % len) + len) % len;
        const landedId = ids[centerIndex];
        // Small hold to showcase the selected row
        timeoutRef.current = window.setTimeout(() => onChosen(landedId), holdMs);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current);
      rafRef.current = null;
      timeoutRef.current = null;
    };
  }, [candidates, durationMs, holdMs, onChosen, pickWeighted]);

  if (!candidates.length) return null;

  const H = height;
  const rowH = 42;
  const centerY = H / 2;
  const ids = candidates.map((c) => c.id);
  const len = ids.length;
  const REPEAT = 40;
  const total = len * REPEAT;
  const sequence = Array.from({ length: total }, (_, i) => ids[i % len]);
  const translateY = centerY - progress * rowH;

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="absolute inset-0" />
      <Card className="relative max-w-md w-[min(92vw,640px)] m-4">
        <div className="relative overflow-hidden" style={{ height: H }}>
          {/* Center band */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-10 border-y border-emerald-400/60 pointer-events-none" />
          {/* Top/bottom gradient fades */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/90 to-white/0" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/90 to-white/0" />
          <div className="absolute inset-0 overflow-hidden">
            <div className="will-change-transform" style={{ transform: `translateY(${translateY}px)` }}>
              {sequence.map((id, i) => {
                const team = candidates.find((c) => c.id === id)!;
                const deltaRows = Math.abs(i - progress);
                const isCenter = deltaRows < 0.5;
                const scale = isCenter ? 1.12 : 1;
                const glow = isCenter ? "0 0 0 3px rgba(16,185,129,0.45)" : undefined;
                const borderColor = isCenter ? "#10b981" : team.color || "#ddd";
                const textColor = isCenter ? "#065f46" : undefined;
                return (
                  <div key={`slot-row-${i}`} className="flex items-center justify-center" style={{ height: rowH }}>
                    <span
                      className="inline-flex items-center gap-2 px-2 py-1 rounded-full border bg-white/95 transition"
                      style={{
                        borderColor,
                        boxShadow: glow,
                        transform: `scale(${scale})`,
                        color: textColor,
                      }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ background: borderColor }} />
                      <span className="truncate max-w-[14rem] sm:max-w-xs font-semibold">{team.label}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
