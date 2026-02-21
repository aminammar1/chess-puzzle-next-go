"use client";

import { motion } from "framer-motion";

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
  index?: number;
}

export default function FeatureCard({ icon, title, description, index = 0 }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="group rounded-xl border border-white/[0.05] bg-white/[0.02] p-5 text-center backdrop-blur-sm transition-all duration-300 hover:border-white/[0.1] hover:bg-white/[0.04] hover:shadow-lg hover:shadow-black/10"
    >
      <div className="mb-3 text-2xl transition-transform duration-300 group-hover:scale-110">
        {icon}
      </div>
      <h4 className="font-serif text-sm font-semibold text-[var(--text-primary)]">{title}</h4>
      <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)]">{description}</p>
    </motion.div>
  );
}
