import React from 'react';
import { Shield, ListTree, ChevronRight, Lock, Terminal } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

export function Home({ onSelectTool }) {
  const tools = [
    {
      id: 'crack',
      name: 'Password Recovery',
      description: 'Quickly recover lost passwords for secured documents and archive files.',
      icon: Lock,
      status: 'operational',
      color: 'text-primary',
      borderColor: 'border-primary/50'
    },
    {
      id: 'wordlist-gen',
      name: 'Password List Creator',
      description: 'Easily generate custom lists of potential passwords to try.',
      icon: ListTree,
      status: 'operational',
      color: 'text-secondary',
      borderColor: 'border-secondary/50'
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 py-12 relative overflow-hidden">
      {/* Background Cyber Grid */}
      <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none" />
      
      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="text-center mb-16 relative z-10"
      >
        <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-primary/5 border border-primary/20 mb-8 backdrop-blur-md">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[11px] font-bold text-primary uppercase tracking-widest">AstraGuard Tools</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-bold text-text-primary mb-6 tracking-tight select-none">
          AstraGuard
        </h1>
        <p className="text-lg text-text-secondary max-w-2xl mx-auto font-medium leading-relaxed">
          Smart Security Tools. Simple Experience.
        </p>
      </motion.div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl relative z-10">
        {tools.map((tool, idx) => (
          <motion.div
            key={tool.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: idx * 0.15, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ y: -4, scale: 1.01 }}
            className={cn(
              "bg-card/50 border rounded-2xl p-10 flex flex-col relative group cursor-pointer overflow-hidden transition-all shadow-sm",
              tool.borderColor, "hover:bg-card hover:shadow-md"
            )}
            onClick={() => onSelectTool(tool.id)}
          >
            <div className={cn(
              "w-16 h-16 rounded-xl flex items-center justify-center mb-8 bg-black/5 border border-[rgba(var(--border))] transition-all duration-300",
              "group-hover:bg-black/10 group-hover:scale-110"
            )}>
              <tool.icon className={cn("w-8 h-8", tool.color)} />
            </div>

            <h3 className="text-2xl font-bold text-text-primary mb-3 tracking-tight group-hover:text-primary transition-colors">{tool.name}</h3>
            <p className="text-sm text-text-secondary leading-relaxed mb-10 flex-1">
              {tool.description}
            </p>

            <div className="flex items-center justify-between mt-auto">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-bold text-text-secondary uppercase tracking-widest">Ready</span>
              </div>
              
              <div className={cn(
                "flex items-center gap-2 font-bold text-xs uppercase tracking-widest transition-all",
                tool.id === 'crack' ? "text-primary" : "text-secondary",
                "group-hover:gap-3"
              )}>
                Start
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Footer Info */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-16 flex items-center gap-8 text-xs font-medium text-text-secondary uppercase tracking-widest opacity-60"
      >
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" />
          <span>Secure Process</span>
        </div>
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4" />
          <span>Local Execution</span>
        </div>
      </motion.div>
    </div>
  );
}
