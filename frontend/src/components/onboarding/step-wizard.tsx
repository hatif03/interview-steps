"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { slideInRight } from "@/lib/motion";

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
}

interface StepWizardProps {
  steps: WizardStep[];
  currentStep: number;
  onNext: () => void;
  onBack: () => void;
  onFinish?: () => void;
  children: React.ReactNode;
  isLastStep?: boolean;
  nextLabel?: string;
  finishLabel?: string;
  canProceed?: boolean;
  loading?: boolean;
}

export function StepWizard({
  steps,
  currentStep,
  onNext,
  onBack,
  onFinish,
  children,
  isLastStep,
  nextLabel = "Continue",
  finishLabel = "Finish",
  canProceed = true,
  loading,
}: StepWizardProps) {
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center gap-2 flex-1 min-w-0">
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors",
                  i < currentStep
                    ? "bg-primary text-primary-foreground"
                    : i === currentStep
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {i < currentStep ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <div className="hidden md:block min-w-0">
                <p className={cn("text-xs font-medium truncate", i === currentStep ? "text-foreground" : "text-muted-foreground")}>
                  {step.title}
                </p>
              </div>
              {i < steps.length - 1 && <div className="hidden sm:block flex-1 h-px bg-border mx-2" />}
            </div>
          ))}
        </div>
        <Progress value={progress} className="h-1.5" />
        <div>
          <h2 className="text-xl font-semibold">{steps[currentStep]?.title}</h2>
          {steps[currentStep]?.description && (
            <p className="text-sm text-muted-foreground mt-1">{steps[currentStep].description}</p>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={slideInRight.initial}
          animate={slideInRight.animate}
          exit={slideInRight.exit}
          transition={{ duration: 0.25 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>

      <div className="flex justify-between pt-4 border-t">
        <Button type="button" variant="outline" onClick={onBack} disabled={currentStep === 0 || loading}>
          Back
        </Button>
        {isLastStep ? (
          <Button type="button" onClick={onFinish} disabled={!canProceed || loading}>
            {loading ? "Saving..." : finishLabel}
          </Button>
        ) : (
          <Button type="button" onClick={onNext} disabled={!canProceed || loading}>
            {nextLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
