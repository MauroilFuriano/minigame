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
  
  // STATO INIZIALE VUOTO (Verrà riempito al caricamento)
  const [state, setState] = useState<GameState>({
    score: 0,
    energy: MAX_ENERGY,
    scans: 0,
    signals: 0,
    lastEnergyUpdate: Date.now() // FONDAMENTALE PER IL CALCOLO OFFLINE
  });

  const stateRef = useRef(state); 

  // Mantiene il ref aggiornato per il salvataggio automatico (evita problemi di closure)
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // --- FUNZIONE CUORE: CALCOLO RICARICA OFFLINE ---
  const calculateOfflineRegen = (savedState: GameState): number => {
    const now = Date.now();
    const lastUpdate = savedState.lastEnergyUpdate || now;
    
    // Calcola quanti secondi sono passati da quando hai chiuso l'app
    const elapsedMs = now - lastUpdate;
    
    if (elapsedMs <= 0) return savedState.energy;

    // 3 punti energia al secondo (Configurazione standard)
    const regeneratedAmount = Math.floor(elapsedMs / REGEN_RATE_MS) * 3; 
    
    // Non superare mai il massimo
    return Math.min(MAX_ENERGY, savedState.energy + regeneratedAmount);
  };

  // --- 1. INIZIALIZZAZIONE (La parte critica che non andava) ---
  useEffect(() => {
    const initialize = async () => {
      initTelegram();

      let finalState: GameState | null = null;

      // A. TENTATIVO 1: CLOUD STORAGE (Il più affidabile su mobile)
      try {
        const cloudData = await getCloudStorage(['TERMINAL_STATE']);
        if (cloudData['TERMINAL_STATE']) {
          const parsed = JSON.parse(cloudData['TERMINAL_STATE']);
          if (parsed && typeof parsed.score === 'number') {
            console.log("✅ Trovato salvataggio Cloud");
            finalState = parsed;
          }
        }
      } catch (e) { console.error("Errore lettura Cloud", e); }

      // B. TENTATIVO 2: LOCAL STORAGE (Fallback veloce o per PC)
      if (!finalState) {
        try {
          const localData = localStorage.getItem('TERMINAL_STATE');
          if (localData) {
            const parsed = JSON.parse(localData);
            if (parsed && typeof parsed.score === 'number') {
              console.log("✅ Trovato salvataggio Locale");
              finalState = parsed;
            }
          }
        } catch (e) {}
      }

      // C. TENTATIVO 3: URL PARAMETERS (Dati dal Bot - Solo se non abbiamo nulla di salvato)
      // Questo evita che il bot sovrascriva i tuoi progressi con "0" ogni volta che rientri
      if (!finalState) {
        const params = new URLSearchParams(window.location.search);
        const urlScore = params.get('score');
        
        if (urlScore) {
          console.log("⚠️ Nessun salvataggio trovato, uso dati URL dal Bot");
          finalState = {
            score: parseInt(urlScore, 10) || 0,
            energy: parseInt(params.get('energy') || '1000', 10),
            scans: parseInt(params.get('scans') || '0', 10),
            signals: parseInt(params.get('signals') || '0', 10),
            lastEnergyUpdate: Date.now()
          };
        }
      }

      // APPLICAZIONE DATI E CALCOLO OFFLINE
      if (finalState) {
        // Applica la rigenerazione dell'energia basata sul tempo passato offline
        const currentEnergy = calculateOfflineRegen(finalState);
        
        setState({
          ...finalState,
          energy: currentEnergy,
          lastEnergyUpdate: Date.now() // Aggiorniamo il timestamp ad ADESSO
        });
      } else {
        // Utente completamente nuovo
        console.log("🆕 Nuovo Utente");
      }

      setIsLoading(false);
    };

    initialize();
  }, []);

  // --- 2. LOOP DI GIOCO (Rigenerazione mentre l'app è aperta) ---
  useEffect(() => {
    if (isLoading) return;

    const regenInterval = setInterval(() => {
      setState(prev => {
        if (prev.energy >= MAX_ENERGY) return prev;

        const now = Date.now();
        // Rigenera solo se è passato davvero 1 secondo dall'ultimo update
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

  // --- 3. AUTO-SAVE (Salvataggio Silenzioso e Costante) ---
  useEffect(() => {
    if (isLoading) return;

    const interval = setInterval(() => {
      const currentState = stateRef.current;
      const jsonState = JSON.stringify(currentState);
      
      // Salva su Cloud (Telegram)
      saveCloudStorage('TERMINAL_STATE', jsonState);
      
      // Salva su Local (Backup)
      try { localStorage.setItem('TERMINAL_STATE', jsonState); } catch (e) {}
      
    }, SAVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isLoading]);

  // --- AZIONI ---
  const handleMine = () => {
    setState(prev => {
      if (prev.energy < 10) return prev;
      return {
        ...prev,
        score: prev.score + 5,
        energy: prev.energy - 10,
        lastEnergyUpdate: Date.now() // Importante aggiornare il timestamp ad ogni azione
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

      // Sync immediato con il Bot (consegna prodotto)
      // Nota: salviamo anche localmente prima di inviare per sicurezza
      const jsonState = JSON.stringify(newState);
      saveCloudStorage('TERMINAL_STATE', jsonState);
      localStorage.setItem('TERMINAL_STATE', jsonState);

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
          <p className="font-mono text-sm animate-pulse">LOADING TERMINAL DATA...</p>
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