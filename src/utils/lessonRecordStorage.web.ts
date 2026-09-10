import AppStorage from './appStorage';

type StorageEntry = [string, string | null];

let lessonRecordOperationQueue: Promise<void> = Promise.resolve();

function enqueueLessonRecordOperation<T>(operation: () => Promise<T>) {
  const nextOperation = lessonRecordOperationQueue.then(operation, operation);

  // Keep web writes in the same order even when a previous write failed.
  lessonRecordOperationQueue = nextOperation.then(
    () => undefined,
    () => undefined
  );

  return nextOperation;
}

function buildEmptyEntries(keys: string[]): StorageEntry[] {
  return keys.map((key) => [key, null]);
}

export function getLessonRecordEntries(keys: string[]): Promise<StorageEntry[]> {
  return enqueueLessonRecordOperation(async () => {
    try {
      return await AppStorage.multiGet(keys);
    } catch {
      return buildEmptyEntries(keys);
    }
  });
}

export function setLessonRecordEntries(entries: Array<[string, string]>): Promise<void> {
  if (entries.length === 0) {
    return Promise.resolve();
  }

  return enqueueLessonRecordOperation(() => AppStorage.multiSet(entries));
}

export function removeLessonRecordEntries(keys: string[]): Promise<void> {
  if (keys.length === 0) {
    return Promise.resolve();
  }

  return enqueueLessonRecordOperation(async () => {
    await Promise.all(keys.map((key) => AppStorage.removeItem(key)));
  });
}

export async function getLessonRecordEntriesWithMigration(keys: string[]): Promise<StorageEntry[]> {
  return getLessonRecordEntries(keys);
}
