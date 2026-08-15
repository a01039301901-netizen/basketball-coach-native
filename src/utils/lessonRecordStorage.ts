import { SQLiteStorage } from 'expo-sqlite/kv-store';
import AppStorage from './appStorage';

type StorageEntry = [string, string | null];

const lessonRecordStorage = new SQLiteStorage('BasketballCoachLessonRecordStorage');

function buildEntryMap(entries: StorageEntry[]) {
  return Object.fromEntries(entries) as Record<string, string | null>;
}

function buildEmptyEntries(keys: string[]): StorageEntry[] {
  return keys.map((key) => [key, null]);
}

function normalizeEntryValue(value: string | null | undefined) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function buildResolvedEntries(
  keys: string[],
  dbEntryMap: Record<string, string | null>,
  localEntryMap: Record<string, string | null>
): StorageEntry[] {
  return keys.map((key) => [
    key,
    normalizeEntryValue(dbEntryMap[key]) ?? normalizeEntryValue(localEntryMap[key]) ?? null,
  ]);
}

function buildEntriesToSync(entries: StorageEntry[], entryMap: Record<string, string | null>) {
  return entries.reduce<Array<[string, string]>>((accumulator, [key, value]) => {
    if (typeof value !== 'string' || value.length === 0) {
      return accumulator;
    }

    if (normalizeEntryValue(entryMap[key]) === value) {
      return accumulator;
    }

    accumulator.push([key, value]);
    return accumulator;
  }, []);
}

function didAllOperationsFail(results: PromiseSettledResult<unknown>[]) {
  return results.every((result) => result.status === 'rejected');
}

function getFirstRejectedReason(results: PromiseSettledResult<unknown>[]) {
  return results.find((result): result is PromiseRejectedResult => result.status === 'rejected')?.reason
    ?? new Error('lesson record storage operation failed');
}

async function readLessonRecordDbEntries(keys: string[]): Promise<StorageEntry[]> {
  try {
    return await lessonRecordStorage.multiGet(keys);
  } catch {
    return buildEmptyEntries(keys);
  }
}

async function readLocalLessonRecordEntries(keys: string[]): Promise<StorageEntry[]> {
  try {
    return await AppStorage.multiGet(keys);
  } catch {
    return buildEmptyEntries(keys);
  }
}

export async function getLessonRecordEntries(keys: string[]): Promise<StorageEntry[]> {
  const [dbEntries, localEntries] = await Promise.all([
    readLessonRecordDbEntries(keys),
    readLocalLessonRecordEntries(keys),
  ]);
  const dbEntryMap = buildEntryMap(dbEntries);
  const localEntryMap = buildEntryMap(localEntries);
  const resolvedEntries = buildResolvedEntries(keys, dbEntryMap, localEntryMap);
  const dbEntriesToSync = buildEntriesToSync(resolvedEntries, dbEntryMap);
  const localEntriesToSync = buildEntriesToSync(resolvedEntries, localEntryMap);

  if (dbEntriesToSync.length > 0 || localEntriesToSync.length > 0) {
    await Promise.allSettled([
      dbEntriesToSync.length > 0 ? lessonRecordStorage.multiSet(dbEntriesToSync) : Promise.resolve(),
      localEntriesToSync.length > 0 ? AppStorage.multiSet(localEntriesToSync) : Promise.resolve(),
    ]);
  }

  return resolvedEntries;
}

export async function setLessonRecordEntries(entries: Array<[string, string]>): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  const results = await Promise.allSettled([
    lessonRecordStorage.multiSet(entries),
    AppStorage.multiSet(entries),
  ]);

  if (didAllOperationsFail(results)) {
    throw getFirstRejectedReason(results);
  }
}

export async function removeLessonRecordEntries(keys: string[]): Promise<void> {
  if (keys.length === 0) {
    return;
  }

  const results = await Promise.allSettled([
    lessonRecordStorage.multiRemove(keys),
    Promise.all(keys.map((key) => AppStorage.removeItem(key))),
  ]);

  if (didAllOperationsFail(results)) {
    throw getFirstRejectedReason(results);
  }
}

export async function getLessonRecordEntriesWithMigration(keys: string[]): Promise<StorageEntry[]> {
  return getLessonRecordEntries(keys);
}
