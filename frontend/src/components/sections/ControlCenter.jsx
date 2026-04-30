import React from 'react';
import { Play, Square, Cpu, Zap, Clock, Settings2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

export function ControlCenter({ 
  job, 
  onStart, 
  onStop, 
  canStart
}) {
  const isRunning = job?.status === 'running';
  const progress = Math.round(job?.progress || 0);

  return (
    <div className="w-full">
      <div className={cn(
        "bg-card/50 border rounded-2xl p-8 relative overflow-hidden transition-all duration-300 shadow-sm",
        isRunning ? "border-primary/50" : "border-[rgba(var(--border))]"
      )}>
        <div className="relative z-10 flex flex-col lg:flex-row gap-12 items-center">
          {/* Circular Progress Ring */}
          <div className="relative w-40 h-40 flex-shrink-0">
            <svg className="w-full h-full progress-ring" viewBox="0 0 100 100">
              <circle
                className="text-text-primary/5"
                strokeWidth="6"
                stroke="currentColor"
                fill="transparent"
                r="40"
                cx="50"
                cy="50"
              />
              <motion.circle
                initial={{ strokeDasharray: "0 251" }}
                animate={{ strokeDasharray: `${(progress * 251) / 100} 251` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="text-primary"
                strokeWidth="6"
                strokeDashcap="round"
                stroke="currentColor"
                fill="transparent"
                r="40"
                cx="50"
                cy="50"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-text-primary leading-none">{progress}<span className="text-sm text-primary">%</span></span>
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mt-2">Progress</span>
            </div>
          </div>

          {/* Controls & Metrics */}
          <div className="flex-1 w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-8">
              <div>
                <h3 className="text-2xl font-bold text-text-primary tracking-tight">Process Control</h3>
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-2 h-2 rounded-full", isRunning ? "bg-primary animate-pulse shadow-[0_0_10px_rgba(var(--primary),0.8)]" : "bg-text-secondary/20")} />
                    <p className="text-text-secondary text-xs font-bold uppercase tracking-widest">{isRunning ? 'Task is running' : 'Ready to start'}</p>
                  </div>
                  {isRunning && (
                    <div className="flex items-center gap-3 px-3 py-1.5 rounded-md bg-black/5 border border-[rgba(var(--border))] w-fit">
                      <div className={cn("w-1.5 h-1.5 rounded-full", job?.source === 'internal' ? "bg-secondary" : "bg-primary")} />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                        Using {job?.source === 'internal' ? 'Default List' : `Custom List (${job?.total || 0} entries)`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex gap-4 w-full md:w-auto">
                {!isRunning ? (
                  <button
                    onClick={onStart}
                    disabled={!canStart}
                    className="cyber-button w-full md:w-auto px-8 py-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <Play className="w-5 h-5 fill-current" />
                      <span>Start Process</span>
                    </div>
                  </button>
                ) : (
                  <button
                    onClick={onStop}
                    className="cyber-button-secondary w-full md:w-auto px-8 py-4 text-sm shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <Square className="w-5 h-5 fill-current" />
                      <span>Stop Process</span>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricBar icon={Zap} label="Speed" value={`${(job?.speed || 0).toLocaleString()} tries/s`} color="text-secondary" />
              <MetricBar 
                icon={Cpu} 
                label="Status" 
                value={`Checked ${job?.processed || 0} / ${job?.total || 0}`} 
                color="text-primary" 
              />
              <MetricBar icon={Clock} label="State" value={isRunning ? "Running..." : (job?.status || "Ready")} color="text-accent-purple" />
              <MetricBar icon={Settings2} label="Current Try" value={job?.current_password || '---'} color="text-text-secondary" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricBar({ icon: Icon, label, value, color }) {
  return (
    <div className="p-4 rounded-xl bg-black/5 border border-[rgba(var(--border))] group hover:bg-black/10 transition-all">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn("w-4 h-4", color)} />
        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">{label}</span>
      </div>
      <div className={cn("text-sm font-medium truncate", color)}>{value}</div>
    </div>
  );
}
