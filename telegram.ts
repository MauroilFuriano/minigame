import { GameState } from '../types';

// Accesso sicuro all'oggetto Telegram
const TG = window.Telegram?.WebApp;

export const initTelegram = () => {
  if (TG) {
    try {
      TG.ready();
      TG.expand();
      
      // Imposta i colori per evitare flash bianchi
      TG.setHeaderColor('#050505');
      TG.setBackgroundColor('#050505');
      
      // Abilita la conferma di chiusura (importante per evitare chiusure per sbaglio)
      if (TG.enableClosingConfirmation) {
        TG.enableClosingConfirmation();
      }
    } catch (e) {
      console.error("Errore inizializzazione Telegram:", e);
    }
  }
};

// --- LEGGE DAL CLOUD (Con fallback su Locale) ---
export const getCloudStorage = (keys: string[]): Promise<Record<string, string>> => {
  return new Promise((resolve) => {
    // 1. Se non siamo su Telegram, usa il LocalStorage (Browser PC)
    if (!TG || !TG.CloudStorage) {
      console.log('Browser Mode: Uso LocalStorage');
      const result: Record<string, string> = {};
      keys.forEach(key => {
        const item = localStorage.getItem(key);
        if (item) result[key] = item;
      });
      resolve(result);
      return;
    }

    // 2. Siamo su Telegram: Proviamo a leggere dal Cloud
    try {
      TG.CloudStorage.getItems(keys, (err, values) => {
        if (err) {
          console.error('ERRORE LETTURA CLOUD:', err);
          // Se il cloud fallisce, prova a recuperare dal LocalStorage come ultima spiaggia
          const result: Record<string, string> = {};
          keys.forEach(key => {
            const item = localStorage.getItem(key);
            if (item) result[key] = item;
          });
          resolve(result);
        } else {
          console.log('SUCCESSO CLOUD:', values);
          resolve(values || {});
        }
      });
    } catch (e) {
      console.error('ECCEZIONE CLOUD:', e);
      resolve({});
    }
  });
};

// --- SALVA SUL CLOUD (Doppio salvataggio) ---
export const saveCloudStorage = (key: string, value: string): Promise<boolean> => {
  return new Promise((resolve) => {
    // 1. SALVA SEMPRE IN LOCALE (Backup istantaneo)
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.error('Errore LocalStorage:', e);
    }

    // 2. Se non c'è Telegram, abbiamo finito
    if (!TG || !TG.CloudStorage) {
      resolve(true);
      return;
    }

    // 3. SALVA SU TELEGRAM CLOUD
    try {
      TG.CloudStorage.setItem(key, value, (err, posted) => {
        if (err) {
          console.error('ERRORE SALVATAGGIO CLOUD:', err);
          resolve(false); // Segnala che il cloud ha fallito
        } else {
          resolve(posted); // Segnala successo
        }
      });
    } catch (e) {
      console.error('ECCEZIONE SALVATAGGIO CLOUD:', e);
      resolve(false);
    }
  });
};

// Invia dati al bot (per acquisti o sync forzato)
export const sendDataToBot = (data: any) => {
  if (TG) {
    TG.sendData(JSON.stringify(data));
  } else {
    console.log('Mock SendData (Browser):', data);
  }
};

export const closeApp = () => {
  if (TG) {
    TG.close();
  }
};