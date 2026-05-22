"use client";

import { useCallback, useState } from "react";
import { Upload, FileSpreadsheet, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants, Button } from "@/components/ui/button";

interface FileDropzoneProps {
  accept?: string;
  onFile: (file: File) => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
}

export function FileDropzone({
  accept = ".csv,.xlsx,.xls",
  onFile,
  disabled,
  label = "Drop CSV or Excel file here",
  hint = "Supports .csv, .xlsx, .xls",
}: FileDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleFile = useCallback(
    (f: File) => {
      setFile(f);
      onFile(f);
    },
    [onFile]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const clear = () => setFile(null);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        "relative rounded-xl border-2 border-dashed p-8 text-center transition-colors",
        dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
        disabled && "opacity-50 pointer-events-none"
      )}
    >
      {file ? (
        <div className="flex items-center justify-center gap-3">
          <FileSpreadsheet className="h-8 w-8 text-primary" />
          <div className="text-left">
            <p className="font-medium text-sm">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={clear}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <>
          <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium text-sm mb-1">{label}</p>
          <p className="text-xs text-muted-foreground mb-4">{hint}</p>
          <label>
            <input
              type="file"
              accept={accept}
              className="hidden"
              disabled={disabled}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <span className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "cursor-pointer")}>Browse files</span>
          </label>
        </>
      )}
    </div>
  );
}

export function downloadCsvTemplate() {
  const headers = [
    "s_no",
    "name",
    "email",
    "college",
    "branch",
    "cgpa",
    "best_ai_project",
    "research_work",
    "github_url",
    "resume_url",
    "test_la",
    "test_code",
  ];
  const csv = headers.join(",") + "\n";
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "candidate_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}
