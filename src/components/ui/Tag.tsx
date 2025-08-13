import React from "react";

type TagProps = {
  children: React.ReactNode;
  onRemove?: () => void;
};

export function Tag({ children, onRemove }: TagProps) {
  return (
    <span className="chip inline-flex items-center gap-1 text-xs">
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} className="ml-1 px-1 rounded border text-[10px] hover:bg-gray-50">
          ✖
        </button>
      )}
    </span>
  );
}

