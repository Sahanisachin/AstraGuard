import React, { useState, useEffect } from 'react';
import { Lock, List, ShieldAlert, Shield, Terminal as TerminalIcon, LayoutDashboard, Database, Activity, Cpu, Hash, CheckCircle2 } from 'lucide-react';
import { useCrackingJob } from './hooks/useCrackingJob';
import { UploadCard } from './components/sections/UploadSection';
import { ControlCenter } from './components/sections/ControlCenter';
import { Terminal } from './components/sections/Terminal';
import { ResultPanel } from './components/sections/ResultPanel';

import { Home } from './components/sections/Home';
import { WordlistCreator } from './components/sections/WordlistCreator';
import { AnimatePresence, motion } from 'framer-motion';

const AstraLogo = ({ className }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
    {/* Minimal Tech Shield */}
    <path d="M50 10 L15 25 L15 60 C15 75 50 95 50 95 C50 95 85 75 85 60 L85 25 Z" opacity="0.2" fill="currentColor" stroke="none" />
    <path d="M50 10 L15 25 L15 60 C15 75 50 95 50 95 C50 95 85 75 85 60 L85 25 Z" stroke="currentColor" strokeWidth="3" />
    {/* Abstract 'A' */}
    <path d="M50 25 L35 65 L43 65 L46 52 L54 52 L57 65 L65 65 Z M50 35 L48 45 L52 45 Z" fill="currentColor" stroke="none" />
    {/* Circuit details */}
    <circle cx="50" cy="50" r="35" stroke="currentColor" strokeDasharray="4 8" strokeWidth="1.5" opacity="0.5" />
  </svg>
);

function App() {
  const {
    job,
    logs,
    dependencies,
    isInstalling,
    installDependencies,
    uploadFile,
    startCrack,
    stopCrack,
    addLog
  } = useCrackingJob();

  const [view, setView] = useState('home');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [targetFile, setTargetFile] = useState(null);
  const [wordlistFile, setWordlistFile] = useState(null);
  const [targetPath, setTargetPath] = useState('');
  const [wordlistPath, setWordlistPath] = useState('');
  const [wordlistContent, setWordlistContent] = useState('');
  const [wordlistLines, setWordlistLines] = useState([]);
  const [useDefaultWordlist, setUseDefaultWordlist] = useState(false);
  const [showFallbackPrompt, setShowFallbackPrompt] = useState(false);
  
  const [showWelcome, setShowWelcome] = useState(true);

  useEffect(() => {
    // Welcome screen timeout
    const timer = setTimeout(() => {
      setShowWelcome(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleTargetSelect = async (file) => {
    if (!file) {
      setTargetFile(null);
      setTargetPath('');
      return;
    }
    setTargetFile(file);
    try {
      const data = await uploadFile(file);
      setTargetPath(data.path);
    } catch (err) {}
  };

  const handleWordlistSelect = async (file) => {
    if (!file) {
      setWordlistFile(null);
      setWordlistPath('');
      setWordlistContent('');
      setWordlistLines([]);
      return;
    }
    setWordlistFile(file);
    setUseDefaultWordlist(false);
    
    try {
      const text = await file.text();
      const uploadedWordlist = text.split("\n").filter(Boolean).map(line => line.trim());
      setWordlistLines(uploadedWordlist);
      setWordlistContent(text);
      
      const data = await uploadFile(file);
      setWordlistPath(data.path);
    } catch (err) {
      addLog(`Failed to parse file: ${err.message}`, 'ERROR');
    }
  };

  const allDepsInstalled = Object.values(dependencies).every(v => v);

  useEffect(() => {
    if (job?.status === 'failed' && job?.error === 'No password matched' && !useDefaultWordlist) {
      setShowFallbackPrompt(true);
    }
  }, [job?.status, job?.error, useDefaultWordlist]);

  const handleTryDefault = () => {
    setShowFallbackPrompt(false);
    setUseDefaultWordlist(true);
    setWordlistFile(null);
    setWordlistPath('');
    setWordlistContent('');
    startCrack(targetPath, '', '', 8, 'internal');
  };

  if (showWelcome) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background relative overflow-hidden transition-colors duration-300">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center z-10 flex flex-col items-center"
        >
          <AstraLogo className="w-24 h-24 text-primary mb-6 animate-pulse-glow" />
          <h1 className="text-4xl md:text-5xl font-bold text-text-primary tracking-tight mb-4">
            Welcome to AstraGuard
          </h1>
          <p className="text-text-secondary text-lg max-w-md mx-auto leading-relaxed mb-6">
            A modern platform designed to help you manage and analyze security tasks with ease.
          </p>
          <p className="text-primary/80 font-medium text-sm tracking-widest uppercase">
            Fast • Secure • Easy to Use
          </p>
        </motion.div>
        <div className="absolute inset-0 cyber-grid opacity-10 pointer-events-none" />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background text-text-primary relative transition-colors duration-300 font-sans">
      <div className="absolute inset-0 cyber-grid opacity-10 pointer-events-none" />

      {/* Top System Bar */}
      <div className="h-10 bg-os-bar border-b border-[rgba(var(--border))] flex items-center justify-between px-4 z-50 shadow-sm select-none">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-primary font-bold">
            <AstraLogo className="w-5 h-5" />
            <span className="text-sm tracking-wide">AstraGuard OS</span>
          </div>
          <span className="hidden md:block opacity-20 text-text-primary">|</span>
          <span className="hidden md:flex items-center gap-1.5 text-xs text-text-secondary">
            Smart Security Tools. Simple Experience.
          </span>
        </div>
        
        <div className="flex items-center gap-6">
          <select 
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="bg-black/5 border border-[rgba(var(--border))] rounded-md px-2 py-1 text-xs text-text-primary cursor-pointer outline-none hover:bg-black/10 transition-colors shadow-sm"
          >
            <option value="dark">Dark Theme</option>
            <option value="light">Light Theme</option>
            <option value="blue">Blue Professional</option>
            <option value="purple">Purple Cyberpunk</option>
          </select>
          <span className="hidden sm:flex items-center gap-2 text-xs text-text-secondary">
            <Activity className="w-3.5 h-3.5" /> 
            {job?.speed ? `${job.speed.toLocaleString()} Tries/sec` : 'System Idle'}
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium text-text-primary">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Main OS Area */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        
        {/* Sidebar Dock */}
        <div className="w-16 md:w-20 bg-card/90 border-r border-[rgba(var(--border))] flex flex-col items-center py-6 gap-6 z-40 backdrop-blur-md shadow-lg">
          <button 
            onClick={() => setView('home')} 
            className={`p-3 rounded-xl transition-all group relative ${view === 'home' ? 'bg-primary/20 text-primary shadow-[inset_3px_0_0_hsl(var(--primary))]' : 'text-text-secondary hover:bg-black/5 hover:text-text-primary'}`} 
            title="Dashboard"
          >
            <LayoutDashboard className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setView('crack')} 
            className={`p-3 rounded-xl transition-all group relative ${view === 'crack' ? 'bg-primary/20 text-primary shadow-[inset_3px_0_0_hsl(var(--primary))]' : 'text-text-secondary hover:bg-black/5 hover:text-text-primary'}`} 
            title="Password Recovery"
          >
            <Lock className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setView('wordlist-gen')} 
            className={`p-3 rounded-xl transition-all group relative ${view === 'wordlist-gen' ? 'bg-primary/20 text-primary shadow-[inset_3px_0_0_hsl(var(--primary))]' : 'text-text-secondary hover:bg-black/5 hover:text-text-primary'}`} 
            title="Password List Generator"
          >
            <Database className="w-6 h-6" />
          </button>
          <div className="mt-auto" />
        </div>

        {/* Desktop Workspace */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto relative flex flex-col gap-6">
          {view === 'home' ? (
             <div className="os-window flex-1">
               <div className="os-window-header">
                 <span>System Dashboard</span>
                 <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                 </div>
               </div>
               <div className="os-window-body p-8">
                 <Home onSelectTool={(id) => setView(id)} />
               </div>
             </div>
          ) : view === 'wordlist-gen' ? (
             <div className="os-window flex-1">
               <div className="os-window-header">
                 <span>Password List Generator</span>
                 <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                 </div>
               </div>
               <div className="os-window-body">
                 <WordlistCreator 
                    onBack={() => setView('home')} 
                    onUseWordlist={(content, lines) => {
                      setWordlistContent(content);
                      setWordlistLines(lines);
                      setWordlistPath('');
                      setUseDefaultWordlist(false);
                      setView('crack');
                      addLog('Imported generated password list successfully', 'SUCCESS');
                    }}
                  />
               </div>
             </div>
          ) : (
            <div className="space-y-6 max-w-7xl mx-auto w-full pb-8">
              {/* Dependency Window */}
              {!allDepsInstalled && (
                <div className="os-window border-red-500/30">
                  <div className="os-window-header bg-red-500/10 text-red-500">
                    <span className="flex items-center gap-2"><ShieldAlert className="w-3.5 h-3.5" /> Required Components Missing</span>
                  </div>
                  <div className="os-window-body bg-red-500/5 flex items-center justify-between p-6">
                    <div>
                      <p className="text-lg font-bold text-text-primary">System update required</p>
                      <p className="text-sm text-text-secondary mt-1">Some necessary tools for validating files are missing. Please install them to continue.</p>
                    </div>
                    <button
                      onClick={installDependencies}
                      disabled={isInstalling}
                      className="px-6 py-2.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all text-sm font-medium shadow-sm disabled:opacity-50"
                    >
                      {isInstalling ? 'Installing...' : 'Install Components'}
                    </button>
                  </div>
                </div>
              )}

              {/* Uploads Window */}
              <div className="os-window">
                <div className="os-window-header">
                  <span>Task Setup</span>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500/50 hover:bg-blue-500 cursor-pointer transition-colors" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50 hover:bg-yellow-500 cursor-pointer transition-colors" />
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/50 hover:bg-red-500 cursor-pointer transition-colors" />
                  </div>
                </div>
                <div className="os-window-body grid grid-cols-1 lg:grid-cols-2 gap-6 bg-black/5">
                  <UploadCard
                    title="Protected File"
                    icon={Lock}
                    file={targetFile}
                    onFileSelect={handleTargetSelect}
                    acceptedTypes=".pdf,.zip,.7z,.rar,.docx,.xlsx,.pptx"
                  />
                  <UploadCard
                    title="Password List"
                    icon={List}
                    file={wordlistFile}
                    onFileSelect={handleWordlistSelect}
                    acceptedTypes=".txt,.csv,.lst"
                    suggestion="Need a password list?"
                    onUseDefault={(val = true) => {
                      setUseDefaultWordlist(val);
                      if (val) {
                        setWordlistFile(null);
                        setWordlistPath('');
                      }
                    }}
                    isDefaultActive={useDefaultWordlist}
                  />
                </div>
              </div>

              {/* Control Center Window */}
              <div className="os-window">
                 <div className="os-window-header">
                  <span>Process Control</span>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500/50 hover:bg-blue-500 cursor-pointer transition-colors" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50 hover:bg-yellow-500 cursor-pointer transition-colors" />
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/50 hover:bg-red-500 cursor-pointer transition-colors" />
                  </div>
                </div>
                <div className="os-window-body p-6">
                   <ControlCenter
                    job={job}
                    onStart={() => {
                      const source = useDefaultWordlist ? 'internal' : 'uploaded';
                      startCrack(targetPath, useDefaultWordlist ? '' : wordlistPath, useDefaultWordlist ? '' : wordlistContent, 8, source);
                    }}
                    onStop={stopCrack}
                    canStart={!!targetPath && (!!wordlistPath || useDefaultWordlist)}
                  />
                </div>
              </div>

              {/* Terminal Window */}
              <div className="os-window">
                 <div className="os-window-header">
                  <span className="flex items-center gap-2"><TerminalIcon className="w-3.5 h-3.5"/> Activity Log</span>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500/50 hover:bg-blue-500 cursor-pointer transition-colors" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50 hover:bg-yellow-500 cursor-pointer transition-colors" />
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/50 hover:bg-red-500 cursor-pointer transition-colors" />
                  </div>
                </div>
                <div className="os-window-body p-0">
                  <Terminal 
                    logs={logs} 
                    isRunning={job?.status === 'running'} 
                    wordlist={wordlistLines}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fallback Prompt */}
      {showFallbackPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/90 backdrop-blur-sm">
          <div className="os-window max-w-lg w-full border-[rgba(var(--border))] relative overflow-hidden shadow-xl">
             <div className="os-window-header">
               <span>Notice</span>
             </div>
             <div className="os-window-body p-8 text-center">
              <div className="inline-flex p-4 rounded-full bg-secondary/10 text-secondary mb-6">
                <List className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-text-primary mb-2">List Finished</h2>
              <p className="text-text-secondary text-sm mb-8 leading-relaxed">
                We tried all passwords in your list but none worked. Would you like to try again using our default common passwords list?
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowFallbackPrompt(false)}
                  className="flex-1 py-3 rounded-lg font-medium bg-black/5 hover:bg-black/10 border border-[rgba(var(--border))] text-text-secondary hover:text-text-primary transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTryDefault}
                  className="flex-1 py-3 rounded-lg font-medium bg-secondary text-white hover:bg-secondary/90 transition-all shadow-md text-sm"
                >
                  Try Default List
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result Overlay */}
      <ResultPanel job={job} onDismiss={() => window.location.reload()} />
    </div>
  );
}

export default App;
