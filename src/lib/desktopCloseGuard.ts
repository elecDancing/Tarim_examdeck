import { useEffect, useRef, useState } from "react";

type FlushResult = { ok?: boolean; error?: string } | unknown;
type NativeCloseWindow = Window & {
  chrome?: { webview?: { postMessage: (message: unknown) => void } };
  webkit?: { messageHandlers?: { examdeckNativeClose?: { postMessage: (message: unknown) => void } } };
};

type DesktopCloseGuardOptions = {
  enabled: boolean;
  isAnsweringView: boolean;
  flushData: () => Promise<FlushResult> | FlushResult;
  setStatus: (message: string) => void;
};

export function useDesktopCloseGuard({ enabled, isAnsweringView, flushData, setStatus }: DesktopCloseGuardOptions) {
  const [open, setOpen] = useState(false);
  const enabledRef = useRef(enabled);
  const isAnsweringViewRef = useRef(isAnsweringView);
  const flushDataRef = useRef(flushData);
  const setStatusRef = useRef(setStatus);
  const resolveRef = useRef<((allowClose: boolean) => void) | null>(null);

  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { isAnsweringViewRef.current = isAnsweringView; }, [isAnsweringView]);
  useEffect(() => { flushDataRef.current = flushData; }, [flushData]);
  useEffect(() => { setStatusRef.current = setStatus; }, [setStatus]);

  async function flushCurrentData() {
    const result = await flushDataRef.current();
    if (isFailedFlush(result)) {
      setStatusRef.current(`刷题进度保存失败：${result.error ?? "请先导出备份"}`);
      return false;
    }
    setStatusRef.current("刷题进度已保存");
    return true;
  }

  function resolveClose(allowClose: boolean) {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setOpen(false);
    resolve?.(allowClose);
  }

  async function requestCloseDecision() {
    if (!enabledRef.current || !isAnsweringViewRef.current) return flushCurrentData();
    if (resolveRef.current) return false;
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }

  async function saveAndQuit() {
    resolveClose(await flushCurrentData());
  }

  function cancelClose() {
    setStatusRef.current("已取消退出，继续刷题");
    resolveClose(false);
  }

  useEffect(() => {
    if (!enabled) return;

    async function handleNativeCloseRequest(event: Event) {
      const requestId = (event as CustomEvent<{ id?: string }>).detail?.id;
      const allowClose = await requestCloseDecision().catch(() => false);
      if (requestId) postNativeCloseResult(requestId, allowClose);
    }

    window.examdeckRequestClose = requestCloseDecision;
    window.addEventListener("examdeck-native-close-request", handleNativeCloseRequest);
    return () => {
      if (window.examdeckRequestClose === requestCloseDecision) delete window.examdeckRequestClose;
      window.removeEventListener("examdeck-native-close-request", handleNativeCloseRequest);
    };
  }, [enabled]);

  return { open, saveAndQuit, cancelClose };
}

function isFailedFlush(result: FlushResult): result is { ok: false; error?: string } {
  return Boolean(result && typeof result === "object" && "ok" in result && result.ok === false);
}

function postNativeCloseResult(id: string, allowClose: boolean) {
  const message = { channel: "examdeckNativeClose", type: "result", request: { id, allowClose } };
  const nativeWindow = window as NativeCloseWindow;
  nativeWindow.chrome?.webview?.postMessage(message);
  nativeWindow.webkit?.messageHandlers?.examdeckNativeClose?.postMessage(message);
}
