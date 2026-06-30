import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import type { AppData } from "../types";
import { saveData } from "./storage";

type AndroidLifecycleOptions = {
  dataRef: MutableRefObject<AppData>;
  view: string;
  activeDeckId: string | null;
  isAnsweringView: boolean;
  navOpen: boolean;
  answerProgressCollapsed: boolean;
  detailQuestionId: string | null;
  editingQuestionId: string | null;
  showCopyright: boolean;
  hasDeckActionDialog: boolean;
  dailyReviewFinishDialogOpen: boolean;
  setNavOpen: (value: boolean) => void;
  setSidebarCollapsed: (value: boolean) => void;
  setAnswerProgressCollapsed: (value: boolean) => void;
  setDetailQuestionId: (value: string | null) => void;
  setEditingQuestionId: (value: string | null) => void;
  setShowCopyright: (value: boolean) => void;
  setDeckActionDialog: (value: null) => void;
  setDailyReviewFinishDialogOpen: (value: boolean) => void;
  setView: (value: "home" | "dashboard") => void;
  goHome: () => void;
  requestAnsweringLeave: () => void;
  setStatus: (value: string) => void;
};

export function useAndroidLifecycle(options: AndroidLifecycleOptions) {
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (!isNativeAndroid()) return;
    document.documentElement.classList.add("native-android");
    void navigator.storage?.persist?.();

    let disposed = false;
    const removers: Array<() => void> = [];
    const focusEditable = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        window.setTimeout(() => target.focus({ preventScroll: true }), 0);
      }
    };
    const flush = () => saveData(optionsRef.current.dataRef.current);
    const flushOnHidden = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const handleBack = () => {
      const current = optionsRef.current;
      void flush();
      if (current.detailQuestionId) return current.setDetailQuestionId(null);
      if (current.editingQuestionId) return current.setEditingQuestionId(null);
      if (current.showCopyright) return current.setShowCopyright(false);
      if (current.hasDeckActionDialog) return current.setDeckActionDialog(null);
      if (current.dailyReviewFinishDialogOpen) return current.setDailyReviewFinishDialogOpen(false);
      if (current.navOpen) return current.setNavOpen(false);
      if (current.isAnsweringView && !current.answerProgressCollapsed) return current.setAnswerProgressCollapsed(true);
      if (current.isAnsweringView) {
        current.setNavOpen(false);
        current.requestAnsweringLeave();
        return;
      }
      if (current.view !== "home") {
        if (current.activeDeckId && current.view !== "dashboard") current.setView("dashboard");
        else current.goHome();
        current.setStatus("进度已保存");
        return;
      }
      void flush().finally(() => CapacitorApp.exitApp());
    };

    document.addEventListener("visibilitychange", flushOnHidden);
    document.addEventListener("touchend", focusEditable, true);
    document.addEventListener("pointerup", focusEditable, true);
    window.addEventListener("pagehide", flush);
    window.addEventListener("freeze", flush);
    removers.push(() => document.removeEventListener("visibilitychange", flushOnHidden));
    removers.push(() => document.removeEventListener("touchend", focusEditable, true));
    removers.push(() => document.removeEventListener("pointerup", focusEditable, true));
    removers.push(() => window.removeEventListener("pagehide", flush));
    removers.push(() => window.removeEventListener("freeze", flush));

    void CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) void flush();
    }).then((handle) => {
      if (disposed) void handle.remove();
      else removers.push(() => void handle.remove());
    });
    void CapacitorApp.addListener("backButton", handleBack).then((handle) => {
      if (disposed) void handle.remove();
      else removers.push(() => void handle.remove());
    });

    return () => {
      disposed = true;
      document.documentElement.classList.remove("native-android");
      removers.forEach((remove) => remove());
    };
  }, []);
}

function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}
