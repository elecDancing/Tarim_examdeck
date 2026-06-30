import { useEffect, useRef } from "react";
import type { DailyReviewSession, Deck, ExamSession, PracticeState, Question } from "../types";
import { getPracticeActiveIndex, getPracticeMode, isHardQuestionDeck } from "./appRules";

type AndroidAnswerSwipeOptions = {
  isAnsweringView: boolean;
  view: string;
  activeSession: ExamSession | null;
  currentIndex: number;
  activeReviewSession: DailyReviewSession | null;
  reviewIndex: number;
  activePractice: PracticeState | undefined;
  activeDeck: Deck | null | undefined;
  questionById: Map<string, Question>;
  goToExamIndex: (index: number) => void;
  goToReviewIndex: (index: number) => void;
  setPracticeIndex: (index: number) => void;
  confirmDailyReviewQuestion: () => void;
  confirmPracticeQuestion: () => void;
};

function isNativeAndroid() {
  return document.documentElement.classList.contains("native-android");
}

function isIgnoredSwipeTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(
    target.closest("button, a, input, textarea, select, [contenteditable='true'], .option-button, .question-panel-actions, .question-note-panel, .practice-answer-search, .mode-switch, .exam-topbar, .sidebar, .question-nav, .modal-backdrop, .android-submit-summary-backdrop")
  );
}

function isIgnoredTapTarget(target: EventTarget | null, allowOptionTap: boolean) {
  if (!(target instanceof Element)) return false;
  if (target.closest(".option-button")) return !allowOptionTap;
  return Boolean(
    target.closest("button, a, input, textarea, select, [contenteditable='true'], .question-panel-actions, .question-note-panel, .practice-answer-search, .mode-switch, .exam-topbar, .sidebar, .exam-actions, .question-nav, .answer-progress-dismiss-layer, .mobile-nav-dismiss-layer, .modal-backdrop, .android-submit-summary-backdrop")
  );
}

type SwipeDirection = "previous" | "next";

const SWIPE_INTENT_PX = 6;
const SWIPE_COMMIT_MIN_PX = 72;
const SWIPE_COMMIT_MAX_PX = 108;
const SWIPE_COMMIT_RATIO = 0.24;
const SWIPE_TAP_MAX_MOVE_PX = 9;
const SWIPE_MAX_DRAG_PX = 196;
const SWIPE_RESET_MS = 220;
const SWIPE_COMMIT_MS = 155;
const SWIPE_TAP_DEBOUNCE_MS = 220;

function getSwipeStage() {
  return document.querySelector<HTMLElement>(".android-question-swipe-stage");
}

function getSwipeCommitPx() {
  return Math.min(SWIPE_COMMIT_MAX_PX, Math.max(SWIPE_COMMIT_MIN_PX, window.innerWidth * SWIPE_COMMIT_RATIO));
}

function setStageVars(stage: HTMLElement, dx: number, progress: number) {
  const previewLift = 24 * (1 - progress);
  stage.style.setProperty("--android-swipe-x", `${dx.toFixed(1)}px`);
  stage.style.setProperty("--android-swipe-progress", progress.toFixed(3));
  stage.style.setProperty("--android-swipe-preview-opacity", (progress > 0 ? 0.1 + progress * 0.88 : 0).toFixed(3));
  stage.style.setProperty("--android-swipe-preview-blur", `${Math.max(0, 14 - progress * 14).toFixed(1)}px`);
  stage.style.setProperty("--android-swipe-preview-scale", (0.94 + progress * 0.06).toFixed(3));
  stage.style.setProperty("--android-swipe-preview-y", `${previewLift.toFixed(1)}px`);
}

export function useAndroidAnswerSwipe(options: AndroidAnswerSwipeOptions) {
  const latestOptionsRef = useRef(options);
  latestOptionsRef.current = options;

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let lastDx = 0;
    let tracking = false;
    let horizontalIntent = false;
    let committedSwipe = false;
    let activeInput: "touch" | "pointer" | null = null;
    let activePointerId: number | null = null;
    let startTarget: EventTarget | null = null;
    let lastTapNavigateAt = 0;
    let resetTimer: number | undefined;
    let commitTimer: number | undefined;

    const goPrevious = () => {
      const {
        view,
        activeSession,
        currentIndex,
        activeReviewSession,
        reviewIndex,
        activePractice,
        goToExamIndex,
        goToReviewIndex,
        setPracticeIndex
      } = latestOptionsRef.current;
      if (view === "exam" && activeSession) {
        if (currentIndex > 0) {
          goToExamIndex(currentIndex - 1);
          return true;
        }
        return false;
      }
      if (view === "review" && activeReviewSession) {
        if (reviewIndex > 0) {
          goToReviewIndex(reviewIndex - 1);
          return true;
        }
        return false;
      }
      if (view === "practice" && activePractice) {
        const index = getPracticeActiveIndex(activePractice);
        if (index > 0) {
          setPracticeIndex(index - 1);
          return true;
        }
      }
      return false;
    };

    const goDirectNext = () => {
      const {
        view,
        activeSession,
        currentIndex,
        activeReviewSession,
        reviewIndex,
        activePractice,
        goToExamIndex,
        goToReviewIndex,
        setPracticeIndex
      } = latestOptionsRef.current;
      if (view === "exam" && activeSession) {
        if (currentIndex < activeSession.items.length - 1) {
          goToExamIndex(currentIndex + 1);
          return true;
        }
        return false;
      }
      if (view === "review" && activeReviewSession) {
        if (reviewIndex < activeReviewSession.items.length - 1) {
          goToReviewIndex(reviewIndex + 1);
          return true;
        }
        return false;
      }
      if (view === "practice" && activePractice) {
        const index = getPracticeActiveIndex(activePractice);
        if (index < activePractice.questionIds.length - 1) {
          setPracticeIndex(index + 1);
          return true;
        }
      }
      return false;
    };

    const navigateByDirection = (direction: SwipeDirection) => (
      direction === "previous" ? goPrevious() : goDirectNext()
    );

    const canGoPrevious = () => {
      const { view, activeSession, currentIndex, activeReviewSession, reviewIndex, activePractice } = latestOptionsRef.current;
      if (view === "exam") return Boolean(activeSession && currentIndex > 0);
      if (view === "review") return Boolean(activeReviewSession && reviewIndex > 0);
      if (view === "practice") return Boolean(activePractice && getPracticeActiveIndex(activePractice) > 0);
      return false;
    };

    const canGoNext = () => {
      const { view, activeSession, currentIndex, activeReviewSession, reviewIndex, activePractice } = latestOptionsRef.current;
      if (view === "exam") return Boolean(activeSession && currentIndex < activeSession.items.length - 1);
      if (view === "review") return Boolean(activeReviewSession && reviewIndex < activeReviewSession.items.length - 1);
      if (view === "practice") return Boolean(activePractice && getPracticeActiveIndex(activePractice) < activePractice.questionIds.length - 1);
      return false;
    };

    const clearSwipeTimers = () => {
      if (resetTimer) window.clearTimeout(resetTimer);
      if (commitTimer) window.clearTimeout(commitTimer);
      resetTimer = undefined;
      commitTimer = undefined;
    };

    const resetStage = () => {
      const stage = getSwipeStage();
      if (!stage) return;
      if (resetTimer) window.clearTimeout(resetTimer);
      stage.classList.remove("android-swiping", "android-swipe-committing", "android-swipe-edge");
      stage.classList.add("android-swipe-resetting");
      setStageVars(stage, 0, 0);
      resetTimer = window.setTimeout(() => {
        stage.classList.remove("android-swipe-resetting", "android-swipe-prev", "android-swipe-next");
      }, SWIPE_RESET_MS);
    };

    const setStageOffset = (dx: number) => {
      const stage = getSwipeStage();
      if (!stage) return;
      const direction: SwipeDirection = dx > 0 ? "previous" : "next";
      const canCommit = direction === "previous" ? canGoPrevious() : canGoNext();
      const resistedDx = dx * (canCommit ? 1 : 0.34);
      const clampedDx = Math.max(-SWIPE_MAX_DRAG_PX, Math.min(SWIPE_MAX_DRAG_PX, resistedDx));
      const progress = Math.min(1, Math.abs(clampedDx) / getSwipeCommitPx());
      stage.classList.remove("android-swipe-resetting", "android-swipe-committing");
      stage.classList.add("android-swiping");
      stage.classList.toggle("android-swipe-prev", dx > 0);
      stage.classList.toggle("android-swipe-next", dx < 0);
      stage.classList.toggle("android-swipe-edge", !canCommit);
      setStageVars(stage, clampedDx, progress);
    };

    const commitSwipe = (direction: SwipeDirection) => {
      const canCommit = direction === "previous" ? canGoPrevious() : canGoNext();
      if (!canCommit) {
        resetStage();
        return false;
      }
      const stage = getSwipeStage();
      if (commitTimer) window.clearTimeout(commitTimer);
      committedSwipe = true;
      tracking = false;
      horizontalIntent = false;
      activeInput = null;
      activePointerId = null;
      if (stage) {
        stage.classList.remove("android-swiping", "android-swipe-edge");
        stage.classList.add("android-swipe-committing", direction === "previous" ? "android-swipe-prev" : "android-swipe-next");
        setStageVars(stage, direction === "previous" ? window.innerWidth : -window.innerWidth, 1);
      }
      const didNavigate = navigateByDirection(direction);
      if (!didNavigate) {
        resetStage();
        committedSwipe = false;
        return false;
      }
      commitTimer = window.setTimeout(() => {
        resetStage();
        committedSwipe = false;
      }, SWIPE_COMMIT_MS);
      return true;
    };

    const shouldCommitSwipe = (dx: number, dy: number) => {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      const horizontalEnough = absDx > absDy * 0.38;
      return absDx >= getSwipeCommitPx() && horizontalEnough;
    };

    const isCurrentAnswered = () => {
      const { view, activeSession, activeReviewSession, reviewIndex, activePractice, activeDeck } = latestOptionsRef.current;
      if (view === "exam") return Boolean(activeSession?.submittedAt);
      if (view === "review" && activeReviewSession) return activeReviewSession.items[reviewIndex]?.isCorrect !== undefined;
      if (view === "practice" && activePractice) {
        const index = getPracticeActiveIndex(activePractice);
        const questionId = activePractice.questionIds[index];
        const mode = activeDeck && isHardQuestionDeck(activeDeck) ? "answer" : getPracticeMode(activePractice);
        return mode === "review" || Boolean(activePractice.submittedAt) || activePractice.results?.[questionId] !== undefined;
      }
      return false;
    };

    const tapNavigateAt = (clientX: number, target: EventTarget | null) => {
      const now = performance.now();
      if (now - lastTapNavigateAt < SWIPE_TAP_DEBOUNCE_MS) return false;
      if (isIgnoredTapTarget(target, isCurrentAnswered())) return false;
      const ratio = clientX / Math.max(1, window.innerWidth);
      if (ratio <= 0.32) {
        const didNavigate = commitSwipe("previous");
        if (didNavigate) lastTapNavigateAt = now;
        return didNavigate;
      }
      if (ratio >= 0.68) {
        const didNavigate = commitSwipe("next");
        if (didNavigate) lastTapNavigateAt = now;
        return didNavigate;
      }
      return false;
    };

    const maybeTapNavigate = (clientX: number, clientY: number, target: EventTarget | null) => {
      if (Math.abs(clientX - startX) > SWIPE_TAP_MAX_MOVE_PX || Math.abs(clientY - startY) > SWIPE_TAP_MAX_MOVE_PX) return false;
      if (isIgnoredTapTarget(startTarget, isCurrentAnswered())) return false;
      return tapNavigateAt(clientX, target);
    };

    const beginSwipe = (clientX: number, clientY: number, target: EventTarget | null, input: "touch" | "pointer") => {
      if (!latestOptionsRef.current.isAnsweringView || !isNativeAndroid() || isIgnoredSwipeTarget(target) || !getSwipeStage()) {
        tracking = false;
        if (activeInput === input) activeInput = null;
        return;
      }
      startX = clientX;
      startY = clientY;
      lastDx = 0;
      tracking = true;
      horizontalIntent = false;
      committedSwipe = false;
      activeInput = input;
      startTarget = target;
      clearSwipeTimers();
    };

    const moveSwipe = (clientX: number, clientY: number, preventDefault: () => void) => {
      if (!tracking) return;
      const dx = clientX - startX;
      const dy = clientY - startY;
      lastDx = dx;
      if (!horizontalIntent) {
        if (Math.abs(dy) > 18 && Math.abs(dy) > Math.abs(dx) * 1.9) {
          tracking = false;
          activeInput = null;
          activePointerId = null;
          resetStage();
          return;
        }
        if (Math.abs(dx) < SWIPE_INTENT_PX || Math.abs(dx) < Math.abs(dy) * 0.35) return;
        horizontalIntent = true;
      }
      preventDefault();
      setStageOffset(dx);
    };

    const finishSwipe = (clientX: number, clientY: number, target: EventTarget | null, preventDefault: () => void) => {
      if (committedSwipe || !tracking || !latestOptionsRef.current.isAnsweringView || !isNativeAndroid()) return;
      const dx = clientX - startX || lastDx;
      const dy = clientY - startY;
      const hadHorizontalIntent = horizontalIntent;
      tracking = false;
      horizontalIntent = false;
      activeInput = null;
      activePointerId = null;
      if (!hadHorizontalIntent) {
        if (maybeTapNavigate(clientX, clientY, target)) preventDefault();
        startTarget = null;
        return;
      }
      preventDefault();
      const direction: SwipeDirection = dx > 0 ? "previous" : "next";
      if (shouldCommitSwipe(dx, dy)) commitSwipe(direction);
      else resetStage();
      startTarget = null;
    };

    const cancelSwipe = () => {
      if (committedSwipe) return;
      tracking = false;
      horizontalIntent = false;
      activeInput = null;
      activePointerId = null;
      startTarget = null;
      resetStage();
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        tracking = false;
        activeInput = null;
        activePointerId = null;
        return;
      }
      const touch = event.touches[0];
      activePointerId = null;
      startX = touch.clientX;
      startY = touch.clientY;
      startTarget = event.target;
      beginSwipe(touch.clientX, touch.clientY, event.target, "touch");
    };

    const onTouchMove = (event: TouchEvent) => {
      if (activeInput !== "touch" || event.touches.length !== 1) return;
      const touch = event.touches[0];
      moveSwipe(touch.clientX, touch.clientY, () => event.preventDefault());
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (event.changedTouches.length < 1) return;
      const touch = event.changedTouches[0];
      if (activeInput === "touch") finishSwipe(touch.clientX, touch.clientY, event.target, () => event.preventDefault());
      else if (maybeTapNavigate(touch.clientX, touch.clientY, event.target)) event.preventDefault();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (activeInput || event.pointerType === "mouse") return;
      startX = event.clientX;
      startY = event.clientY;
      startTarget = event.target;
      beginSwipe(event.clientX, event.clientY, event.target, "pointer");
      if (tracking) activePointerId = event.pointerId;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (activeInput !== "pointer" || activePointerId !== event.pointerId) return;
      moveSwipe(event.clientX, event.clientY, () => event.preventDefault());
    };

    const onPointerUp = (event: PointerEvent) => {
      if (activeInput === "pointer" && activePointerId === event.pointerId) {
        finishSwipe(event.clientX, event.clientY, event.target, () => event.preventDefault());
        return;
      }
      if (!activeInput && maybeTapNavigate(event.clientX, event.clientY, event.target)) event.preventDefault();
    };

    const onPointerCancel = (event: PointerEvent) => {
      if (activeInput !== "pointer" || activePointerId !== event.pointerId) return;
      cancelSwipe();
    };

    const onClickFallback = (event: MouseEvent) => {
      if (!latestOptionsRef.current.isAnsweringView || !isNativeAndroid() || activeInput || committedSwipe || !getSwipeStage()) return;
      if (tapNavigateAt(event.clientX, event.target)) event.preventDefault();
    };

    const listenerTarget = document;
    listenerTarget.addEventListener("touchstart", onTouchStart as EventListener, { passive: true, capture: true });
    listenerTarget.addEventListener("pointerdown", onPointerDown as EventListener, { passive: true, capture: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
    document.addEventListener("touchend", onTouchEnd, { passive: false, capture: true });
    document.addEventListener("touchcancel", cancelSwipe, true);
    document.addEventListener("pointermove", onPointerMove, { passive: false, capture: true });
    document.addEventListener("pointerup", onPointerUp, { passive: false, capture: true });
    document.addEventListener("pointercancel", onPointerCancel, true);
    document.addEventListener("click", onClickFallback, true);
    return () => {
      listenerTarget.removeEventListener("touchstart", onTouchStart as EventListener, true);
      listenerTarget.removeEventListener("pointerdown", onPointerDown as EventListener, true);
      document.removeEventListener("touchmove", onTouchMove, true);
      document.removeEventListener("touchend", onTouchEnd, true);
      document.removeEventListener("touchcancel", cancelSwipe, true);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", onPointerCancel, true);
      document.removeEventListener("click", onClickFallback, true);
      clearSwipeTimers();
      const stage = getSwipeStage();
      if (stage) {
        stage.classList.remove("android-swiping", "android-swipe-resetting", "android-swipe-committing", "android-swipe-prev", "android-swipe-next", "android-swipe-edge");
        setStageVars(stage, 0, 0);
      }
    };
  }, []);

  useEffect(() => {
    if (options.isAnsweringView) return;
    const stage = getSwipeStage();
    if (!stage) return;
    stage.classList.remove("android-swiping", "android-swipe-resetting", "android-swipe-committing", "android-swipe-prev", "android-swipe-next", "android-swipe-edge");
    setStageVars(stage, 0, 0);
  }, [options.isAnsweringView]);
}
