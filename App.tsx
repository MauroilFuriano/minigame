import React, { useState, useEffect, useRef } from 'react';
import { GameState, Tab } from './types';
import { initTelegram, getCloudStorage, saveCloudStorage, sendDataToBot } from './services/telegram';
import Miner from './components/Miner';
import Wallet from './components/Wallet';
import Shop from './components/Shop';
import Background from './components/Background';
import { Pickaxe, Wallet as WalletIcon, ShoppingBag } from 'lucide-react';

const SAVE_INTERVAL_MS = 2000;
const MAX_ENERGY = 1000;
const REGEN_RATE_MS = 1000;

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.MINER);
  const [isLoading, setIsLoading] = useState(true);
  
  const [state, setState] = useState<GameState>({
    score: 0,
    energy: MAX_ENERGY,
    scans: 0,
    signals: 0,
    lastEnergyUpdate: Date.now()
  });

  const stateRef = useRef(state); 

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // CALCOLO RIGENERAZIONE OFFLINE
  const calculateOfflineRegen = (currentEnergy: number, lastTime: number): number => {
    const now = Date.now();
    const elapsedMs = now - lastTime;
    if (elapsedMs <= 0) return currentEnergy;
    
    // 3 energia al secondo
    const regen = Math.floor(elapsedMs / REGEN_RATE_MS) * 3;
    return Math.min(MAX_ENERGY, currentEnergy + regen);
  };

  useEffect(() => {
    const initialize = async () => {
      initTelegram();

      // 1. Dati dal BOT (URL)
      const params = new URLSearchParams(window.location.search);
      const botScore = parseInt(params.get('score') || '0', 10);
      const botEnergy = parseInt(params.get('energy') || '1000', 10);
      const botScans = parseInt(params.get('scans') || '0', 10);
      const botSignals = parseInt(params.get('signals') || '0', 10);

      // 2. Dati LOCALI (Cloud/Storage)
      let localState: GameState | null = null;
      
      // Prova Cloud
      try {
        const cloud = await getCloudStorage(['TERMINAL_STATE']);
        if (cloud['TERMINAL_STATE']) localState = JSON.parse(cloud['TERMINAL_STATE']);
      } catch (e) {}

      // Prova LocalStorage (Backup)
      if (!localState) {
        try {
          const local = localStorage.getItem('TERMINAL_STATE');
          if (local) localState = JSON.parse(local);
        } catch (e) {}
      }

      // 3. IL DUELLO: CHI VINCE?
      let finalState: GameState;

      if (localState && localState.lastEnergyUpdate) {
        // Se abbiamo dati locali, controlliamo se sono "migliori" di quelli del bot
        // (Esempio: se locale ha 500 punti e bot dice 0, vince locale)
        if (localState.score >= botScore) {
            console.log("🏆 Vincono i dati LOCALI (Più recenti/alti)");
            finalState = {
                ...localState,
                energy: calculateOfflineRegen(localState.energy, localState.lastEnergyUpdate),
                lastEnergyUpdate: Date.now()
            };
        } else {
            console.log("⚠️ Vincono i dati BOT (Probabile acquisto o cambio device)");
            finalState = {
                score: botScore,
                energy: botEnergy,
                scans: botScans,
                signals: botSignals,
                lastEnergyUpdate: Date.now()
            };
        }
      } else {
        // Nessun dato locale, usiamo il bot
        console.log("🆕 Nuovo Utente / Nessun dato locale");
        finalState = {
            score: botScore,
            energy: botEnergy,
            scans: botScans,
            signals: botSignals,
            lastEnergyUpdate: Date.now()
        };
      }

      setState(finalState);
      setIsLoading(false);
    };

    initialize();
  }, []);

  // LOOP RIGENERAZIONE LIVE
  useEffect(() => {
    if (isLoading) return;
    const interval = setInterval(() => {
      setState(prev => {
        if (prev.energy >= MAX_ENERGY) return prev;
        const now = Date.now();
        if (now - prev.lastEnergyUpdate >= 1000) {
           return { ...prev, energy: Math.min(MAX_ENERGY, prev.energy + 3), lastEnergyUpdate: now };
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoading]);

  // AUTO-SAVE COSTANTE
  useEffect(() => {
    if (isLoading) return;
    const interval = setInterval(() => {
      const json = JSON.stringify(stateRef.current);
      saveCloudStorage('TERMINAL_STATE', json);
      localStorage.setItem('TERMINAL_STATE', json);
    }, SAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleMine = () => {
    setState(prev => {
      if (prev.energy < 10) return prev;
      return { ...prev, score: prev.score + 5, energy: prev.energy - 10, lastEnergyUpdate: Date.now() };
    });
  };

  const handleBuy = (item: 'signal' | 'scanner', cost: number) => {
    setState(prev => {
      if (prev.score < cost) return prev;
      const newState = {
        ...prev,
        score: prev.score - cost,
        scans: item === 'scanner' ? prev.scans + 1 : prev.scans,
        signals: item === 'signal' ? prev.signals + 1 : prev.signals,
        lastEnergyUpdate: Date.now()
      };
      
      // Salva prima di inviare
      const json = JSON.stringify(newState);
      saveCloudStorage('TERMINAL_STATE', json);
      localStorage.setItem('TERMINAL_STATE', json);

      sendDataToBot({
        action: 'sync',
        score: newState.score,
        energy: newState.energy,
        scans: newState.scans,
        signals: newState.signals
      });
      return newState;
    });
  };

  if (isLoading) return <div className="h-screen bg-black text-green-500 flex items-center justify-center">LOADING...</div>;

  return (
    <div className="relative h-screen w-full flex flex-col overflow-hidden bg-[#050505]">
      <Background />
      <div className="flex-1 overflow-hidden relative z-10">
        {activeTab === Tab.MINER && <Miner state={state} onMine={handleMine} />}
        {activeTab === Tab.WALLET && <Wallet state={state} />}
        {activeTab === Tab.SHOP && <Shop state={state} onBuy={handleBuy} />}
      </div>
      <nav className="h-20 glass-panel border-t border-[#39ff14]/20 flex justify-around items-center px-2 pb-2 relative z-20 bg-black/80 backdrop-blur-md">
        <button onClick={() => setActiveTab(Tab.MINER)} className={`flex flex-col items-center gap-1 p-2 w-16 transition-all ${activeTab === Tab.MINER ? 'text-[#39ff14] scale-110' : 'text-gray-500'}`}>
          <Pickaxe size={24} /> <span className="text-[10px] font-mono tracking-wider">MINE</span>
        </button>
        <button onClick={() => setActiveTab(Tab.WALLET)} className={`flex flex-col items-center gap-1 p-2 w-16 transition-all ${activeTab === Tab.WALLET ? 'text-[#39ff14] scale-110' : 'text-gray-500'}`}>
          <WalletIcon size={24} /> <span className="text-[10px] font-mono tracking-wider">WALLET</span>
        </button>
        <button onClick={() => setActiveTab(Tab.SHOP)} className={`flex flex-col items-center gap-1 p-2 w-16 transition-all ${activeTab === Tab.SHOP ? 'text-[#39ff14] scale-110' : 'text-gray-500'}`}>
          <ShoppingBag size={24} /> <span className="text-[10px] font-mono tracking-wider">SHOP</span>
        </button>
      </nav>
    </div>
  );
}

export default App;