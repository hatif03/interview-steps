"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TopNInput({
  value,
  onChange,
  max,
  onApply,
  disabled,
  label = "Top",
}: {
  value: number;
  onChange: (n: number) => void;
  max: number;
  onApply: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Label className="text-xs whitespace-nowrap">{label}</Label>
      <Input
        type="number"
        min={1}
        max={Math.max(1, max)}
        value={value}
        onChange={(e) => onChange(Math.max(1, parseInt(e.target.value) || 1))}
        className="h-7 w-14 text-xs"
        disabled={disabled}
      />
      <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={onApply} disabled={disabled}>
        Apply
      </Button>
    </div>
  );
}
