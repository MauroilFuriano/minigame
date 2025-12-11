import { GameState } from '../types';

const TG = window.Telegram?.WebApp;

export const initTelegram = () => {
  if (TG) {
    TG.ready();
    TG.expand();
  }
};

export const getCloudStorage = (keys: string[]): Promise<Record<string, string>> => {
  return new Promise((resolve) => {
    // Check if CloudStorage is supported (v6.9+)
    const isCloudStorageSupported = TG && 
                                    TG.isVersionAtLeast && 
                                    TG.isVersionAtLeast('6.9') && 
                                    TG.CloudStorage;

    if (!isCloudStorageSupported) {
      console.log('CloudStorage not supported. Falling back to LocalStorage.');
      const result: Record<string, string> = {};
      keys.forEach(key => {
        const item = localStorage.getItem(key);
        if (item) {
          result[key] = item;
        }
      });
      resolve(result);
      return;
    }

    try {
      TG.CloudStorage.getItems(keys, (err, values) => {
        if (err) {
          console.error('CloudStorage Error:', err);
          resolve({}); 
        } else {
          resolve(values || {});
        }
      });
    } catch (e) {
      console.error('CloudStorage access failed:', e);
      resolve({});
    }
  });
};

export const saveCloudStorage = (key: string, value: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const isCloudStorageSupported = TG && 
                                    TG.isVersionAtLeast && 
                                    TG.isVersionAtLeast('6.9') && 
                                    TG.CloudStorage;

    if (!isCloudStorageSupported) {
      try {
        localStorage.setItem(key, value);
        resolve(true);
      } catch (e) {
        console.error('LocalStorage Save Error:', e);
        resolve(false);
      }
      return;
    }

    try {
      TG.CloudStorage.setItem(key, value, (err, posted) => {
        if (err) {
          console.error('Save Error:', err);
          resolve(false);
        } else {
          resolve(posted);
        }
      });
    } catch (e) {
      console.error('CloudStorage Save Exception:', e);
      resolve(false);
    }
  });
};

export const sendDataToBot = (data: any) => {
  if (TG) {
    TG.sendData(JSON.stringify(data));
  } else {
    console.log('Mock SendData:', JSON.stringify(data));
    alert('Data sent to bot (Simulation): ' + JSON.stringify(data));
  }
};

export const closeApp = () => {
  if (TG) {
    TG.close();
  }
};