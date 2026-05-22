"use client";

import { motion } from "framer-motion";
import { Brain, Sparkles, CheckCircle2 } from "lucide-react";
import { RoleSwitcher } from "@/components/auth/role-switcher";

interface AuthLayoutProps {
  children: React.ReactNode;
  variant?: "recruiter" | "candidate";
  title: string;
  subtitle: string;
  features: string[];
}

export function AuthLayout({
  children,
  variant = "recruiter",
  title,
  subtitle,
  features,
}: AuthLayoutProps) {
  const Icon = variant === "candidate" ? Sparkles : Brain;
  const brandName = variant === "candidate" ? "Career Portal" : "AI Screener";

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2">
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="hidden lg:flex flex-col justify-between p-12 text-white relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, var(--brand-gradient-from), var(--brand-gradient-to))`,
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_50%)]" />
        <div className="relative flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
            <Icon className="h-5 w-5" />
          </div>
          <span className="font-semibold text-lg">{brandName}</span>
        </div>
        <div className="relative space-y-6 max-w-md">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-3">{title}</h1>
            <p className="text-white/85 text-lg leading-relaxed">{subtitle}</p>
          </div>
          <ul className="space-y-3">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm text-white/90">
                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 opacity-90" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/60">Visl AI Labs · Screening Platform</p>
      </motion.div>

      <div className="min-h-screen bg-background flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-16">
        <div className="w-full max-w-md mx-auto space-y-8">
          <div className="lg:hidden flex items-center gap-2 mb-2">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <Icon className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">{brandName}</span>
          </div>
          <RoleSwitcher />
          {children}
        </div>
      </div>
    </div>
  );
}
