import React from 'react';
import { Shield, Activity, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

export function Header({ status }) {
  const getStatusConfig = () => {
    switch (status) {
      case 'running': return { icon: Activity, color: 'text-cyan-400', label: 'Processing', animate: 'animate-pulse' };
      case 'completed': return { icon: CheckCircle2, color: 'text-green-400', label: 'Completed', animate: '' };
      case 'failed': return { icon: AlertCircle, color: 'text-red-400', label: 'Failed', animate: '' };
      default: return { icon: Shield, color: 'text-primary', label: 'Ready', animate: '' };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <header className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-primary/20 border border-primary/30">
          <Shield className="w-8 h-8 text-primary shadow-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Pass<span className="text-primary">Crack</span>
          </h1>
          <p className="text-white/50 text-sm">Advanced password recovery tool</p>
        </div>
      </div>
      
      <div className={cn(
        "flex items-center gap-3 px-5 py-2 rounded-full border bg-white/5 transition-all duration-500",
        config.color.replace('text-', 'border-').replace('400', '400/30'),
        config.color
      )}>
        <Icon className={cn("w-5 h-5", config.animate)} />
        <span className="font-semibold text-sm tracking-wider uppercase">{config.label}</span>
      </div>
    </header>
  );
}
