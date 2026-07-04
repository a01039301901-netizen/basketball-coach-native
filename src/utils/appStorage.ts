import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

type StorageEntry = [string, string | null];

function getWebStorage() {
  if (Platform.OS !== 'web') {
    return null;
  }

  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

export const appStorage = {
  async getItem(key: string) {
    const webStorage = getWebStorage();

    if (!webStorage) {
      return AsyncStorage.getItem(key);
    }

    return webStorage.getItem(key);
  },

  async setItem(key: string, value: string) {
    const webStorage = getWebStorage();

    if (!webStorage) {
      await AsyncStorage.setItem(key, value);
      return;
    }

    webStorage.setItem(key, value);
  },

  async removeItem(key: string) {
    const webStorage = getWebStorage();

    if (!webStorage) {
      await AsyncStorage.removeItem(key);
      return;
    }

    webStorage.removeItem(key);
  },

  async multiGet(keys: string[]): Promise<StorageEntry[]> {
    const webStorage = getWebStorage();

    if (!webStorage) {
      const entries = await AsyncStorage.multiGet(keys);
      return entries.map(([key, value]) => [key, value]);
    }

    return keys.map((key) => [key, webStorage.getItem(key)]);
  },

  async multiSet(entries: Array<[string, string]>) {
    const webStorage = getWebStorage();

    if (!webStorage) {
      await AsyncStorage.multiSet(entries);
      return;
    }

    for (const [key, value] of entries) {
      webStorage.setItem(key, value);
    }
  },
};

export default appStorage;
