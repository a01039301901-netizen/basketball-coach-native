import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

type StorageEntry = [string, string | null];

const WEB_STORAGE_DB_NAME = 'basketballCoachStorage';
const WEB_STORAGE_STORE_NAME = 'appStorage';
const WEB_STORAGE_DB_VERSION = 1;
const WEB_STORAGE_MIRROR_LIMIT = 80_000;

let webDbPromise: Promise<any | null> | null = null;

function getWebStorage() {
  if (Platform.OS !== 'web') {
    return null;
  }

  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

function getWebIndexedDb() {
  if (Platform.OS !== 'web') {
    return null;
  }

  if (typeof window === 'undefined' || !window.indexedDB) {
    return null;
  }

  return window.indexedDB;
}

function getWebDb() {
  const indexedDb = getWebIndexedDb();

  if (!indexedDb) {
    return null;
  }

  if (!webDbPromise) {
    webDbPromise = new Promise((resolve) => {
      try {
        const request = indexedDb.open(WEB_STORAGE_DB_NAME, WEB_STORAGE_DB_VERSION);

        request.onupgradeneeded = () => {
          const db = request.result;

          if (!db.objectStoreNames.contains(WEB_STORAGE_STORE_NAME)) {
            db.createObjectStore(WEB_STORAGE_STORE_NAME);
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  return webDbPromise;
}

async function getWebDbValue(key: string): Promise<string | null> {
  const dbPromise = getWebDb();

  if (!dbPromise) {
    return null;
  }

  const db = await dbPromise;

  if (!db) {
    return null;
  }

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(WEB_STORAGE_STORE_NAME, 'readonly');
      const store = transaction.objectStore(WEB_STORAGE_STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(typeof request.result === 'string' ? request.result : request.result == null ? null : String(request.result));
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function setWebDbValue(key: string, value: string) {
  const dbPromise = getWebDb();

  if (!dbPromise) {
    return false;
  }

  const db = await dbPromise;

  if (!db) {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    try {
      const transaction = db.transaction(WEB_STORAGE_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(WEB_STORAGE_STORE_NAME);
      const request = store.put(value, key);

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function removeWebDbValue(key: string) {
  const dbPromise = getWebDb();

  if (!dbPromise) {
    return false;
  }

  const db = await dbPromise;

  if (!db) {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    try {
      const transaction = db.transaction(WEB_STORAGE_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(WEB_STORAGE_STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

function mirrorToWebStorage(webStorage: Storage, key: string, value: string) {
  try {
    if (value.length <= WEB_STORAGE_MIRROR_LIMIT) {
      webStorage.setItem(key, value);
      return;
    }

    webStorage.removeItem(key);
  } catch {
    try {
      webStorage.removeItem(key);
    } catch {
      // Ignore mirror cleanup failures.
    }
  }
}

export const appStorage = {
  async getItem(key: string) {
    const webStorage = getWebStorage();

    if (!webStorage) {
      return AsyncStorage.getItem(key);
    }

    const indexedDbValue = await getWebDbValue(key);

    if (indexedDbValue !== null) {
      return indexedDbValue;
    }

    return webStorage.getItem(key);
  },

  async setItem(key: string, value: string) {
    const webStorage = getWebStorage();

    if (!webStorage) {
      await AsyncStorage.setItem(key, value);
      return;
    }

    const didSaveToIndexedDb = await setWebDbValue(key, value);

    if (!didSaveToIndexedDb) {
      webStorage.setItem(key, value);
      return;
    }

    mirrorToWebStorage(webStorage, key, value);
  },

  async removeItem(key: string) {
    const webStorage = getWebStorage();

    if (!webStorage) {
      await AsyncStorage.removeItem(key);
      return;
    }

    await removeWebDbValue(key);
    webStorage.removeItem(key);
  },

  async multiGet(keys: string[]): Promise<StorageEntry[]> {
    const webStorage = getWebStorage();

    if (!webStorage) {
      const entries = await AsyncStorage.multiGet(keys);
      return entries.map(([key, value]) => [key, value]);
    }

    const entries = await Promise.all(
      keys.map(async (key) => {
        const indexedDbValue = await getWebDbValue(key);
        return [key, indexedDbValue !== null ? indexedDbValue : webStorage.getItem(key)] as StorageEntry;
      })
    );

    return entries;
  },

  async multiSet(entries: Array<[string, string]>) {
    const webStorage = getWebStorage();

    if (!webStorage) {
      await AsyncStorage.multiSet(entries);
      return;
    }

    for (const [key, value] of entries) {
      const didSaveToIndexedDb = await setWebDbValue(key, value);

      if (!didSaveToIndexedDb) {
        webStorage.setItem(key, value);
        continue;
      }

      mirrorToWebStorage(webStorage, key, value);
    }
  },
};

export default appStorage;
