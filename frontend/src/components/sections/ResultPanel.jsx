import React, { useState } from 'react';
import { Trophy, Copy, Check, ExternalLink, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';

export function ResultPanel({ job, onDismiss }) {
  const [copied, setCopied] = useState(false);

  if (!job || job.status !== 'completed' || !job.result) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(job.result.password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      >
        <div className="os-window max-w-md w-full border-primary/50 relative overflow-hidden shadow-xl">
          <div className="os-window-header bg-primary/10 text-primary border-primary/20">
            <span>Success</span>
          </div>
          <div className="os-window-body p-8">
            <div className="text-center relative z-10">
              <div className="inline-flex p-4 rounded-full bg-primary/10 text-primary mb-6">
                <ShieldCheck className="w-12 h-12" />
              </div>
              
              <h2 className="text-3xl font-bold text-text-primary mb-2">Password Found!</h2>
              <p className="text-text-secondary text-sm mb-8 font-medium">Verified match found in the list</p>

              <div className="relative group mb-8">
                <div className="relative flex items-center justify-between bg-black/5 border border-[rgba(var(--border))] rounded-xl p-6 hover:bg-black/10 transition-colors">
                  <span className="text-2xl font-mono font-bold text-primary tracking-widest break-all">
                    {job.result.password}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="ml-4 p-3 rounded-lg bg-black/5 hover:bg-black/10 text-text-secondary hover:text-primary transition-all active:scale-95"
                    title="Copy Password"
                  >
                    {copied ? <Check className="w-5 h-5 text-primary" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="text-left bg-black/5 p-4 rounded-xl border border-[rgba(var(--border))]">
                  <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1">Time Elapsed</p>
                  <p className="text-lg font-medium text-text-primary">{(job.processed / (job.speed || 1)).toFixed(1)}s</p>
                </div>
                <div className="text-left bg-black/5 p-4 rounded-xl border border-[rgba(var(--border))]">
                  <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1">Total Tries</p>
                  <p className="text-lg font-medium text-text-primary">{job.processed.toLocaleString()}</p>
                </div>
              </div>

              <button
                onClick={onDismiss}
                className="w-full py-4 rounded-xl font-bold bg-black/5 border border-[rgba(var(--border))] text-text-secondary hover:text-text-primary hover:bg-black/10 transition-all shadow-sm"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
