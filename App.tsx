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
const REGEN_RATE_MS = 1000; // 1 energia ogni secondo

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.MINER);
  const [isLoading, setIsLoading] = useState(true);
  
  // STATO DEL GIOCO
  const [state, setState] = useState<GameState>({
    score: 0,
    energy: MAX_ENERGY,
    scans: 0,
    signals: 0,
    lastEnergyUpdate: Date.now()
  });

  const stateRef = useRef(state); 

  // Mantiene il ref aggiornato per il salvataggio
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // FUNZIONE RIGENERAZIONE OFFLINE
  // Calcola quanta energia hai guadagnato mentre l'app era chiusa
  const calculateOfflineRegen = (savedState: GameState): number => {
    const now = Date.now();
    const lastUpdate = savedState.lastEnergyUpdate || now;
    const elapsedMs = now - lastUpdate;
    
    if (elapsedMs <= 0) return savedState.energy;

    // 3 punti energia al secondo
    const regeneratedAmount = Math.floor(elapsedMs / REGEN_RATE_MS) * 3; 
    return Math.min(MAX_ENERGY, savedState.energy + regeneratedAmount);
  };

  // 1. INIZIALIZZAZIONE INTELLIGENTE
  useEffect(() => {
    const initialize = async () => {
      initTelegram();

      // 1. Prima proviamo a caricare dal CLOUD (Telegram) o LOCAL (Browser)
      // Questa è la fonte più aggiornata se hai appena minato.
      let savedData: GameState | null = null;

      // Prova Cloud
      const cloudData = await getCloudStorage(['TERMINAL_STATE']);
      if (cloudData['TERMINAL_STATE']) {
        try {
          savedData = JSON.parse(cloudData['TERMINAL_STATE']);
          console.log("Caricato da Cloud:", savedData);
        } catch (e) { console.error("Errore Cloud JSON", e); }
      }

      // Prova Local (Fallback)
      if (!savedData) {
        const localData = localStorage.getItem('TERMINAL_STATE');
        if (localData) {
          try {
            savedData = JSON.parse(localData);
            console.log("Caricato da Local:", savedData);
          } catch (e) {}
        }
      }

      // 2. Leggiamo i parametri URL (Dati dal Bot)
      const params = new URLSearchParams(window.location.search);
      const urlScore = parseInt(params.get('score') || '0', 10);
      
      // 3. LOGICA DI CONFLITTO: CHI VINCE?
      // Se abbiamo dati salvati locali validi e sono "meglio" (più recenti/alti) del bot, usiamo quelli.
      // Altrimenti usiamo il bot (es. primo avvio su nuovo dispositivo).
      
      if (savedData && savedData.lastEnergyUpdate > 0) {
        // Abbiamo un salvataggio valido. Usiamolo e calcoliamo l'energia offline.
        setState({
          ...savedData,
          energy: calculateOfflineRegen(savedData),
          lastEnergyUpdate: Date.now() // Aggiorniamo il timestamp ad adesso
        });
      } 
      else if (urlScore > 0 || params.get('energy')) {
        // Non abbiamo salvataggi, ma il bot ci passa dei dati (es. cambio telefono). Usiamo il bot.
        const urlEnergy = parseInt(params.get('energy') || '1000', 10);
        setState({
          score: urlScore,
          energy: urlEnergy, // Qui non possiamo calcolare regen precisa, ci fidiamo del bot
          scans: parseInt(params.get('scans') || '0', 10),
          signals: parseInt(params.get('signals') || '0', 10),
          lastEnergyUpdate: Date.now()
        });
      }
      else {
        // Utente nuovo o errore totale: Reset
        setState(prev => ({ ...prev, lastEnergyUpdate: Date.now() }));
      }

      setIsLoading(false);
    };

    initialize();
  }, []);

  // 2. RIGENERAZIONE ENERGIA (Loop in tempo reale - Mentre giochi)
  useEffect(() => {
    if (isLoading) return;

    const regenInterval = setInterval(() => {
      setState(prev => {
        if (prev.energy >= MAX_ENERGY) return prev;

        const now = Date.now();
        // Rigenera solo se è passato 1 secondo dall'ultimo update reale
        if (now - prev.lastEnergyUpdate >= 1000) {
           return {
            ...prev,
            energy: Math.min(MAX_ENERGY, prev.energy + 3),
            lastEnergyUpdate: now
          };
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(regenInterval);
  }, [isLoading]);

  // 3. AUTO-SAVE (Salva ogni 2 secondi)
  useEffect(() => {
    const interval = setInterval(() => {
      if (isLoading) return; // Non salvare mentre carichiamo!

      const currentState = stateRef.current;
      const jsonState = JSON.stringify(currentState);
      
      // Salva ovunque
      saveCloudStorage('TERMINAL_STATE', jsonState).then((ok) => {
         if(ok) console.log("Cloud Save OK");
      });
      try { localStorage.setItem('TERMINAL_STATE', jsonState); } catch (e) {}
      
    }, SAVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isLoading]);

  // 4. HANDLERS
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

      // Sync immediato con il Bot
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
          <p className="font-mono text-sm animate-pulse">INITIALIZING $CAP TERMINAL...</p>
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
        <button 
          onClick={() => setActiveTab(Tab.MINER)}
          className={`flex flex-col items-center gap-1 p-2 w-16 transition-all ${activeTab === Tab.MINER ? 'text-[#39ff14] scale-110 drop-shadow-[0_0_8px_rgba(57,255,20,0.5)]' : 'text-gray-500'}`}
        >
          <Pickaxe size={24} />
          <span className="text-[10px] font-mono tracking-wider">MINE</span>
        </button>

        <button 
          onClick={() => setActiveTab(Tab.WALLET)}
          className={`flex flex-col items-center gap-1 p-2 w-16 transition-all ${activeTab === Tab.WALLET ? 'text-[#39ff14] scale-110 drop-shadow-[0_0_8px_rgba(57,255,20,0.5)]' : 'text-gray-500'}`}
        >
          <WalletIcon size={24} />
          <span className="text-[10px] font-mono tracking-wider">WALLET</span>
        </button>

        <button 
          onClick={() => setActiveTab(Tab.SHOP)}
          className={`flex flex-col items-center gap-1 p-2 w-16 transition-all ${activeTab === Tab.SHOP ? 'text-[#39ff14] scale-110 drop-shadow-[0_0_8px_rgba(57,255,20,0.5)]' : 'text-gray-500'}`}
        >
          <ShoppingBag size={24} />
          <span className="text-[10px] font-mono tracking-wider">SHOP</span>
        </button>
      </nav>
    </div>
  );
}

export default App;