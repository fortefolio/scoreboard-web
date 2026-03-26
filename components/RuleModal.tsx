"use client";

import { useState } from "react";

interface RuleModalProps {
  roundNum: number;
  initialRules: { max_sets: number; points_per_set: number; point_cap: number | null };
  isOpen: boolean;
  onClose: () => void;
  onSave: (sets: number, points: number, cap: number | null) => void;
}

export default function RuleModal({ roundNum, initialRules, isOpen, onClose, onSave }: RuleModalProps) {
  const [sets, setSets] = useState(initialRules.max_sets);
  const [points, setPoints] = useState(initialRules.points_per_set);
  const [cap, setCap] = useState<number | "">(initialRules.point_cap || "");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
      <div className="bg-surface-container-high rounded-[2.5rem] p-10 max-w-md w-full shadow-3xl border border-outline-variant/20 animate-in zoom-in-95 duration-300">
        <h2 className="text-2xl font-headline font-black mb-2 uppercase tracking-tight">Edit Match Rules</h2>
        <p className="text-on-surface-variant text-xs mb-8 font-label tracking-widest uppercase opacity-60">Round {roundNum} Configuration</p>
        
        <div className="space-y-6">
          <div className="p-5 bg-surface-container rounded-2xl border border-outline-variant/10">
            <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-3">Maximum Sets</label>
            <input 
              type="number" 
              className="w-full bg-transparent text-2xl font-black text-on-surface outline-none"
              value={sets}
              onChange={(e) => setSets(parseInt(e.target.value) || 1)}
            />
          </div>

          <div className="p-5 bg-surface-container rounded-2xl border border-outline-variant/10">
            <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-3">Points per Set</label>
            <input 
              type="number" 
              className="w-full bg-transparent text-2xl font-black text-on-surface outline-none"
              value={points}
              onChange={(e) => setPoints(parseInt(e.target.value) || 1)}
            />
          </div>

          <div className="p-5 bg-surface-container rounded-2xl border border-outline-variant/10">
            <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-3">Point Cap (Optional)</label>
            <input 
              type="number" 
              className="w-full bg-transparent text-2xl font-black text-on-surface outline-none"
              placeholder="No cap"
              value={cap}
              onChange={(e) => setCap(e.target.value === "" ? "" : parseInt(e.target.value))}
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button 
              onClick={onClose} 
              className="flex-1 py-4 text-on-surface-variant font-bold hover:text-on-surface transition-colors uppercase tracking-widest text-[10px]"
            >
              Cancel
            </button>
            <button 
              onClick={() => {
                onSave(sets, points, cap === "" ? null : cap);
                onClose();
              }} 
              className="flex-1 bg-primary-container text-on-primary-container py-4 rounded-xl font-black uppercase tracking-[0.2em] text-[10px] hover:brightness-110 transition-all shadow-xl shadow-primary-container/20"
            >
              Save Rules
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
