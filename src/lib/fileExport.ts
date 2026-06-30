import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

type SaveFilePickerHandle = {
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
};

type NativeSaveRequest = {
  id: string;
  fileName: string;
  mimeType: string;
  totalChunks?: number;
  chunkIndex?: number;
  base64?: string;
};

type NativeSaveMessage = {
  type: "start" | "chunk" | "finish";
  request: NativeSaveRequest;
};

type NativeSaveResult = {
  id: string;
  status: "saved" | "cancelled" | "error";
  message?: string;
};

type NativeSaveHandler = {
  postMessage: (message: NativeSaveMessage) => void;
};

type NativeSaveWindow = Window & {
  webkit?: {
    messageHandlers?: {
      examdeckNativeSaveFile?: NativeSaveHandler;
    };
  };
  chrome?: {
    webview?: {
      postMessage: (message: NativeSaveMessage & { channel?: string }) => void;
    };
  };
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<SaveFilePickerHandle>;
};

const NATIVE_SAVE_CHUNK_BYTES = 384 * 1024;

export async function saveBlob(blob: Blob, fileName: string, mimeType = blob.type || "application/octet-stream") {
  const nativeSave = (window as NativeSaveWindow).webkit?.messageHandlers?.examdeckNativeSaveFile;
  if (nativeSave) {
    await saveBlobWithNativePanel(nativeSave, blob, fileName, mimeType);
    return;
  }

  const webView2 = (window as NativeSaveWindow).chrome?.webview;
  if (webView2) {
    await saveBlobWithNativePanel({
      postMessage: (message) => webView2.postMessage({ channel: "examdeckNativeSaveFile", ...message })
    }, blob, fileName, mimeType);
    return;
  }

  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    await saveBlobWithAndroidShare(blob, fileName);
    return;
  }

  const saveFilePicker = (window as NativeSaveWindow).showSaveFilePicker;
  if (saveFilePicker) {
    await saveBlobWithBrowserPicker(saveFilePicker, blob, fileName, mimeType);
    return;
  }

  if (window.location.protocol === "examdeck:") {
    throw new Error("当前桌面版缺少保存文件支持，请安装最新版本后重试");
  }

  downloadBlob(blob, fileName);
}

async function saveBlobWithBrowserPicker(
  saveFilePicker: NonNullable<NativeSaveWindow["showSaveFilePicker"]>,
  blob: Blob,
  fileName: string,
  mimeType: string
) {
  const extension = getFileExtension(fileName);
  const fileHandle = await saveFilePicker({
    suggestedName: fileName,
    types: [{
      description: extension ? `${extension.toUpperCase()} 文件` : "导出文件",
      accept: { [mimeType]: extension ? [`.${extension}`] : [] }
    }]
  });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

async function saveBlobWithAndroidShare(blob: Blob, fileName: string) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const safeFileName = sanitizeFileName(fileName);
  const path = `exports/${Date.now()}-${safeFileName}`;

  await Filesystem.writeFile({
    path,
    data: bytesToBase64(bytes),
    directory: Directory.Cache,
    recursive: true
  });

  const { uri } = await Filesystem.getUri({
    path,
    directory: Directory.Cache
  });

  await Share.share({
    title: safeFileName,
    text: `导出文件：${safeFileName}`,
    url: uri,
    dialogTitle: "保存或分享文件"
  });
}

async function saveBlobWithNativePanel(
  nativeSave: NativeSaveHandler,
  blob: Blob,
  fileName: string,
  mimeType: string
) {
  const id = `save_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const totalChunks = Math.max(1, Math.ceil(bytes.byteLength / NATIVE_SAVE_CHUNK_BYTES));

  const resultPromise = waitForNativeSaveResult(id);
  nativeSave.postMessage({ type: "start", request: { id, fileName, mimeType, totalChunks } });

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const start = chunkIndex * NATIVE_SAVE_CHUNK_BYTES;
    const end = Math.min(bytes.byteLength, start + NATIVE_SAVE_CHUNK_BYTES);
    nativeSave.postMessage({
      type: "chunk",
      request: {
        id,
        fileName,
        mimeType,
        totalChunks,
        chunkIndex,
        base64: bytesToBase64(bytes.subarray(start, end))
      }
    });
  }

  nativeSave.postMessage({ type: "finish", request: { id, fileName, mimeType, totalChunks } });
  const result = await resultPromise;
  if (result.status === "cancelled") throw new DOMException("用户取消保存", "AbortError");
  if (result.status === "error") throw new Error(result.message || "保存文件失败");
}

function waitForNativeSaveResult(id: string) {
  return new Promise<NativeSaveResult>((resolve) => {
    function handleEvent(event: Event) {
      const detail = (event as CustomEvent<NativeSaveResult>).detail;
      if (!detail || detail.id !== id) return;
      window.removeEventListener("examdeck-save-file-result", handleEvent);
      resolve(detail);
    }

    window.addEventListener("examdeck-save-file-result", handleEvent);
  });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

function getFileExtension(fileName: string) {
  const match = fileName.match(/\.([^.]+)$/);
  return match?.[1]?.toLowerCase() ?? "";
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[\\/:*?"<>|]/g, "_").trim() || "examdeck-export.bin";
}
