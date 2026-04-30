import React, { useEffect, useRef, useState } from 'react';
import { Terminal as TerminalIcon, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';

export function Terminal({ logs, isRunning, wordlist = [] }) {
  const resultRef = useRef(null);
  const workerRef = useRef(null);
  const [displayLogs, setDisplayLogs] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (logs.length > 0) {
      setDisplayLogs(prev => {
        const combined = [...prev, ...logs].slice(-100);
        return combined;
      });
    }
  }, [logs]);

  useEffect(() => {
    if (!isRunning) {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      setIsProcessing(false);
      return;
    }

    if (isProcessing) return;

    setIsProcessing(true);
    
    workerRef.current = new Worker('/terminalWorker.js');
    workerRef.current.postMessage({ 
      wordlist, 
      isRunning: true,
      batchSize: 10
    });

    workerRef.current.onmessage = (e) => {
      if (e.data.type === 'BATCH') {
        const batch = e.data.batch;
        setDisplayLogs(prev => {
          const next = [...prev, ...batch].slice(-100);
          return next;
        });
      }
    };

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      setIsProcessing(false);
    };
  }, [isRunning, wordlist]);

  const handleScroll = () => {
    const el = resultRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 10;
    setAutoScroll(isAtBottom);
  };

  useEffect(() => {
    if (autoScroll && resultRef.current) {
      resultRef.current.scrollTop = resultRef.current.scrollHeight;
    }
  }, [displayLogs, autoScroll]);

  return (
    <div 
        ref={resultRef}
        onScroll={handleScroll}
        className="flex-1 p-6 font-mono text-xs space-y-2 scrollbar-thin bg-black/5 relative result-container h-[400px]"
      >
        {displayLogs.map((log, i) => (
          <div key={i} className="flex gap-4 group relative z-10">
            <span className="text-text-secondary/50 whitespace-nowrap font-medium select-none tabular-nums">[{log.timestamp}]</span>
            <div className={cn(
              "flex items-start gap-2",
              log.type === 'SUCCESS' ? "text-primary font-bold" : 
              log.type === 'ERROR' ? "text-red-500 font-bold" : 
              log.type === 'INFO' ? "text-secondary font-medium" : 
              log.type === 'TRY' ? "text-text-secondary/40 italic" : "text-text-primary/80"
            )}>
              <span className="font-bold opacity-30 group-hover:opacity-100 transition-opacity select-none">&gt;</span>
              <span className="tracking-wide whitespace-pre-wrap">{log.message}</span>
            </div>
          </div>
        ))}
        
        {displayLogs.length === 0 && (
          <div className="text-text-secondary/60 italic flex items-center gap-2">
            <ChevronRight className="w-4 h-4 animate-pulse" />
            Waiting for process to start...
          </div>
        )}

        <div className="flex items-center gap-2 text-text-primary/40 pt-2 group relative z-10">
          <ChevronRight className="w-4 h-4" />
          <div className="w-2 h-4 bg-text-primary/40 animate-pulse cursor-blink" />
        </div>
      </div>
  );
}
