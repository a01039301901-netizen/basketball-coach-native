import { SQLiteStorage } from 'expo-sqlite/kv-store';
import AppStorage from './appStorage';

type StorageEntry = [string, string | null];

const lessonRecordStorage = new SQLiteStorage('BasketballCoachLessonRecordStorage');

function buildEntryMap(entries: StorageEntry[]) {
  return Object.fromEntries(entries) as Record<string, string | null>;
}

export async function getLessonRecordEntries(keys: string[]): Promise<StorageEntry[]> {
  return lessonRecordStorage.multiGet(keys);
}

export async function setLessonRecordEntries(entries: Array<[string, string]>): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  await lessonRecordStorage.multiSet(entries);
}

export async function removeLessonRecordEntries(keys: string[]): Promise<void> {
  if (keys.length === 0) {
    return;
  }

  await lessonRecordStorage.multiRemove(keys);
}

export async function getLessonRecordEntriesWithMigration(keys: string[]): Promise<StorageEntry[]> {
  const dbEntries = await lessonRecordStorage.multiGet(keys);
  const dbEntryMap = buildEntryMap(dbEntries);
  const missingKeys = keys.filter((key) => dbEntryMap[key] == null);

  if (missingKeys.length === 0) {
    return keys.map((key) => [key, dbEntryMap[key] ?? null]);
  }

  const legacyEntries = await AppStorage.multiGet(missingKeys);
  const legacyEntriesToPersist = legacyEntries.filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0
  );

  if (legacyEntriesToPersist.length > 0) {
    await lessonRecordStorage.multiSet(legacyEntriesToPersist);
  }

  const mergedEntryMap = {
    ...dbEntryMap,
    ...buildEntryMap(legacyEntries),
  };

  return keys.map((key) => [key, mergedEntryMap[key] ?? null]);
}
