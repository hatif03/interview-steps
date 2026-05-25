"use client";

import dynamic from "next/dynamic";

const Monaco = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export function CodeEditor({
  value,
  onChange,
  language = "python",
  height = 240,
}: {
  value: string;
  onChange: (v: string) => void;
  language?: string;
  height?: number;
}) {
  return (
    <div className="rounded-md border overflow-hidden">
      <Monaco
        height={height}
        language={language}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          scrollBeyondLastLine: false,
          wordWrap: "on",
        }}
      />
    </div>
  );
}
