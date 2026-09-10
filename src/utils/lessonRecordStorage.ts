import { SQLiteStorage } from 'expo-sqlite/kv-store';
import AppStorage from './appStorage';

type StorageEntry = [string, string | null];

const lessonRecordStorage = new SQLiteStorage('BasketballCoachLessonRecordStorage');

let lessonRecordOperationQueue: Promise<void> = Promise.resolve();

function enqueueLessonRecordOperation<T>(operation: () => Promise<T>) {
  const nextOperation = lessonRecordOperationQueue.then(operation, operation);

  // Keep the queue alive even when one storage operation fails.
  lessonRecordOperationQueue = nextOperation.then(
    () => undefined,
    () => undefined
  );

  return nextOperation;
}

function buildEntryMap(entries: StorageEntry[]) {
  return Object.fromEntries(entries) as Record<string, string | null>;
}

function buildEmptyEntries(keys: string[]): StorageEntry[] {
  return keys.map((key) => [key, null]);
}

function normalizeEntryValue(value: string | null | undefined) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function isLessonRecordRevisionKey(key: string) {
  return key.includes('basketballLessonRecordsRevision:');
}

function isLessonRecordsKey(key: string) {
  return key.includes('basketballLessonRecords:');
}

function isLessonRecordMediaKey(key: string) {
  return key.includes('basketballLessonRecordVideos:') || key.includes('basketballLessonRecordThumbnails:');
}

function getLessonRecordRevision(value: string | null | undefined) {
  const normalizedValue = normalizeEntryValue(value);

  if (!normalizedValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(normalizedValue) as { updatedAt?: unknown; sequence?: unknown };
    const updatedAt = typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : null;
    const sequence = typeof parsed.sequence === 'number' && Number.isFinite(parsed.sequence) ? parsed.sequence : 0;

    return updatedAt === null ? null : { updatedAt, sequence };
  } catch {
    return null;
  }
}

function getStoredLessonRecordCount(value: string | null | undefined) {
  const normalizedValue = normalizeEntryValue(value);

  if (!normalizedValue) {
    return 0;
  }

  try {
    const parsed = JSON.parse(normalizedValue);

    if (!Array.isArray(parsed)) {
      return 0;
    }

    return parsed.filter((record) => record && typeof record === 'object' && typeof record.id === 'string').length;
  } catch {
    return 0;
  }
}

function mergeLessonRecordMediaValues(primaryValue: string | null | undefined, fallbackValue: string | null | undefined) {
  const primary = normalizeEntryValue(primaryValue);
  const fallback = normalizeEntryValue(fallbackValue);

  if (!primary) {
    return fallback;
  }

  if (!fallback) {
    return primary;
  }

  try {
    const primaryMap = JSON.parse(primary);
    const fallbackMap = JSON.parse(fallback);

    if (
      !primaryMap ||
      Array.isArray(primaryMap) ||
      typeof primaryMap !== 'object' ||
      !fallbackMap ||
      Array.isArray(fallbackMap) ||
      typeof fallbackMap !== 'object'
    ) {
      return primary;
    }

    return JSON.stringify({ ...fallbackMap, ...primaryMap });
  } catch {
    return primary;
  }
}

function shouldPreferLocalEntries(
  keys: string[],
  dbEntryMap: Record<string, string | null>,
  localEntryMap: Record<string, string | null>
) {
  const revisionKey = keys.find(isLessonRecordRevisionKey);

  if (revisionKey) {
    const dbRevision = getLessonRecordRevision(dbEntryMap[revisionKey]);
    const localRevision = getLessonRecordRevision(localEntryMap[revisionKey]);

    if (dbRevision && localRevision) {
      if (dbRevision.updatedAt !== localRevision.updatedAt) {
        return localRevision.updatedAt > dbRevision.updatedAt;
      }

      if (dbRevision.sequence !== localRevision.sequence) {
        return localRevision.sequence > dbRevision.sequence;
      }
    } else if (localRevision) {
      return true;
    } else if (dbRevision) {
      return false;
    }
  }

  // Legacy records have no revision marker. Prefer the fuller list so an old partial
  // copy cannot hide records while the two stores are being repaired.
  const lessonRecordsKey = keys.find(isLessonRecordsKey);

  if (!lessonRecordsKey) {
    return false;
  }

  return getStoredLessonRecordCount(localEntryMap[lessonRecordsKey]) > getStoredLessonRecordCount(dbEntryMap[lessonRecordsKey]);
}

function buildResolvedEntries(
  keys: string[],
  dbEntryMap: Record<string, string | null>,
  localEntryMap: Record<string, string | null>
): StorageEntry[] {
  const preferLocalEntries = shouldPreferLocalEntries(keys, dbEntryMap, localEntryMap);
  const primaryEntryMap = preferLocalEntries ? localEntryMap : dbEntryMap;
  const fallbackEntryMap = preferLocalEntries ? dbEntryMap : localEntryMap;

  return keys.map((key) => [
    key,
    isLessonRecordMediaKey(key)
      ? mergeLessonRecordMediaValues(primaryEntryMap[key], fallbackEntryMap[key])
      : normalizeEntryValue(primaryEntryMap[key]) ?? normalizeEntryValue(fallbackEntryMap[key]) ?? null,
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

export function getLessonRecordEntries(keys: string[]): Promise<StorageEntry[]> {
  return enqueueLessonRecordOperation(async () => {
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
  });
}

export function setLessonRecordEntries(entries: Array<[string, string]>): Promise<void> {
  if (entries.length === 0) {
    return Promise.resolve();
  }

  return enqueueLessonRecordOperation(async () => {
    const results = await Promise.allSettled([
      lessonRecordStorage.multiSet(entries),
      AppStorage.multiSet(entries),
    ]);

    if (didAllOperationsFail(results)) {
      throw getFirstRejectedReason(results);
    }
  });
}

export function removeLessonRecordEntries(keys: string[]): Promise<void> {
  if (keys.length === 0) {
    return Promise.resolve();
  }

  return enqueueLessonRecordOperation(async () => {
    const results = await Promise.allSettled([
      lessonRecordStorage.multiRemove(keys),
      Promise.all(keys.map((key) => AppStorage.removeItem(key))),
    ]);

    if (didAllOperationsFail(results)) {
      throw getFirstRejectedReason(results);
    }
  });
}

export async function getLessonRecordEntriesWithMigration(keys: string[]): Promise<StorageEntry[]> {
  return getLessonRecordEntries(keys);
}
