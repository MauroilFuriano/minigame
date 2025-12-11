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
const ENERGY_PER_TICK = 3;

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.MINER);
  const [isLoading, setIsLoading] = useState(true);
  
  // Stato predefinito (vuoto)
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

  // --- CALCOLO RIGENERAZIONE OFFLINE (Energia guadagnata a app chiusa) ---
  const applyOfflineRegen = (baseState: GameState): GameState => {
    const now = Date.now();
    const lastUpdate = baseState.lastEnergyUpdate || now;
    const elapsedMs = now - lastUpdate;

    if (elapsedMs <= 0) {
      return { ...baseState, lastEnergyUpdate: now };
    }

    // Calcola l'energia guadagnata mentre eri offline
    const secondsElapsed = Math.floor(elapsedMs / REGEN_RATE_MS);
    const energyGained = secondsElapsed * ENERGY_PER_TICK;
    
    // La nuova energia non può superare 1000
    const newEnergy = Math.min(MAX_ENERGY, baseState.energy + energyGained);

    console.log(`⚡ Offline Regen: +${energyGained} energy in ${secondsElapsed}s`);

    return {
      ...baseState,
      energy: newEnergy,
      lastEnergyUpdate: now
    };
  };

  // --- 1. INIZIALIZZAZIONE SMART ---
  useEffect(() => {
    const initializeGame = async () => {
      initTelegram();

      // A. Dati dal LINK DEL BOT (URL)
      const params = new URLSearchParams(window.location.search);
      const urlScoreParam = params.get('score');
      // Se il parametro c'è, è un numero. Se non c'è (grazie alla modifica Python), è null.
      const urlScore = urlScoreParam ? parseInt(urlScoreParam, 10) : null;

      // B. Dati SALVATI (Cloud Telegram + LocalStorage)
      let storedState: GameState | null = null;

      // 1. Prova Cloud (Priorità massima su Telegram Mobile)
      try {
        const cloud = await getCloudStorage(['TERMINAL_STATE']);
        if (cloud['TERMINAL_STATE']) {
          storedState = JSON.parse(cloud['TERMINAL_STATE']);
          console.log("☁️ Trovato Cloud Save:", storedState);
        }
      } catch (e) { console.error(e); }

      // 2. Prova Local (Backup per PC/Browser)
      if (!storedState) {
        try {
          const local = localStorage.getItem('TERMINAL_STATE');
          if (local) {
            storedState = JSON.parse(local);
            console.log("💾 Trovato Local Save:", storedState);
          }
        } catch (e) {}
      }

      // C. IL CONFLITTO: CHI VINCE?
      let winningState: GameState;

      // CASO 1: Il Bot ha mandato dati espliciti (> 0)
      if (urlScore !== null && urlScore > 0) {
        // Se il salvataggio locale è PIÙ ALTO del bot, usiamo il locale (abbiamo giocato offline)
        if (storedState && storedState.score > urlScore) {
           console.log("🏆 Locale vince (Score più alto)");
           winningState = storedState;
        } else {
           // Altrimenti ci fidiamo del bot (es. acquisto fatto su altro PC)
           console.log("⚠️ Bot vince (Dati URL prioritari)");
           winningState = {
             score: urlScore,
             energy: parseInt(params.get('energy') || '1000', 10),
             scans: parseInt(params.get('scans') || '0', 10),
             signals: parseInt(params.get('signals') || '0', 10),
             lastEnergyUpdate: Date.now()
           };
        }
      }
      // CASO 2: Il Bot NON ha mandato dati (il link è pulito grazie al fix Python)
      else {
        if (storedState) {
          console.log("✅ Bot silenzioso -> Uso Salvataggio Cloud/Local");
          winningState = storedState;
        } else {
          console.log("🆕 Nuovo Utente (Zero assoluto)");
          winningState = {
            score: 0,
            energy: MAX_ENERGY,
            scans: 0,
            signals: 0,
            lastEnergyUpdate: Date.now()
          };
        }
      }

      // D. Applica la rigenerazione dell'energia al vincitore
      const finalState = applyOfflineRegen(winningState);
      
      setState(finalState);
      setIsLoading(false);
    };

    initializeGame();
  }, []);

  // --- 2. LOOP DI GIOCO (Rigenerazione Live) ---
  useEffect(() => {
    if (isLoading) return;

    const regenInterval = setInterval(() => {
      setState(prev => {
        if (prev.energy >= MAX_ENERGY) return prev;

        const now = Date.now();
        // Rigenera solo se è passato 1 secondo
        if (now - prev.lastEnergyUpdate >= REGEN_RATE_MS) {
          return {
            ...prev,
            energy: Math.min(MAX_ENERGY, prev.energy + ENERGY_PER_TICK),
            lastEnergyUpdate: now
          };
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(regenInterval);
  }, [isLoading]);

  // --- 3. AUTO-SAVE (Fondamentale) ---
  useEffect(() => {
    if (isLoading) return;

    const saveInterval = setInterval(() => {
      const currentState = stateRef.current;
      const jsonState = JSON.stringify(currentState);
      
      // Salva OVUNQUE (Ridondanza totale)
      saveCloudStorage('TERMINAL_STATE', jsonState); // Telegram Cloud
      localStorage.setItem('TERMINAL_STATE', jsonState); // Browser Local
      
    }, SAVE_INTERVAL_MS);

    return () => clearInterval(saveInterval);
  }, [isLoading]);

  // --- AZIONI ---

  const handleMine = () => {
    setState(prev => {
      if (prev.energy < 10) return prev;
      return {
        ...prev,
        score: prev.score + 5,
        energy: prev.energy - 10,
        lastEnergyUpdate: Date.now()
      };
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
      
      // Salva subito prima di chiudere
      const jsonState = JSON.stringify(newState);
      saveCloudStorage('TERMINAL_STATE', jsonState);
      localStorage.setItem('TERMINAL_STATE', jsonState);

      // Invia al bot
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
          {/* SCRITTA PER CONFERMARE L'AGGIORNAMENTO */}
          <p className="font-mono text-sm animate-pulse">SYNCING NEURAL LINK v3.0...</p>
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