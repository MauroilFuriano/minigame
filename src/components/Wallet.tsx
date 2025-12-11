import React from 'react';
import { GameState } from '../types';
import { CircuitBoard, Scan, Signal } from 'lucide-react';

interface WalletProps {
  state: GameState;
}

const Wallet: React.FC<WalletProps> = ({ state }) => {
  return (
    <div className="flex flex-col h-full p-6 space-y-6 pt-10">
      <h1 className="text-2xl font-bold text-[#39ff14] uppercase tracking-widest border-b border-[#39ff14]/30 pb-2 mb-4">
        Terminal Wallet
      </h1>

      {/* Balance Card */}
      <div className="glass-panel p-6 rounded-xl space-y-4 border border-[#39ff14]/20 bg-black/60 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-[#39ff14]/10 rounded-lg border border-[#39ff14]/20">
                <CircuitBoard className="text-[#39ff14]" size={24} />
             </div>
             <div>
               <p className="text-gray-400 text-xs uppercase tracking-wider">Total Net Worth</p>
               <p className="text-3xl font-mono text-white font-bold tracking-tight">
                 {state.score.toLocaleString()} <span className="text-lg text-[#39ff14] font-normal">$CAP</span>
               </p>
             </div>
          </div>
        </div>
      </div>

      <h2 className="text-xs uppercase text-gray-500 tracking-widest mt-4 pl-1">Assets Inventory</h2>

      <div className="grid grid-cols-2 gap-4">
        {/* Scanner Inventory */}
        <div className="glass-panel p-4 rounded-xl flex flex-col items-center justify-center text-center space-y-2 border border-gray-800 bg-black/40 hover:border-blue-500/30 transition-colors">
          <div className="p-2 bg-blue-500/10 rounded-full mb-1">
            <Scan className="text-blue-400" size={24} />
          </div>
          <h3 className="text-gray-400 text-[10px] uppercase tracking-wider">AI Scanners</h3>
          <p className="text-2xl font-mono text-white font-bold">{state.scans}</p>
        </div>

        {/* Signal Inventory */}
        <div className="glass-panel p-4 rounded-xl flex flex-col items-center justify-center text-center space-y-2 border border-gray-800 bg-black/40 hover:border-purple-500/30 transition-colors">
           <div className="p-2 bg-purple-500/10 rounded-full mb-1">
             <Signal className="text-purple-400" size={24} />
           </div>
           <h3 className="text-gray-400 text-[10px] uppercase tracking-wider">Signal Pass</h3>
           <p className="text-2xl font-mono text-white font-bold">{state.signals}</p>
        </div>
      </div>

      {/* Decorative Footer */}
      <div className="mt-auto glass-panel p-4 rounded-xl border border-gray-800/50">
        <p className="text-[10px] text-gray-600 font-mono text-center leading-relaxed">
          SECURE CONNECTION ESTABLISHED<br/>
          NODE: 0x8F...3A2 // ENCRYPTION: AES-256
        </p>
      </div>
    </div>
  );
};

export default Wallet;