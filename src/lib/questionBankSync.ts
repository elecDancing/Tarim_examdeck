import type { Question } from "../types";

type NativeQuestionBankSyncWindow = Window & {
  chrome?: { webview?: { postMessage: (message: unknown) => void } };
  webkit?: { messageHandlers?: { examdeckQuestionBankSync?: { postMessage: (message: unknown) => void } } };
};

export type QuestionBankSyncResult = {
  ok: boolean;
  skipped?: boolean;
  message?: string;
  path?: string;
};

let syncSequence = 0;

export function syncEditedQuestionToCanonicalBank(question: Question): Promise<QuestionBankSyncResult> {
  const id = `question_sync_${Date.now()}_${syncSequence += 1}`;
  const nativeWindow = window as NativeQuestionBankSyncWindow;
  const nativeMac = nativeWindow.webkit?.messageHandlers?.examdeckQuestionBankSync;
  const nativeWindows = nativeWindow.chrome?.webview;
  if (!nativeMac && !nativeWindows) return Promise.resolve({ ok: false, skipped: true, message: "当前运行环境不支持写回题库源" });

  return new Promise((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => finish({ ok: false, message: "写回题库源超时" }), 3000);
    function finish(result: QuestionBankSyncResult) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener("examdeck-question-bank-sync-result", handleResult);
      resolve(result);
    }
    function handleResult(event: Event) {
      const detail = (event as CustomEvent<QuestionBankSyncResult & { id?: string }>).detail;
      if (detail?.id !== id) return;
      finish(detail);
    }
    window.addEventListener("examdeck-question-bank-sync-result", handleResult);
    const request = { id, question };
    nativeMac?.postMessage({ type: "questionEdit", request });
    nativeWindows?.postMessage({ channel: "examdeckQuestionBankSync", type: "questionEdit", request });
  });
}
