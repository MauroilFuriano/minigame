import React, { useState } from 'react';
import { GameState } from '../types';
import { Zap } from 'lucide-react';

interface MinerProps {
  state: GameState;
  onMine: () => void;
}

const Miner: React.FC<MinerProps> = ({ state, onMine }) => {
  const [isMining, setIsMining] = useState(false);
  const MAX_ENERGY = 1000;
  const energyPercent = Math.min(100, Math.max(0, (state.energy / MAX_ENERGY) * 100));
  const isLowEnergy = state.energy < 10;

  const handleClick = () => {
    if (state.energy >= 10) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(15);
      }
      setIsMining(true);
      onMine();
      setTimeout(() => setIsMining(false), 100);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8 p-4 relative z-10">
      
      {/* Stats Display */}
      <div className="glass-panel w-full p-4 rounded-xl flex justify-between items-center neon-border bg-black/40 backdrop-blur-md border border-[#39ff14]/30">
        <div className="text-center w-1/2 border-r border-green-900/50">
          <p className="text-xs text-green-400/70 uppercase tracking-widest">Balance</p>
          <h2 className="text-3xl font-bold text-white neon-text font-mono">
            {state.score.toLocaleString()} <span className="text-sm text-[#39ff14]">$CAP</span>
          </h2>
        </div>
        <div className="text-center w-1/2 pl-4">
           <p className="text-xs text-green-400/70 uppercase tracking-widest flex items-center justify-center gap-1">
             <Zap size={12} className={isLowEnergy ? "text-red-500 animate-pulse" : "text-[#39ff14]"} /> Energy
           </p>
           <div className="flex flex-col items-center w-full px-2">
             <h2 className={`text-2xl font-bold font-mono transition-colors duration-300 ${state.energy < 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
               {Math.floor(state.energy)}<span className="text-xs text-gray-500">/{MAX_ENERGY}</span>
             </h2>
             <div className="w-full h-2 bg-gray-900 rounded-full mt-1 overflow-hidden border border-gray-700/50 shadow-inner">
               <div 
                 className={`h-full transition-all duration-300 ease-out ${isLowEnergy ? 'bg-red-600' : 'bg-[#39ff14] shadow-[0_0_10px_rgba(57,255,20,0.5)]'}`} 
                 style={{ width: `${energyPercent}%` }}
               ></div>
             </div>
           </div>
        </div>
      </div>

      {/* REACTOR BUTTON */}
      <div 
        className="relative group cursor-pointer" 
        onClick={handleClick} 
        style={{ touchAction: 'manipulation' }}
      >
        {/* Aura di luce */}
        <div className={`
           absolute inset-0 rounded-full bg-[#39ff14]
           transition-all duration-500 ease-in-out
           opacity-20 blur-[30px] scale-90
           group-hover:opacity-60 group-hover:blur-[50px] group-hover:scale-110
           ${isMining ? 'opacity-90 blur-[60px] scale-125 duration-100' : ''}
        `}></div>
        
        {/* Contenitore Robot */}
        <div 
          className={`
            relative w-64 h-64 rounded-full flex items-center justify-center bg-black overflow-hidden
            border-[3px] border-[#39ff14]/40
            shadow-[0_0_20px_rgba(57,255,20,0.2)]
            transition-all duration-100
            active:scale-95 active:border-[#39ff14]
          `}
        >
          {/* --- MODIFICA QUI: ANELLO ROTANTE --- */}
          {/* Aggiunto 'animate-[spin_10s_linear_infinite]' per la rotazione continua */}
          <div className="absolute inset-0 border-[2px] border-dashed border-[#39ff14]/50 rounded-full w-full h-full animate-[spin_10s_linear_infinite]"></div>
          
          <img 
            src="/robot.png" 
            alt="AI Core" 
            className="w-48 h-48 object-cover rounded-full relative z-10 pointer-events-none" 
            style={{ 
              filter: isMining ? 'brightness(1.5) contrast(1.2)' : 'none',
              transition: 'filter 0.1s' 
            }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>

        {state.energy < 10 && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-red-500 font-bold text-xl whitespace-nowrap bg-black/90 px-3 py-1 rounded border border-red-500/50 shadow-lg z-20 pointer-events-none">
            LOW ENERGY
          </div>
        )}
      </div>

      <div className="text-center space-y-1">
        <p className="text-[#39ff14] text-xs animate-pulse tracking-[0.2em]">NEURAL LINK ESTABLISHED</p>
      </div>
    </div>
  );
};

export default Miner;