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
  
  // Stato iniziale di default
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

  // FUNZIONE RIGENERAZIONE OFFLINE
  const calculateOfflineRegen = (savedState: GameState): number => {
    const now = Date.now();
    const lastUpdate = savedState.lastEnergyUpdate || now;
    const elapsedMs = now - lastUpdate;
    
    if (elapsedMs <= 0) return savedState.energy;

    // 3 punti energia al secondo
    const regeneratedAmount = Math.floor(elapsedMs / REGEN_RATE_MS) * 3; 
    return Math.min(MAX_ENERGY, savedState.energy + regeneratedAmount);
  };

  // --- 1. INIZIALIZZAZIONE INTELLIGENTE ---
  useEffect(() => {
    const initialize = async () => {
      initTelegram();

      // 1. Dati dal BOT (URL) - Spesso sono vecchi se non hai fatto sync
      const params = new URLSearchParams(window.location.search);
      const botScore = parseInt(params.get('score') || '0', 10);
      const botEnergy = parseInt(params.get('energy') || '1000', 10);
      const botScans = parseInt(params.get('scans') || '0', 10);
      const botSignals = parseInt(params.get('signals') || '0', 10);

      // 2. Dati LOCALI (Cloud/Storage) - Questi sono i più freschi
      let localState: GameState | null = null;
      
      // Prova Cloud Telegram
      try {
        const cloud = await getCloudStorage(['TERMINAL_STATE']);
        if (cloud['TERMINAL_STATE']) {
            localState = JSON.parse(cloud['TERMINAL_STATE']);
            console.log("✅ Trovato Cloud Save");
        }
      } catch (e) {}

      // Prova LocalStorage Browser (Fallback)
      if (!localState) {
        try {
          const local = localStorage.getItem('TERMINAL_STATE');
          if (local) {
              localState = JSON.parse(local);
              console.log("✅ Trovato Local Save");
          }
        } catch (e) {}
      }

      // 3. LOGICA "CHI VINCE?"
      let finalState: GameState;

      // Se abbiamo dati locali validi...
      if (localState && typeof localState.score === 'number') {
        // ...e se il punteggio locale è MAGGIORE o UGUALE a quello del bot...
        // ...allora usiamo il locale (perché significa che abbiamo giocato offline)
        if (localState.score >= botScore) {
            console.log("🏆 Vincono i dati LOCALI (Più recenti)");
            finalState = {
                ...localState,
                // Applica rigenerazione energia
                energy: calculateOfflineRegen(localState),
                lastEnergyUpdate: Date.now()
            };
        } else {
            // Se il bot ha PIÙ punti del locale (es. acquisto fatto da un altro device), vince il bot
            console.log("⚠️ Vincono i dati BOT (Nuovo device o acquisto esterno)");
            finalState = {
                score: botScore,
                energy: botEnergy,
                scans: botScans,
                signals: botSignals,
                lastEnergyUpdate: Date.now()
            };
        }
      } else {
        // Nessun dato locale? Usiamo il bot (Primo avvio)
        console.log("🆕 Primo Avvio / Nessun dato locale");
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

  // --- 2. LOOP RIGENERAZIONE LIVE ---
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

  // --- 3. AUTO-SAVE COSTANTE ---
  useEffect(() => {
    if (isLoading) return;
    const interval = setInterval(() => {
      const json = JSON.stringify(stateRef.current);
      // Salva su entrambi per sicurezza massima
      saveCloudStorage('TERMINAL_STATE', json);
      localStorage.setItem('TERMINAL_STATE', json);
    }, SAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isLoading]);

  // --- HANDLERS ---
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
      
      // Salva IMMEDIATAMENTE prima di chiudere
      const json = JSON.stringify(newState);
      saveCloudStorage('TERMINAL_STATE', json);
      localStorage.setItem('TERMINAL_STATE', json);

      // Invia al bot e chiudi
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#050505] text-[#39ff14]">
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 border-4 border-[#39ff14] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="font-mono text-sm animate-pulse">INITIALIZING NEURAL LINK...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full flex flex-col overflow-hidden bg-[#050505]">
      <Background />
      
      <div className="flex-1 overflow-hidden relative z-10">
        {activeTab === Tab.MINER && <Miner state={state} onMine={handleMine} />}
        {activeTab === Tab.WALLET && <Wallet state={state} />}
        {activeTab === Tab.SHOP && <Shop state={state} onBuy={handleBuy} />}
      </div>

      <nav className="h-20 glass-panel border-t border-[#39ff14]/20 flex justify-around items-center px-2 pb-2 relative z-20 bg-black/80 backdrop-blur-md">
        <button onClick={() => setActiveTab(Tab.MINER)} className={`flex flex-col items-center gap-1 p-2 w-16 transition-all ${activeTab === Tab.MINER ? 'text-[#39ff14] scale-110 drop-shadow-[0_0_8px_rgba(57,255,20,0.5)]' : 'text-gray-500'}`}>
          <Pickaxe size={24} />
          <span className="text-[10px] font-mono tracking-wider">MINE</span>
        </button>

        <button onClick={() => setActiveTab(Tab.WALLET)} className={`flex flex-col items-center gap-1 p-2 w-16 transition-all ${activeTab === Tab.WALLET ? 'text-[#39ff14] scale-110 drop-shadow-[0_0_8px_rgba(57,255,20,0.5)]' : 'text-gray-500'}`}>
          <WalletIcon size={24} />
          <span className="text-[10px] font-mono tracking-wider">WALLET</span>
        </button>

        <button onClick={() => setActiveTab(Tab.SHOP)} className={`flex flex-col items-center gap-1 p-2 w-16 transition-all ${activeTab === Tab.SHOP ? 'text-[#39ff14] scale-110 drop-shadow-[0_0_8px_rgba(57,255,20,0.5)]' : 'text-gray-500'}`}>
          <ShoppingBag size={24} />
          <span className="text-[10px] font-mono tracking-wider">SHOP</span>
        </button>
      </nav>
    </div>
  );
}

export default App;