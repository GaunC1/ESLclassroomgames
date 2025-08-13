import React from "react";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  accent?: string; // optional top accent color
};

export function Card({ title, actions, accent, className = "", children, ...rest }: CardProps) {
  return (
    <div className={["rounded-lg border p-3 sm:p-4 bg-white/70", className].join(" ")} {...rest}>
      {accent ? (
        <div
          className="h-1 rounded-t -mx-3 -mt-3 sm:-mx-4 sm:-mt-4"
          style={{ backgroundColor: accent }}
        />
      ) : null}
      {(title || actions) && (
        <div className="mb-2 flex items-center justify-between">
          {title ? <div className="text-sm font-medium">{title}</div> : <span />}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}
