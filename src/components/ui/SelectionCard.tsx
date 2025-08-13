import React from "react";

type SelectionCardProps = {
  title: string;
  subtitle?: string;
  onClick?: () => void;
};

export function SelectionCard({ title, subtitle, onClick }: SelectionCardProps) {
  return (
    <button
      className="rounded-lg border p-4 bg-white/80 hover:bg-white text-left"
      type="button"
      onClick={onClick}
    >
      <div className="font-semibold mb-1">{title}</div>
      {subtitle && <div className="text-xs text-gray-600">{subtitle}</div>}
    </button>
  );
}

