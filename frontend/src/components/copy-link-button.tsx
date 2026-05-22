"use client";

import { useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface CopyLinkButtonProps {
  url: string;
  label?: string;
}

export function CopyLinkButton({ url, label = "Copy link" }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={url} readOnly className="pl-9 font-mono text-xs" />
      </div>
      <Button type="button" variant="outline" onClick={handleCopy} className="shrink-0">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        <span className="ml-2 hidden sm:inline">{copied ? "Copied" : label}</span>
      </Button>
    </div>
  );
}
