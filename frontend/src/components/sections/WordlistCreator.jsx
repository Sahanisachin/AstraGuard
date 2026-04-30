import React, { useState, useEffect, useRef } from 'react';
import { ListTree, Play, Square, Download, Activity, Zap, Cpu, Settings2, Trash2, Repeat, Fingerprint, FileText, ShieldAlert, Terminal as TerminalIcon, AlertTriangle, Pause, RefreshCw } from 'lucide-react';
import { cn } from '../../utils/cn';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

export function WordlistCreator({ onBack, onUseWordlist }) {
  const [generationMode, setGenerationMode] = useState('basic'); // 'basic', 'advanced', 'structured', 'mutate'
  const [structuredSubMode, setStructuredSubMode] = useState('date'); // 'date', 'numeric'
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  const [config, setConfig] = useState({
    min_len: 1,
    max_len: 8,
    charset: 'abcdefghijklmnopqrstuvwxyz0123456789',
    custom_charset: '',
    pattern: '',
    limit: 10000,
    mode: 'brute',
    filename: 'generated_wordlist.txt',
    base_string: '',
    startDate: '2000-01-01',
    endDate: '2010-01-01',
    dateFormats: ['DDMMYYYY', 'YYYYMMDD'],
    numPrefix: '',
    numSuffix: '',
    max_repeat: '',
    max_consecutive: '',
    require_letter: false,
    require_number: false,
    no_sequential: false,
    pattern_string: ''
  });

  const [job, setJob] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [generatedContent, setGeneratedContent] = useState('');
  const [generatedCount, setGeneratedCount] = useState(0);
  
  const terminalRef = useRef(null);
  const workerRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  useEffect(() => {
    return () => {
      if (workerRef.current) workerRef.current.terminate();
    };
  }, []);

  const addTerminalLog = (message, type = 'INFO') => {
    setTerminalLogs(prev => [...prev.slice(-99), { 
      timestamp: new Date().toLocaleTimeString(), 
      message, 
      type 
    }]);
  };

  const calculateTheoreticalTotal = () => {
    const n = ((config.charset || '') + (config.custom_charset || '')).length;
    if (n === 0) return 0;
    let total = 0;
    if (config.mode === 'permutation') {
      const factorial = (num) => (num <= 1 ? 1 : num * factorial(num - 1));
      const perm = (n, r) => (r > n ? 0 : factorial(n) / factorial(n - r));
      for (let r = config.min_len; r <= config.max_len; r++) {
        if (r <= n) total += perm(n, r);
      }
    } else {
      for (let r = config.min_len; r <= config.max_len; r++) {
        total += Math.pow(n, r);
      }
    }
    return total;
  };

  const theoreticalTotal = calculateTheoreticalTotal();

  const startBasicGeneration = async () => {
    if (!config.base_string) {
      addTerminalLog('Error: Base word is required for Basic Mode', 'ERROR');
      return;
    }
    setIsGenerating(true);
    setTerminalLogs([]);
    addTerminalLog('Starting Basic Generation...', 'INFO');
    
    const results = new Set();
    const base = config.base_string;
    const charset = (config.charset + config.custom_charset) || "abcdefghijklmnopqrstuvwxyz0123456789";
    
    try {
      results.add(base);
      results.add(base.toLowerCase());
      results.add(base.toUpperCase());
      const range = config.max_len - config.min_len + 1;
      const itemsPerLength = Math.max(50, Math.floor(1000 / range)); 
      
      for (let len = config.min_len; len <= Math.min(config.max_len, 12); len++) {
        for (let i = 0; i < itemsPerLength; i++) {
          let word = base;
          if (word.length > len) word = word.slice(0, len);
          while (word.length < len) word += charset[Math.floor(Math.random() * charset.length)];
          results.add(word);
          if (results.size >= 2000) break;
        }
        if (results.size >= 2000) break;
        await new Promise(r => setTimeout(r, 0));
      }

      const finalContent = Array.from(results).join('\n');
      setGeneratedContent(finalContent);
      setGeneratedCount(results.size);
      setJob({ status: 'completed', progress: 100, processed: results.size, speed: results.size });
      setIsGenerating(false);
      addTerminalLog(`Success: Generated ${results.size} passwords.`, 'SUCCESS');
    } catch (err) {
      addTerminalLog(`Error: ${err.message}`, 'ERROR');
      setIsGenerating(false);
    }
  };

  const startAdvancedGeneration = (bypassConfirmation = false) => {
    if (config.mode === 'pattern' && !config.pattern_string) {
      setError('Please enter at least one pattern');
      return;
    }
    if ((config.mode === 'brute' || config.mode === 'permutation') && !config.custom_charset && !config.charset) {
      setError('Please enter characters or select a set');
      return;
    }
    setError('');

    const total = calculateTheoreticalTotal();
    if (total > 1000000 && !bypassConfirmation && !config.limit) {
      setShowConfirmModal(true);
      return;
    }
    setShowConfirmModal(false);

    setIsGenerating(true);
    setIsPaused(false);
    setTerminalLogs([]);
    addTerminalLog('Starting Advanced Generation...', 'INFO');
    addTerminalLog(`Mode: ${config.mode.toUpperCase()}`, 'INFO');
    
    if (workerRef.current) workerRef.current.terminate();
    workerRef.current = new Worker('/generationWorker.js');

    workerRef.current.onmessage = (e) => {
      const { action, count, speed, content, status } = e.data;
      if (action === 'progress') {
        setJob(prev => ({ 
          ...prev, 
          processed: count, 
          speed, 
          progress: config.limit ? (count / config.limit * 100) : 50 
        }));
        if (count % 10000 === 0) {
          addTerminalLog(`Generated ${count.toLocaleString()} passwords...`, 'INFO');
        }
      } else if (action === 'complete') {
        setGeneratedContent(content);
        setGeneratedCount(count);
        setJob({ status: 'completed', progress: 100, processed: count, speed: 0 });
        setIsGenerating(false);
        addTerminalLog(`Success: Generated ${count.toLocaleString()} passwords.`, 'SUCCESS');
      } else if (action === 'status' && status === 'stopped') {
        setIsGenerating(false);
        addTerminalLog('Process stopped by user.', 'ERROR');
      } else if (action === 'error') {
        setIsGenerating(false);
        addTerminalLog(`Error: ${e.data.message}`, 'ERROR');
        setError(e.data.message);
      }
    };

    const fullCharset = (config.charset + config.custom_charset) || "";
    workerRef.current.postMessage({ 
      action: 'start', 
      config: { 
        ...config, 
        charset: fullCharset, 
        limit: config.limit ? parseInt(config.limit) : null 
      } 
    });

    setJob({ id: 'worker', status: 'running', progress: 0, processed: 0, speed: 0 });
  };

  const togglePause = () => {
    if (!workerRef.current) return;
    const nextState = !isPaused;
    setIsPaused(nextState);
    workerRef.current.postMessage({ action: nextState ? 'pause' : 'resume' });
    addTerminalLog(nextState ? 'Process paused.' : 'Process resumed.', 'INFO');
  };

  const stopGeneration = () => {
    if (workerRef.current) {
      workerRef.current.postMessage({ action: 'stop' });
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setIsGenerating(false);
    setIsPaused(false);
    addTerminalLog('Process stopped.', 'ERROR');
  };

  const startStructuredGeneration = async () => {
    setIsGenerating(true);
    setTerminalLogs([]);
    addTerminalLog(`Starting Structured Generation [${structuredSubMode.toUpperCase()}]...`, 'INFO');
    
    const results = new Set();
    const prefix = config.numPrefix || '';
    const suffix = config.numSuffix || '';

    try {
      if (structuredSubMode === 'date') {
        let current = new Date(config.startDate);
        const end = new Date(config.endDate);
        while (current <= end) {
          const dd = String(current.getDate()).padStart(2, "0");
          const mm = String(current.getMonth() + 1).padStart(2, "0");
          const yyyy = current.getFullYear();
          config.dateFormats.forEach(fmt => {
            let formatted;
            if (fmt === "DDMMYYYY") formatted = `${dd}${mm}${yyyy}`;
            else if (fmt === "YYYYMMDD") formatted = `${yyyy}${mm}${dd}`;
            else if (fmt === "DD-MM-YYYY") formatted = `${dd}-${mm}-${yyyy}`;
            else if (fmt === "DD/MM/YYYY") formatted = `${dd}/${mm}/${yyyy}`;
            else formatted = `${mm}${dd}${yyyy}`;
            results.add(prefix + formatted + suffix);
          });
          current.setDate(current.getDate() + 1);
          if (results.size >= 5000) break;
        }
      } else {
        for (let len = config.min_len; len <= Math.min(config.max_len, 10); len++) {
          for (let i = 0; i < 500; i++) {
            let num = "";
            for (let j = 0; j < len; j++) num += Math.floor(Math.random() * 10);
            results.add(prefix + num + suffix);
          }
          if (results.size >= 5000) break;
          await new Promise(r => setTimeout(r, 0));
        }
      }
      const finalContent = Array.from(results).join('\n');
      setGeneratedContent(finalContent);
      setGeneratedCount(results.size);
      setJob({ status: 'completed', progress: 100, processed: results.size, speed: results.size });
      setIsGenerating(false);
      addTerminalLog(`Success: Generated ${results.size} passwords.`, 'SUCCESS');
    } catch (err) {
      addTerminalLog(`Error: ${err.message}`, 'ERROR');
      setIsGenerating(false);
    }
  };

  const downloadWordlist = () => {
    const blob = new Blob([generatedContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = config.filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-in fade-in duration-500 relative">
      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card border border-[rgba(var(--border))] rounded-2xl p-8 max-w-md shadow-xl">
              <div className="flex items-center gap-4 mb-6 text-yellow-500">
                <AlertTriangle className="w-10 h-10" />
                <h3 className="text-xl font-bold">Large List Warning</h3>
              </div>
              <p className="text-text-secondary text-sm mb-8 leading-relaxed">
                This setup will generate approximately <span className="text-text-primary font-bold">{theoreticalTotal.toLocaleString()}</span> passwords. 
                This might use a lot of memory and slow down your browser.
              </p>
              <div className="flex gap-4">
                <button onClick={() => setShowConfirmModal(false)} className="flex-1 py-3 rounded-lg bg-black/5 hover:bg-black/10 border border-[rgba(var(--border))] text-text-secondary font-medium transition-all text-sm">Cancel</button>
                <button onClick={() => startAdvancedGeneration(true)} className="flex-1 py-3 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white font-medium transition-all text-sm shadow-sm">Continue Anyway</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mode Selector */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-none">
        {['basic', 'advanced', 'structured'].map(m => (
          <button 
            key={m}
            onClick={() => setGenerationMode(m)}
            className={cn(
              "flex-1 min-w-[140px] py-3 rounded-xl font-bold text-xs transition-all border",
              generationMode === m ? "bg-primary/10 border-primary/30 text-primary shadow-sm" : "bg-black/5 border-[rgba(var(--border))] text-text-secondary hover:bg-black/10"
            )}
          >
            {m === 'basic' ? 'Basic' : m === 'advanced' ? 'Advanced Options' : 'Structured (Dates/Numbers)'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Panel: Config */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card border border-[rgba(var(--border))] rounded-[12px] p-6 shadow-sm">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-2.5 rounded-lg bg-secondary/10 border border-secondary/20">
                <Settings2 className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-primary">Settings</h3>
                <p className="text-xs font-medium text-text-secondary">Password Rules</p>
              </div>
            </div>

            <div className="space-y-6">
              {generationMode === 'basic' && (
                <>
                  <div>
                    <label className="text-xs font-bold text-text-secondary block mb-2">Base Word</label>
                    <input type="text" value={config.base_string} onChange={(e) => setConfig({...config, base_string: e.target.value})} placeholder="e.g. Admin" className="w-full bg-black/5 border border-[rgba(var(--border))] rounded-lg px-4 py-3 text-text-primary text-sm outline-none focus:border-primary/50 transition-colors" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold text-text-secondary block mb-2">Min Length</label><input type="number" value={config.min_len} onChange={(e) => setConfig({...config, min_len: parseInt(e.target.value)})} className="w-full bg-black/5 border border-[rgba(var(--border))] rounded-lg p-3 text-text-primary text-sm focus:border-primary/50 transition-colors outline-none" /></div>
                    <div><label className="text-xs font-bold text-text-secondary block mb-2">Max Length</label><input type="number" value={config.max_len} onChange={(e) => setConfig({...config, max_len: parseInt(e.target.value)})} className="w-full bg-black/5 border border-[rgba(var(--border))] rounded-lg p-3 text-text-primary text-sm focus:border-primary/50 transition-colors outline-none" /></div>
                  </div>
                </>
              )}

              {generationMode === 'advanced' && (
                <div className="space-y-6 animate-in fade-in duration-500">
                  <div className="flex gap-2 p-1 bg-black/5 rounded-lg border border-[rgba(var(--border))]">
                    {['brute', 'pattern'].map(m => (
                      <button 
                        key={m} 
                        onClick={() => setConfig({...config, mode: m})} 
                        className={cn(
                          "flex-1 py-2 rounded-md text-xs font-bold transition-all",
                          config.mode === m ? "bg-card shadow-sm text-text-primary border border-[rgba(var(--border))]" : "text-text-secondary hover:text-text-primary"
                        )}
                      >
                        {m === 'brute' ? 'Try All Combinations' : 'Use Specific Pattern'}
                      </button>
                    ))}
                  </div>

                  {/* Section 1: Custom Characters */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Fingerprint className="w-4 h-4 text-accent-purple" />
                      <label className="text-xs font-bold text-text-primary">1. Characters to use</label>
                    </div>
                    <div className="relative group">
                      <input 
                        type="text" 
                        value={config.custom_charset} 
                        onChange={(e) => setConfig({...config, custom_charset: e.target.value})} 
                        placeholder="e.g. Admin123!@#" 
                        className="w-full bg-black/5 border border-[rgba(var(--border))] rounded-xl px-4 py-3 text-text-primary outline-none font-mono text-sm focus:border-accent-purple/50 transition-all placeholder:text-text-secondary/50" 
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                        {['a-z', '0-9', '!@#'].map(set => (
                          <button 
                            key={set} 
                            onClick={() => {
                              const vals = set === 'a-z' ? 'abcdefghijklmnopqrstuvwxyz' : set === '0-9' ? '0123456789' : '!@#$%^&*';
                              setConfig({ ...config, custom_charset: config.custom_charset + vals });
                            }}
                            className="px-2 py-1 rounded bg-black/10 hover:bg-black/20 border border-[rgba(var(--border))] text-[10px] font-medium text-text-secondary hover:text-text-primary transition-all uppercase"
                          >
                            +{set}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Pattern Builder */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <ListTree className="w-4 h-4 text-accent-purple" />
                      <label className="text-xs font-bold text-text-primary">2. Pattern</label>
                    </div>
                    <textarea 
                      value={config.pattern_string} 
                      onChange={(e) => setConfig({...config, pattern_string: e.target.value})} 
                      placeholder={"e.g. Pass!@XXXX\nAdminAAAA\n****_2024"} 
                      className="w-full bg-black/5 border border-[rgba(var(--border))] rounded-xl px-4 py-3 text-text-primary outline-none font-mono text-sm min-h-[100px] focus:border-accent-purple/50 transition-all placeholder:text-text-secondary/50 leading-relaxed"
                    />
                    <div className="grid grid-cols-1 gap-2 px-1">
                      <div className="space-y-1">
                        <p className="text-[10px] text-text-secondary font-bold">Shortcuts:</p>
                        <div className="flex flex-wrap gap-3">
                          <span className="text-[10px] text-text-secondary font-mono bg-black/5 px-1 rounded">X = 0-9</span>
                          <span className="text-[10px] text-text-secondary font-mono bg-black/5 px-1 rounded">A = A-Z</span>
                          <span className="text-[10px] text-text-secondary font-mono bg-black/5 px-1 rounded">a = a-z</span>
                          <span className="text-[10px] text-text-secondary font-mono bg-black/5 px-1 rounded">* = Any</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Smart Generation Rules / Advanced Settings */}
                  <div className="pt-4 border-t border-[rgba(var(--border))] space-y-4">
                    <button 
                      onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} 
                      className="flex items-center justify-between w-full p-3 rounded-lg bg-black/5 hover:bg-black/10 transition-all group border border-transparent hover:border-[rgba(var(--border))]"
                    >
                      <span className="text-xs font-bold text-text-secondary group-hover:text-text-primary transition-colors">More Options</span>
                      <Settings2 className={cn("w-4 h-4 text-text-secondary transition-transform duration-300", showAdvancedFilters && "rotate-180 text-accent-purple")} />
                    </button>

                    <AnimatePresence>
                      {showAdvancedFilters && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }} 
                          animate={{ height: 'auto', opacity: 1 }} 
                          exit={{ height: 0, opacity: 0 }} 
                          className="space-y-4 overflow-hidden"
                        >
                          <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-text-secondary px-1">Total Limit</label>
                              <select 
                                value={config.limit || 'none'} 
                                onChange={(e) => setConfig({...config, limit: e.target.value === 'none' ? null : parseInt(e.target.value)})} 
                                className="w-full bg-black/5 border border-[rgba(var(--border))] rounded-lg px-3 py-2 text-text-primary text-sm outline-none focus:border-accent-purple/30 transition-all"
                              >
                                <option value="1000">1,000 Passwords</option>
                                <option value="10000">10,000 Passwords</option>
                                <option value="100000">100,000 Passwords</option>
                                <option value="none">No Limit (All)</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-text-secondary px-1">Length Range</label>
                              <div className="flex gap-2">
                                <input type="number" placeholder="Min" value={config.min_len} onChange={(e) => setConfig({...config, min_len: parseInt(e.target.value)})} className="w-full bg-black/5 border border-[rgba(var(--border))] rounded-lg p-2 text-text-primary text-sm text-center outline-none" />
                                <input type="number" placeholder="Max" value={config.max_len} onChange={(e) => setConfig({...config, max_len: parseInt(e.target.value)})} className="w-full bg-black/5 border border-[rgba(var(--border))] rounded-lg p-2 text-text-primary text-sm text-center outline-none" />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {generationMode === 'structured' && (
                <div className="space-y-4">
                  <div className="flex p-1 bg-black/5 rounded-lg border border-[rgba(var(--border))]">
                    {['date', 'numeric'].map(m => (
                      <button key={m} onClick={() => setStructuredSubMode(m)} className={cn("flex-1 py-2 rounded-md text-xs font-bold capitalize transition-all", structuredSubMode === m ? "bg-card shadow-sm text-text-primary border border-[rgba(var(--border))]" : "text-text-secondary hover:text-text-primary")}>{m}</button>
                    ))}
                  </div>
                  {structuredSubMode === 'date' ? (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-text-secondary">Start Date</label>
                        <input type="date" value={config.startDate} onChange={(e) => setConfig({...config, startDate: e.target.value})} className="w-full bg-black/5 border border-[rgba(var(--border))] rounded-lg p-3 text-text-primary text-sm outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-text-secondary">End Date</label>
                        <input type="date" value={config.endDate} onChange={(e) => setConfig({...config, endDate: e.target.value})} className="w-full bg-black/5 border border-[rgba(var(--border))] rounded-lg p-3 text-text-primary text-sm outline-none" />
                      </div>
                    </>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-text-secondary">Min Length</label>
                        <input type="number" placeholder="Min" value={config.min_len} onChange={(e) => setConfig({...config, min_len: parseInt(e.target.value)})} className="w-full bg-black/5 border border-[rgba(var(--border))] rounded-lg p-3 text-text-primary text-sm outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-text-secondary">Max Length</label>
                        <input type="number" placeholder="Max" value={config.max_len} onChange={(e) => setConfig({...config, max_len: parseInt(e.target.value)})} className="w-full bg-black/5 border border-[rgba(var(--border))] rounded-lg p-3 text-text-primary text-sm outline-none" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {generationMode !== 'structured' && (
                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-[rgba(var(--border))]">
                  <p className="col-span-2 text-xs font-bold text-text-secondary mb-1">Quick Select Characters</p>
                  {[
                    { name: 'Lowercase (a-z)', val: 'abcdefghijklmnopqrstuvwxyz' },
                    { name: 'Uppercase (A-Z)', val: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
                    { name: 'Numbers (0-9)', val: '0123456789' },
                    { name: 'Symbols (!@#)', val: '!@#$%^&*' }
                  ].map(c => (
                    <button key={c.name} onClick={() => setConfig({ ...config, charset: config.charset.includes(c.val) ? config.charset.replace(c.val, '') : config.charset + c.val })} className={cn("p-2 rounded-lg border text-[10px] font-bold transition-all", config.charset.includes(c.val) ? "border-secondary text-secondary bg-secondary/10" : "border-[rgba(var(--border))] text-text-secondary hover:bg-black/5 hover:text-text-primary")}>
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Output & Terminal */}
        <div className="lg:col-span-2 space-y-6">
          <div className={cn("bg-card border p-8 h-full flex flex-col transition-all duration-300 rounded-[12px] shadow-sm", isGenerating ? "border-primary/50 shadow-md" : "border-[rgba(var(--border))]")}>
            {error && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-xs font-bold text-red-500">{error}</span>
              </motion.div>
            )}

            <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-6">
              <div>
                <h3 className="text-2xl font-bold text-text-primary tracking-tight">Status Display</h3>
                <p className="text-text-secondary text-xs font-medium mt-1">
                  {isGenerating ? (isPaused ? 'Paused' : 'Working...') : 'Ready'}
                </p>
              </div>
              <div className="flex gap-3">
                {!isGenerating ? (
                  <>
                    <button 
                      onClick={() => {
                        if (generationMode === 'basic') startBasicGeneration();
                        else if (generationMode === 'advanced') startAdvancedGeneration();
                        else if (generationMode === 'structured') startStructuredGeneration();
                      }} 
                      className="cyber-button px-8 py-3 font-medium text-sm rounded-lg"
                    >
                      <Play className="w-4 h-4 mr-2 inline" /> Start
                    </button>
                    {(generatedContent || terminalLogs.length > 0) && (
                      <button 
                        onClick={() => {
                          setGeneratedContent('');
                          setGeneratedCount(0);
                          setTerminalLogs([]);
                          setJob(null);
                        }} 
                        className="bg-black/5 border border-[rgba(var(--border))] text-text-secondary px-6 py-3 rounded-lg hover:bg-black/10 hover:text-text-primary transition-all font-medium text-sm"
                      >
                        Clear
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {generationMode === 'advanced' && (
                      <button onClick={togglePause} className="cyber-button-secondary px-6 py-3 rounded-lg text-sm">
                        {isPaused ? <Play className="w-4 h-4 inline" /> : <Pause className="w-4 h-4 inline" />}
                      </button>
                    )}
                    <button onClick={stopGeneration} className="bg-red-500/10 border border-red-500/30 text-red-500 px-6 py-3 rounded-lg hover:bg-red-500/20 transition-all font-medium text-sm flex items-center gap-2">
                      <Square className="w-4 h-4 fill-current" /> Stop
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            {isGenerating && (
              <div className="w-full h-1.5 bg-black/10 rounded-full mb-6 overflow-hidden border border-[rgba(var(--border))]">
                <motion.div initial={{ width: 0 }} animate={{ width: `${job?.progress || 0}%` }} className="h-full bg-primary" />
              </div>
            )}

            <div ref={terminalRef} className="flex-1 bg-black/5 rounded-xl border border-[rgba(var(--border))] p-6 font-mono text-[12px] space-y-2 overflow-y-auto min-h-[300px] scrollbar-thin mb-6 shadow-inner">
              {terminalLogs.length === 0 && <div className="text-text-secondary italic">Waiting to start...</div>}
              {terminalLogs.map((log, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-text-secondary/50">[{log.timestamp}]</span>
                  <span className={cn(log.type === 'SUCCESS' ? "text-primary" : log.type === 'ERROR' ? "text-red-500" : "text-text-primary/80")}>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricBox icon={Activity} label="Speed" value={`${(job?.speed || 0).toLocaleString()} p/s`} color="text-secondary" />
              <MetricBox icon={Zap} label="Generated" value={(job?.processed || generatedCount).toLocaleString()} color="text-primary" />
              <MetricBox icon={Cpu} label="Theoretical Total" value={theoreticalTotal > 1e9 ? '> 1 Billion' : theoreticalTotal.toLocaleString()} color="text-text-secondary" />
            </div>

            {job?.status === 'completed' && (
              <div className="mt-6 flex gap-4">
                <button onClick={() => onUseWordlist(generatedContent, [])} className="flex-1 py-4 rounded-xl bg-primary text-white font-bold tracking-wide text-sm hover:bg-primary/90 transition-all shadow-sm">Use This List</button>
                <button onClick={downloadWordlist} className="flex-1 py-4 rounded-xl bg-black/5 border border-[rgba(var(--border))] text-text-primary font-bold tracking-wide text-sm hover:bg-black/10 transition-all shadow-sm">Download (.txt)</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricBox({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-black/5 border border-[rgba(var(--border))] p-5 rounded-xl transition-colors hover:bg-black/10">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("w-4 h-4", color)} />
        <span className="text-xs font-bold text-text-secondary">{label}</span>
      </div>
      <div className={cn("text-lg font-bold", color)}>{value}</div>
    </div>
  );
}
