import React from 'react';
import { GameState } from '../types';
import { ShoppingCart, Radio, Eye } from 'lucide-react';

interface ShopProps {
  state: GameState;
  onBuy: (item: 'signal' | 'scanner', cost: number) => void;
}

const Shop: React.FC<ShopProps> = ({ state, onBuy }) => {
  const items = [
    {
      id: 'signal',
      name: 'Single Signal',
      cost: 1000,
      icon: <Radio className="text-[#39ff14]" size={24} />,
      desc: 'Analisi singola coin.',
      details: 'Sblocca 1 segnale operativo completo con Entry, TP e SL.'
    },
    {
      id: 'scanner',
      name: 'AI Scanner',
      cost: 2500,
      icon: <Eye className="text-blue-400" size={24} />,
      desc: 'Scansione mercato 4H.',
      details: 'Scansiona 50+ coppie per trovare i migliori setup 4H.'
    }
  ];

  return (
    <div className="flex flex-col h-full p-6 space-y-6 pt-10 pb-24 overflow-y-auto">
      <h1 className="text-2xl font-bold text-[#39ff14] uppercase tracking-widest border-b border-[#39ff14]/30 pb-2 mb-4 flex items-center gap-2">
        <ShoppingCart size={24} /> Marketplace
      </h1>

      <div className="space-y-4">
        {items.map((item) => {
          const canAfford = state.score >= item.cost;
          return (
            <div key={item.id} className="glass-panel p-4 rounded-xl flex items-center justify-between group relative overflow-hidden transition-all duration-300 border border-gray-800 bg-black/60 hover:border-[#39ff14]/50 hover:bg-black/80">
              
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-black/40 rounded-lg border border-[#39ff14]/20 group-hover:border-[#39ff14]/50 transition-colors duration-300">
                  {item.icon}
                </div>
                <div>
                  <h3 className="text-white font-bold font-mono text-lg group-hover:text-[#39ff14] transition-colors duration-300">{item.name}</h3>
                  <p className="text-gray-400 text-xs leading-tight">{item.desc}</p>
                </div>
              </div>

              {/* BOTTONE ACQUISTA CON EFFETTO PRESSIONE 3D */}
              <button
                onClick={() => canAfford && onBuy(item.id as 'signal' | 'scanner', item.cost)}
                disabled={!canAfford}
                className={`
                  relative z-30 px-4 py-2 rounded-lg font-mono font-bold text-xs transition-all border shadow-lg
                  ${canAfford 
                    ? 'bg-[#39ff14] text-black border-[#39ff14] hover:bg-[#32cc12] hover:scale-105 active:scale-90 active:translate-y-1 active:shadow-none' 
                    : 'bg-gray-800/50 text-gray-500 border-gray-700 cursor-not-allowed'}
                `}
              >
                {item.cost} $CAP
              </button>

              {/* TOOLTIP (Ora non copre il bottone, ma appare sopra) */}
              <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20 pointer-events-none p-4 text-center">
                <p className="text-[#39ff14] text-[10px] font-bold uppercase tracking-widest mb-1">INFO PRODOTTO</p>
                <p className="text-gray-300 text-xs mb-2">{item.details}</p>
              </div>

            </div>
          );
        })}
      </div>

      <div className="mt-auto p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
        <p className="text-yellow-500/80 text-[10px] text-center font-mono uppercase">
          ⚠ Sync Immediato: L'acquisto chiude il terminale.
        </p>
      </div>
    </div>
  );
};

export default Shop;