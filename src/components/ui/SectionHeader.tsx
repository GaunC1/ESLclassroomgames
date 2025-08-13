import React from "react";

type SectionHeaderProps = {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
};

export function SectionHeader({ title, onBack, right }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {onBack && (
          <button className="underline text-sm" onClick={onBack}>
            Back
          </button>
        )}
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      {right}
    </div>
  );
}

