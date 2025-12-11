export interface GameState {
  score: number;
  energy: number;
  scans: number;
  signals: number;
  lastEnergyUpdate: number;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: any;
  version: string;
  isVersionAtLeast: (version: string) => boolean;
  close: () => void;
  sendData: (data: string) => void;
  ready: () => void;
  expand: () => void;
  CloudStorage: {
    setItem: (key: string, value: string, callback?: (err: any, posted: boolean) => void) => void;
    getItem: (key: string, callback: (err: any, value: string) => void) => void;
    getItems: (keys: string[], callback: (err: any, values: any) => void) => void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export enum Tab {
  MINER = 'MINER',
  WALLET = 'WALLET',
  SHOP = 'SHOP',
}