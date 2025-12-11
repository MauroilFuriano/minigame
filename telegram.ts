import { GameState } from '../types';

const TG = window.Telegram?.WebApp;

export const initTelegram = () => {
  if (TG) {
    TG.ready();
    TG.expand();
    // Imposta colori scuri per evitare flash bianchi durante il caricamento
    TG.setHeaderColor('#050505');
    TG.setBackgroundColor('#050505');
    // Chiede conferma prima di chiudere (evita chiusure accidentali)
    TG.enableClosingConfirmation();
  }
};

export const getCloudStorage = (keys: string[]): Promise<Record<string, string>> => {
  return new Promise((resolve) => {
    // Caso 1: Non siamo su Telegram (Browser PC) -> Usa LocalStorage
    if (!TG || !TG.CloudStorage) {
      console.log('CloudStorage non disponibile. Uso LocalStorage.');
      const result: Record<string, string> = {};
      keys.forEach(key => {
        const item = localStorage.getItem(key);
        if (item) result[key] = item;
      });
      resolve(result);
      return;
    }

    // Caso 2: Siamo su Telegram -> Chiedi al Cloud
    try {
      TG.CloudStorage.getItems(keys, (err, values) => {
        if (err) {
          console.error('Errore lettura Cloud:', err);
          // Se il cloud fallisce, non ritornare nulla, App.tsx userà il fallback locale
          resolve({}); 
        } else {
          resolve(values || {});
        }
      });
    } catch (e) {
      console.error('Eccezione CloudStorage:', e);
      resolve({});
    }
  });
};

export const saveCloudStorage = (key: string, value: string): Promise<boolean> => {
  return new Promise((resolve) => {
    // 1. SALVATAGGIO LOCALE (Backup immediato e veloce)
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.error('Errore salvataggio locale:', e);
    }

    // 2. SALVATAGGIO CLOUD (Telegram)
    if (!TG || !TG.CloudStorage) {
      resolve(true); // Se siamo su PC, consideralo salvato
      return;
    }

    try {
      TG.CloudStorage.setItem(key, value, (err, posted) => {
        if (err) {
          console.error('Errore salvataggio Cloud:', err);
          resolve(false);
        } else {
          resolve(posted);
        }
      });
    } catch (e) {
      console.error('Eccezione salvataggio Cloud:', e);
      resolve(false);
    }
  });
};

export const sendDataToBot = (data: any) => {
  if (TG) {
    TG.sendData(JSON.stringify(data));
  } else {
    console.log('Simulazione invio dati al bot:', data);
  }
};

export const closeApp = () => {
  if (TG) {
    TG.close();
  }
};