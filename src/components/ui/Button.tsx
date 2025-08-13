"use client";

import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md";
};

export function Button({ variant = "outline", size = "md", className = "", ...props }: ButtonProps) {
  const base = "rounded transition disabled:opacity-50";
  const pad = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
  const styles =
    variant === "primary"
      ? "btn-fun-primary"
      : variant === "secondary"
      ? "btn-fun-secondary"
      : variant === "ghost"
      ? ""
      : "border hover:bg-gray-50";
  return <button className={[base, pad, styles, className].filter(Boolean).join(" ")} {...props} />;
}

