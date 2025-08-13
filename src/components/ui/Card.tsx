import React from "react";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  title?: React.ReactNode;
  actions?: React.ReactNode;
};

export function Card({ title, actions, className = "", children, ...rest }: CardProps) {
  return (
    <div className={["rounded-lg border p-3 sm:p-4 bg-white/70", className].join(" ")} {...rest}>
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

