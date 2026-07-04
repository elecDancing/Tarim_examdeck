import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Capacitor } from "@capacitor/core";

type PracticeAnswerSearchOverlayProps = {
  open: boolean;
  setOpen: (value: boolean) => void;
  children: ReactNode;
};

function isNativeAndroidRuntime() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export function PracticeAnswerSearchOverlay({ open, setOpen, children }: PracticeAnswerSearchOverlayProps) {
  const useAndroidPortal = useMemo(() => isNativeAndroidRuntime(), []);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!useAndroidPortal) return;
    setPortalTarget(document.body);
  }, [useAndroidPortal]);

  useEffect(() => {
    if (!useAndroidPortal || !open) return;
    const viewport = window.visualViewport;
    const syncViewport = () => {
      const height = viewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--android-answer-search-vh", `${Math.max(320, height)}px`);
    };
    syncViewport();
    viewport?.addEventListener("resize", syncViewport);
    viewport?.addEventListener("scroll", syncViewport);
    return () => {
      viewport?.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("scroll", syncViewport);
      document.documentElement.style.removeProperty("--android-answer-search-vh");
    };
  }, [open, useAndroidPortal]);

  const overlay = (
    <div
      className={open ? "practice-answer-search open" : "practice-answer-search"}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <button className="practice-search-handle" type="button" aria-label="打开搜题" aria-expanded={open} onClick={() => setOpen(true)} />
      {children}
    </div>
  );

  if (useAndroidPortal && !portalTarget) return null;
  if (useAndroidPortal && portalTarget) return createPortal(overlay, portalTarget);
  return overlay;
}
