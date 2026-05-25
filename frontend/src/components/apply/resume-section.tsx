"use client";

import { useState } from "react";
import { ExternalLink, FileText, Sparkles } from "lucide-react";
import { FileDropzone } from "@/components/file-dropzone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { isStoredSupabaseResume, resumeDisplayLabel } from "@/lib/apply-form";

interface ResumeSectionProps {
  resumeUrl?: string;
  resumeText?: string;
  uploading: boolean;
  parsedHint?: boolean;
  onUpload: (file: File) => void;
  onExtractFromUrl: (url: string) => void;
  onClear: () => void;
  onResumeUrlChange: (url: string) => void;
}

export function ResumeSection({
  resumeUrl,
  resumeText,
  uploading,
  parsedHint,
  onUpload,
  onExtractFromUrl,
  onClear,
  onResumeUrlChange,
}: ResumeSectionProps) {
  const [replacing, setReplacing] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const hasResume = !!(resumeUrl?.trim() || resumeText?.trim());

  const handleProcessLink = () => {
    const url = linkInput.trim() || resumeUrl?.trim() || "";
    if (!url) return;
    onExtractFromUrl(url);
  };

  if (hasResume && !replacing) {
    const label = resumeDisplayLabel(resumeUrl);
    const canOpen = resumeUrl && !isStoredSupabaseResume(resumeUrl);

    return (
      <div className="space-y-3">
        <Label>Resume</Label>
        <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
          <FileText className="h-8 w-8 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-1">
            <p className="font-medium text-sm">{label}</p>
            {canOpen ? (
              <a
                href={resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
              >
                View resume <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">
                PDF stored securely for recruiter review
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => setReplacing(true)}
          >
            Replace
          </Button>
        </div>
        {parsedHint && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
            <Sparkles className="size-4 shrink-0" />
            We pre-filled what we could from your resume — review the fields below.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Resume</Label>
        <p className="text-xs text-muted-foreground mt-1 mb-3">
          Upload your resume first — we&apos;ll pre-fill your application details where possible.
        </p>
      </div>

      <FileDropzone
        accept=".pdf,application/pdf"
        label="Drop your resume PDF here"
        hint="PDF is stored securely for recruiters to review"
        disabled={uploading}
        onFile={onUpload}
        onClear={() => {
          onClear();
          setLinkInput("");
          if (replacing) setReplacing(false);
        }}
      />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Or paste a link</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="apply-resume-link">Google Drive or PDF link</Label>
        <div className="flex gap-2">
          <Input
            id="apply-resume-link"
            value={linkInput || resumeUrl || ""}
            onChange={(e) => {
              setLinkInput(e.target.value);
              onResumeUrlChange(e.target.value);
            }}
            placeholder="https://drive.google.com/..."
            disabled={uploading}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={uploading || !(linkInput.trim() || resumeUrl?.trim())}
            onClick={handleProcessLink}
          >
            {uploading ? "Processing..." : "Process"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Drive links are fetched when you process. Uploads are stored in Supabase immediately.
        </p>
      </div>

      {replacing && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={uploading}
          onClick={() => setReplacing(false)}
        >
          Cancel replace
        </Button>
      )}

      {parsedHint && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
          <Sparkles className="size-4 shrink-0" />
          Resume processed — review pre-filled fields below.
        </div>
      )}
    </div>
  );
}
