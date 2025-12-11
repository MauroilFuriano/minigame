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

  // Mantiene il ref aggiornato per il salvataggio automatico senza dipendenze cicliche
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Funzione per calcolare l'energia guadagnata mentre l'app era chiusa
  const calculateRegen = (baseEnergy: number, lastUpdate: number): number => {
    const now = Date.now();
    const elapsedMs = now - lastUpdate;
    if (elapsedMs <= 0) return baseEnergy;

    // 3 punti energia al secondo
    const regeneratedAmount = Math.floor(elapsedMs / REGEN_RATE_MS) * 3; 
    return Math.min(MAX_ENERGY, baseEnergy + regeneratedAmount);
  };

  // 1. INIZIALIZZAZIONE (Caricamento Dati)
  useEffect(() => {
    const initialize = async () => {
      initTelegram();

      // A. Prova dai parametri URL (Dati freschi dal Bot)
      const params = new URLSearchParams(window.location.search);
      const urlScore = params.get('score');
      
      if (urlScore) {
        // Se il bot ci passa i dati, usiamo quelli (sono i più affidabili)
        const urlEnergy = params.get('energy');
        const urlLastUpdate = params.get('lastEnergyUpdate');
        
        const parsedEnergy = parseInt(urlEnergy || '1000', 10);
        const lastUpdate = urlLastUpdate ? parseInt(urlLastUpdate, 10) : Date.now();
        
        setState({
          score: parseInt(urlScore, 10) || 0,
          energy: calculateRegen(parsedEnergy, lastUpdate),
          scans: parseInt(params.get('scans') || '0', 10),
          signals: parseInt(params.get('signals') || '0', 10),
          lastEnergyUpdate: Date.now()
        });
        setIsLoading(false);
        return;
      }

      // B. Prova dal Cloud Storage di Telegram
      const cloudData = await getCloudStorage(['TERMINAL_STATE']);
      if (cloudData['TERMINAL_STATE']) {
        try {
          const parsed = JSON.parse(cloudData['TERMINAL_STATE']);
          setState({
            ...parsed,
            energy: calculateRegen(parsed.energy || 0, parsed.lastEnergyUpdate || Date.now()),
            lastEnergyUpdate: Date.now()
          });
          setIsLoading(false);
          return;
        } catch (e) {
          console.error("Failed to parse cloud data", e);
        }
      }

      // C. Fallback LocalStorage (Browser)
      const localData = localStorage.getItem('TERMINAL_STATE');
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          setState({
            ...parsed,
            energy: calculateRegen(parsed.energy || 0, parsed.lastEnergyUpdate || Date.now()),
            lastEnergyUpdate: Date.now()
          });
        } catch (e) {}
      }
      
      setIsLoading(false);
    };

    initialize();
  }, []);

  // 2. RIGENERAZIONE ENERGIA (Loop in tempo reale)
  useEffect(() => {
    if (isLoading) return;

    const regenInterval = setInterval(() => {
      setState(prev => {
        if (prev.energy >= MAX_ENERGY) return prev;

        const now = Date.now();
        const timeSinceLast = now - prev.lastEnergyUpdate;
        
        // Rigenera solo se è passato almeno 1 secondo
        if (timeSinceLast >= 1000) {
           return {
            ...prev,
            energy: Math.min(MAX_ENERGY, prev.energy + 3), // +3 Energia al secondo
            lastEnergyUpdate: now
          };
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(regenInterval);
  }, [isLoading]);

  // 3. AUTO-SAVE (Ogni 2 secondi - Salva TUTTO incluso inventario)
  useEffect(() => {
    const interval = setInterval(() => {
      const currentState = stateRef.current;
      const jsonState = JSON.stringify(currentState);
      
      // Salva su Telegram Cloud
      saveCloudStorage('TERMINAL_STATE', jsonState);
      
      // Salva anche in locale come backup veloce
      try { localStorage.setItem('TERMINAL_STATE', jsonState); } catch (e) {}
    }, SAVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  // 4. HANDLERS (Logica di Gioco)
  const handleMine = () => {
    setState(prev => {
      if (prev.energy < 10) return prev; // Se non ha energia, stop
      return {
        ...prev,
        score: prev.score + 5, // +5 $CAP
        energy: prev.energy - 10, // -10 Energia
        lastEnergyUpdate: Date.now()
      };
    });
  };

  const handleBuy = (item: 'signal' | 'scanner', cost: number) => {
    setState(prev => {
      if (prev.score < cost) return prev; // Se non ha soldi, stop
      
      const newState = {
        ...prev,
        score: prev.score - cost,
        // Aggiorna Inventario
        scans: item === 'scanner' ? prev.scans + 1 : prev.scans,
        signals: item === 'signal' ? prev.signals + 1 : prev.signals,
        lastEnergyUpdate: Date.now()
      };

      // SYNC IMMEDIATO COL BOT (Chiude l'app e consegna il prodotto)
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
      {/* Sfondo Matrix */}
      <Background />
      
      {/* Area Contenuto (Switch tra le Tab) */}
      <div className="flex-1 overflow-hidden relative z-10">
        {activeTab === Tab.MINER && <Miner state={state} onMine={handleMine} />}
        {activeTab === Tab.WALLET && <Wallet state={state} />}
        {activeTab === Tab.SHOP && <Shop state={state} onBuy={handleBuy} />}
      </div>

      {/* Barra di Navigazione in basso */}
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