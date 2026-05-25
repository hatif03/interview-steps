"use client";

import { cn } from "@/lib/utils";

interface SkillSuggestionsProps {
  suggestions: string[];
  selected: string[];
  onToggle: (skill: string) => void;
  label?: string;
}

export function SkillSuggestions({
  suggestions,
  selected,
  onToggle,
  label = "Suggested skills — click to add",
}: SkillSuggestionsProps) {
  const available = suggestions.filter((s) => !selected.includes(s));
  if (available.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {available.map((skill) => (
          <button
            key={skill}
            type="button"
            onClick={() => onToggle(skill)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border border-dashed border-primary/40",
              "text-primary bg-primary/5 hover:bg-primary/15 transition-colors"
            )}
          >
            + {skill}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SelectedSkills({
  skills,
  onRemove,
}: {
  skills: string[];
  onRemove?: (skill: string) => void;
}) {
  if (skills.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {skills.map((skill) => (
        <button
          key={skill}
          type="button"
          onClick={() => onRemove?.(skill)}
          className={cn(
            "text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary",
            onRemove && "hover:bg-primary/20"
          )}
        >
          {skill}
          {onRemove ? " ×" : ""}
        </button>
      ))}
    </div>
  );
}
