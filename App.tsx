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
  
  // Default Initial State
  const [state, setState] = useState<GameState>({
    score: 0,
    energy: MAX_ENERGY,
    scans: 0,
    signals: 0,
    lastEnergyUpdate: Date.now()
  });

  // Reference for Auto-Save to avoid stale closures
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // --- HELPER: OFFLINE REGENERATION ---
  const applyOfflineRegen = (baseState: GameState): GameState => {
    const now = Date.now();
    const lastUpdate = baseState.lastEnergyUpdate || now;
    const elapsedMs = now - lastUpdate;

    if (elapsedMs <= 0) {
      return { ...baseState, lastEnergyUpdate: now };
    }

    // Calculate gained energy
    const secondsElapsed = Math.floor(elapsedMs / REGEN_RATE_MS);
    const energyGained = secondsElapsed * ENERGY_PER_TICK;
    const newEnergy = Math.min(MAX_ENERGY, baseState.energy + energyGained);

    console.log(`⚡ Offline Regen: ${secondsElapsed}s elapsed, +${energyGained} energy.`);

    return {
      ...baseState,
      energy: newEnergy,
      lastEnergyUpdate: now
    };
  };

  // --- 1. SMART INITIALIZATION ---
  useEffect(() => {
    const initializeGame = async () => {
      initTelegram();

      // A. Fetch URL Parameters (Bot Data - Potential Stale)
      const params = new URLSearchParams(window.location.search);
      const botState: Partial<GameState> = {
        score: parseInt(params.get('score') || '0', 10),
        energy: parseInt(params.get('energy') || '1000', 10),
        scans: parseInt(params.get('scans') || '0', 10),
        signals: parseInt(params.get('signals') || '0', 10),
        lastEnergyUpdate: Date.now() // Bot doesn't send time, assume "now" if used
      };

      console.log("🤖 Bot State:", botState);

      // B. Fetch Local/Cloud Storage (Potential Fresh Data)
      let storedState: GameState | null = null;

      // 1. Try Cloud Storage
      try {
        const cloud = await getCloudStorage(['TERMINAL_STATE']);
        if (cloud['TERMINAL_STATE']) {
          storedState = JSON.parse(cloud['TERMINAL_STATE']);
          console.log("☁️ Cloud Save Found");
        }
      } catch (e) {
        console.error("Cloud fetch failed", e);
      }

      // 2. Fallback to Local Storage if Cloud failed or empty
      if (!storedState) {
        try {
          const local = localStorage.getItem('TERMINAL_STATE');
          if (local) {
            storedState = JSON.parse(local);
            console.log("💾 Local Save Found");
          }
        } catch (e) {
          console.error("Local fetch failed", e);
        }
      }

      // C. DECISION LOGIC: Resolving Conflicts
      let winningState: GameState;

      if (storedState) {
        // LOGIC: If we have stored data, we prefer it IF it looks newer or has equal/better progress.
        // Since Bot doesn't send timestamps, we rely mainly on Score comparison.
        // If Local Score >= Bot Score, we assume Local is the latest session.
        // If Bot Score >> Local Score, it implies user played on another device (and local is stale).
        
        const localScore = storedState.score || 0;
        const botScore = botState.score || 0;

        if (localScore >= botScore) {
          console.log("✅ Using LOCAL STATE (Score is higher or equal to Bot)");
          winningState = storedState;
        } else {
          console.log("⚠️ Using BOT STATE (Bot score is higher, likely new device sync)");
          // Merge bot stats but keep local timestamp to avoid huge jumps if inconsistent
          winningState = {
            score: botScore,
            energy: botState.energy || MAX_ENERGY,
            scans: botState.scans || 0,
            signals: botState.signals || 0,
            lastEnergyUpdate: Date.now()
          };
        }
      } else {
        console.log("🆕 No Local Data - initializing from BOT");
        winningState = {
            score: botState.score || 0,
            energy: botState.energy || MAX_ENERGY,
            scans: botState.scans || 0,
            signals: botState.signals || 0,
            lastEnergyUpdate: Date.now()
        };
      }

      // D. Apply Offline Regeneration to the winner
      const finalState = applyOfflineRegen(winningState);
      
      setState(finalState);
      setIsLoading(false);
    };

    initializeGame();
  }, []);

  // --- 2. LIVE ENERGY REGENERATION ---
  useEffect(() => {
    if (isLoading) return;

    const regenInterval = setInterval(() => {
      setState(prev => {
        if (prev.energy >= MAX_ENERGY) return prev;

        const now = Date.now();
        // Only add energy if 1 second has passed since last update
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

  // --- 3. AUTO-SAVE SYSTEM ---
  useEffect(() => {
    if (isLoading) return;

    const saveInterval = setInterval(() => {
      const currentState = stateRef.current;
      const jsonState = JSON.stringify(currentState);
      
      // Save to LocalStorage (Fast)
      localStorage.setItem('TERMINAL_STATE', jsonState);
      
      // Save to CloudStorage (Async/Network)
      saveCloudStorage('TERMINAL_STATE', jsonState);
      
    }, SAVE_INTERVAL_MS);

    return () => clearInterval(saveInterval);
  }, [isLoading]);

  // --- ACTIONS ---

  const handleMine = () => {
    setState(prev => {
      if (prev.energy < 10) return prev;
      return {
        ...prev,
        score: prev.score + 5,
        energy: prev.energy - 10,
        lastEnergyUpdate: Date.now() // Update time on action to prevent double-regen
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
      
      // FORCE SAVE IMMEDIATELY
      const jsonState = JSON.stringify(newState);
      localStorage.setItem('TERMINAL_STATE', jsonState);
      saveCloudStorage('TERMINAL_STATE', jsonState);

      // SYNC TO BOT
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

  // --- RENDER ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#050505] text-[#39ff14]">
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 border-4 border-[#39ff14] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="font-mono text-sm animate-pulse">SYNCING NEURAL LINK...</p>
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