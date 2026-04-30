import React, { useState } from 'react';
import { Upload, FileCheck, X, Zap, Lock, List } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';

export function UploadCard({ title, icon: Icon, file, onFileSelect, acceptedTypes, suggestion, onUseDefault, isDefaultActive }) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "bg-card/50 border border-[rgba(var(--border))] rounded-2xl p-6 relative group transition-all duration-300 shadow-sm",
        isDefaultActive ? "bg-secondary/5" : "",
        file ? "border-primary/50 bg-primary/5" : ""
      )}
    >
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className={cn(
            "p-3 rounded-xl border transition-colors",
            isDefaultActive ? "bg-secondary/10 border-secondary/30" : "bg-black/5 border-[rgba(var(--border))]"
          )}>
            <Icon className={cn("w-6 h-6", isDefaultActive ? "text-secondary" : "text-primary")} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-text-primary tracking-tight">{title}</h3>
            <p className="text-xs font-medium text-text-secondary">Waiting for file...</p>
          </div>
        </div>
        {file && (
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-2.5 h-2.5 rounded-full bg-primary" 
          />
        )}
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); onFileSelect(e.dataTransfer.files[0]); }}
        className={cn(
          "relative h-40 rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center gap-3 cursor-pointer overflow-hidden bg-black/5",
          isDragging 
            ? "border-primary bg-primary/10 scale-[0.99]" 
            : "border-[rgba(var(--border))] hover:border-primary/40 hover:bg-black/10",
          file || isDefaultActive ? "border-primary/30" : ""
        )}
        onClick={() => document.getElementById(`file-input-${title}`).click()}
      >
        <input
          id={`file-input-${title}`}
          type="file"
          className="hidden"
          accept={acceptedTypes}
          onChange={(e) => onFileSelect(e.target.files[0])}
        />

        {!file && !isDefaultActive ? (
          <>
            <div className="p-4 rounded-full bg-black/5 border border-[rgba(var(--border))] group-hover:scale-110 transition-transform">
              <Upload className="w-6 h-6 text-text-secondary group-hover:text-primary transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-text-secondary mb-1">Click or drag file here</p>
              <p className="text-[10px] font-medium text-text-secondary/60 uppercase tracking-widest">Maximum size: 10GB</p>
            </div>
          </>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-3"
          >
            <div className={cn(
              "p-4 rounded-full bg-primary/10",
              isDefaultActive && "bg-secondary/10"
            )}>
              <FileCheck className={cn("w-6 h-6", isDefaultActive ? "text-secondary" : "text-primary")} />
            </div>
            <div className="text-center px-6">
              <p className="text-sm font-bold text-text-primary truncate max-w-[240px]">
                {isDefaultActive ? 'Default Passwords List' : file?.name}
              </p>
              <p className="text-xs font-medium text-primary mt-1">
                {isDefaultActive ? 'Ready' : `${(file?.size / 1024).toFixed(1)} KB • Ready`}
              </p>
            </div>
          </motion.div>
        )}
      </div>

      {suggestion && !file && !isDefaultActive && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={(e) => { e.stopPropagation(); onUseDefault(); }}
          className="mt-6 w-full py-3.5 rounded-lg border border-secondary/30 bg-secondary/10 text-secondary text-sm font-bold hover:bg-secondary/20 transition-all flex items-center justify-center gap-2"
        >
          <Zap className="w-4 h-4 fill-current" />
          {suggestion} <span className="underline opacity-80">Use Default List</span>
        </motion.button>
      )}

      {(file || isDefaultActive) && (
        <button
          onClick={(e) => { e.stopPropagation(); if (isDefaultActive) onUseDefault(false); else onFileSelect(null); }}
          className="absolute top-6 right-6 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
}
