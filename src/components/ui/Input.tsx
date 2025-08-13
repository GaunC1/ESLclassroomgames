import React from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", ...props }: InputProps) {
  return <input className={["rounded border px-2 py-1 text-sm", className].join(" ")} {...props} />;
}

