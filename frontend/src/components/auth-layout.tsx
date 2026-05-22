"use client";

import { motion } from "framer-motion";
import { Brain, Sparkles } from "lucide-react";

interface AuthLayoutProps {
  children: React.ReactNode;
  variant?: "recruiter" | "candidate";
  title: string;
  subtitle: string;
}

export function AuthLayout({ children, variant = "recruiter", title, subtitle }: AuthLayoutProps) {
  const Icon = variant === "candidate" ? Sparkles : Brain;

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className={`hidden lg:flex flex-col justify-between p-12 ${
          variant === "candidate"
            ? "bg-gradient-to-br from-teal-600 to-emerald-700 text-white"
            : "bg-gradient-to-br from-indigo-600 to-violet-700 text-white"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Icon className="h-5 w-5" />
          </div>
          <span className="font-bold text-lg">
            {variant === "candidate" ? "Career Portal" : "AI Screener"}
          </span>
        </div>
        <div>
          <h1 className="text-3xl font-bold mb-3">{title}</h1>
          <p className="text-white/80 text-lg">{subtitle}</p>
        </div>
        <p className="text-sm text-white/60">Visl AI Labs · Screening Platform</p>
      </motion.div>
      <div className="flex items-center justify-center p-6">{children}</div>
    </div>
  );
}
