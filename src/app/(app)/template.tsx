"use client";

import { motion } from "motion/react";

/** Route transition: a short fade-and-rise each time a page mounts. */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}
