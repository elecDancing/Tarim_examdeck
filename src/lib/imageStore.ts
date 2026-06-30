const IMAGE_DB_NAME = "examdeck-images";
const IMAGE_DB_VERSION = 1;
const IMAGE_STORE_NAME = "questionImages";
const IMAGE_REF_PREFIX = "examdeck-image:";

type StoredQuestionImage = {
  id: string;
  blob: Blob;
  mimeType: string;
  updatedAt: string;
};

export type QuestionImageBackupItem = {
  id: string;
  mimeType: string;
  updatedAt?: string;
  base64: string;
};

const objectUrlCache = new Map<string, string>();

export function buildStoredImageRef(id: string) {
  return `${IMAGE_REF_PREFIX}${id}`;
}

export function isStoredImageRef(url: string) {
  return url.startsWith(IMAGE_REF_PREFIX);
}

export async function saveQuestionImage(id: string, blob: Blob, mimeType: string) {
  const database = await openImageDatabase();
  await runImageTransaction(database, "readwrite", (store) => {
    store.put({ id, blob, mimeType, updatedAt: new Date().toISOString() } satisfies StoredQuestionImage);
  });
}

export async function resolveQuestionImageUrl(url: string) {
  if (!isStoredImageRef(url)) return url;
  const id = url.slice(IMAGE_REF_PREFIX.length);
  const cached = objectUrlCache.get(id);
  if (cached) return cached;

  const image = await getStoredImage(id);
  if (!image) return "";
  const objectUrl = URL.createObjectURL(image.blob);
  objectUrlCache.set(id, objectUrl);
  return objectUrl;
}

export async function clearQuestionImages() {
  objectUrlCache.forEach((url) => URL.revokeObjectURL(url));
  objectUrlCache.clear();
  const database = await openImageDatabase();
  await runImageTransaction(database, "readwrite", (store) => {
    store.clear();
  });
}

export async function exportStoredQuestionImages(refs: string[]) {
  const uniqueIds = [...new Set(refs.filter(isStoredImageRef).map((ref) => ref.slice(IMAGE_REF_PREFIX.length)))];
  const images: QuestionImageBackupItem[] = [];
  for (const id of uniqueIds) {
    const image = await getStoredImage(id);
    if (!image) continue;
    images.push({
      id,
      mimeType: image.mimeType,
      updatedAt: image.updatedAt,
      base64: await blobToBase64(image.blob)
    });
  }
  return images;
}

export async function importStoredQuestionImages(images: QuestionImageBackupItem[]) {
  for (const image of images) {
    if (!image.id || !image.base64) continue;
    const bytes = base64ToUint8Array(image.base64);
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    await saveQuestionImage(image.id, new Blob([buffer], { type: image.mimeType || "application/octet-stream" }), image.mimeType || "application/octet-stream");
  }
}

async function getStoredImage(id: string) {
  const database = await openImageDatabase();
  return runImageTransaction<StoredQuestionImage | undefined>(database, "readonly", (store, resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result as StoredQuestionImage | undefined);
    request.onerror = () => reject(request.error);
  });
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.slice(result.indexOf(",") + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("图片备份读取失败"));
    reader.readAsDataURL(blob);
  });
}

function base64ToUint8Array(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function openImageDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(IMAGE_DB_NAME, IMAGE_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(IMAGE_STORE_NAME)) {
        database.createObjectStore(IMAGE_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runImageTransaction<T = void>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void
) {
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(IMAGE_STORE_NAME, mode);
    const store = transaction.objectStore(IMAGE_STORE_NAME);
    transaction.oncomplete = () => resolve(undefined as T);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
    work(store, resolve, reject);
  });
}
