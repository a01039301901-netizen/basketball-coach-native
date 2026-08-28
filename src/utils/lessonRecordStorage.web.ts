import AppStorage from './appStorage';

type StorageEntry = [string, string | null];

function buildEmptyEntries(keys: string[]): StorageEntry[] {
  return keys.map((key) => [key, null]);
}

export async function getLessonRecordEntries(keys: string[]): Promise<StorageEntry[]> {
  try {
    return await AppStorage.multiGet(keys);
  } catch {
    return buildEmptyEntries(keys);
  }
}

export async function setLessonRecordEntries(entries: Array<[string, string]>): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  await AppStorage.multiSet(entries);
}

export async function removeLessonRecordEntries(keys: string[]): Promise<void> {
  if (keys.length === 0) {
    return;
  }

  await Promise.all(keys.map((key) => AppStorage.removeItem(key)));
}

export async function getLessonRecordEntriesWithMigration(keys: string[]): Promise<StorageEntry[]> {
  return getLessonRecordEntries(keys);
}
