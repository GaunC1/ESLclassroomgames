import React from "react";

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextArea({ className = "", ...props }: TextAreaProps) {
  return <textarea className={["w-full min-h-32 rounded border p-3 text-sm", className].join(" ")} {...props} />;
}

