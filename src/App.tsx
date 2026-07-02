import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEvent, ReactNode } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { CopyrightDialog } from "./components/CopyrightDialog";
import { DailyReviewFinishDialog } from "./components/DailyReviewFinishDialog";
import { DesktopCloseConfirmDialog } from "./components/DesktopCloseConfirmDialog";
import { FeatureGuide } from "./components/FeatureGuide";
import { MistakePracticeFinishDialog } from "./components/MistakePracticeFinishDialog";
import { AnswerProgressDismissLayer, isAnswerProgressBlankTap, MobileNavDismissLayer } from "./components/AndroidInteractionLayers";
import { AnswerNavToggle, AnswerProgressToggle, RecentSessions, ResultSummary } from "./components/AnswerNavigation";
import { AndroidQuestionSwipeStage } from "./components/AndroidQuestionSwipeStage";
import { SearchTextInput } from "./components/SearchTextInput";
import { HighlightedRichText, ProficiencyBadge, RichText } from "./components/RichText";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Menu,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Play,
  RotateCcw,
  Search,
  Settings,
  Shuffle,
  Star,
  Sword,
  Trash2,
  Upload,
  XCircle
} from "lucide-react";
import type { AppData, ChoiceOption, DailyMistakeSummary, DailyReviewItem, DailyReviewSession, DailyStudyStat, Deck, ExamConfig, ExamItem, ExamSession, ImportReport, PracticeMode, PracticeState, ProficiencyLevel, Question, QuestionStat, QuestionType } from "./types";
import { buildExamItems, getOrderedOptions, isAnswerCorrect, optionDisplayKey } from "./lib/exam";
import { exportQuestionDecksToZip, exportQuestionsToExcel } from "./lib/excelExport";
import { extractEmbeddedImages, mergeQuestions, parseExcelFile, parseExcelWorkbook } from "./lib/excelImport";
import { clearQuestionImages, importStoredQuestionImages, isStoredImageRef, resolveQuestionImageUrl } from "./lib/imageStore";
import { emptyData, exportData, loadData, loadDataFromPersistentStorage, saveData } from "./lib/storage";
import { syncEditedQuestionToCanonicalBank } from "./lib/questionBankSync";
import { useAndroidLifecycle } from "./lib/androidLifecycle";
import { useAndroidAnswerSwipe } from "./lib/androidAnswerSwipe";
import { useDesktopCloseGuard } from "./lib/desktopCloseGuard";
import { clearPersonalDataForInitialization, loadBootstrapSeedData, restoreSeedDecksFromBootstrap } from "./lib/softwareInitialization";
import { scrollElementToTop, scrollWindowToTop } from "./lib/domScroll";
import {
  countByType,
  buildDefaultExamConfig,
  buildQuickExamConfig,
  getProficiency,
  getQuestionImageUrls,
  countProficiency,
  isActiveMistake,
  shouldTriggerMistakeClearAnimation,
  shouldTriggerHardQuestionClearAnimation,
  buildDailySummaryWrongQuestions,
  buildReviewDayActivitySummary,
  isAllDailyReviewCompleteForToday,
  searchQuestions,
  getSearchTerms,
  escapeRegExp,
  groupQuestionsByType,
  scoreQuestionMatch,
  scoreSearchField,
  canUseOrderedFuzzy,
  orderedMatchScore,
  normalizeSearchText,
  buildDeckNamesByQuestionId,
  getQuestionDeckNames,
  buildProficiencyPieStyle,
  buildPieSegments,
  describePieSlice,
  polarToCartesian,
  getProficiencyChartColor,
  formatPercent,
  buildDailyReviewSummary,
  buildDailyReviewPlan,
  buildDailyReviewCandidates,
  compareDailyReviewNeed,
  buildReviewForecast,
  buildReviewForecastQuestionGroups,
  buildForecastCumulativePoints,
  formatForecastDayLabel,
  isLearnedQuestion,
  getReviewIntervalDays,
  getReviewDueDate,
  parseStatDate,
  startOfLocalDay,
  startOfReviewDay,
  addLocalDays,
  differenceInLocalDays,
  differenceInReviewDays,
  isDailyReviewSessionCurrent,
  isDailyReviewSessionComplete,
  isHardQuestionDeck,
  isAllDailyReviewDeck,
  buildAllDailyReviewDeck,
  getDeckQuestions,
  parseProgressBackup,
  hasBootstrapProgressImportMarker,
  markBootstrapProgressImported,
  shouldImportBootstrapProgress,
  mergeBootstrapDataWithCurrentProgress,
  shouldUsePersistentData,
  getTimeGreeting,
  formatSidebarSubtitle,
  migrateBundledQuestionImages,
  normalizeAppDataForCurrentRules,
  getBundledSafetyImagePath,
  isRecord,
  normalizeDailyReviewSession,
  getCurrentDailyReviewSession,
  getInitialDailyReviewSession,
  removeDailyReviewSessionFromData,
  getStoredSessionIndex,
  normalizeActiveExamSession,
  getRestorableActiveSession,
  buildDailyReviewFinishPromptKey,
  areDailyReviewSessionsEqual,
  areExamSessionsEqual,
  areDailyMistakeSummariesEqual,
  extractProgressBackupImages,
  addFinishedSession,
  dedupeExamSessionsForApp,
  upsertDeck,
  buildImportedQuestionIdReplacements,
  buildQuestionImportKey,
  applyQuestionIdReplacements,
  replaceQuestionIdsInExamSession,
  replaceQuestionIdsInDailyReviewSession,
  replaceQuestionIdsInPractice,
  mergeQuestionStats,
  latestIso,
  garbageCollectUnreferencedQuestions,
  uniqueIds,
  resetDeckProgressForDeck,
  deleteDeckFromData,
  removeQuestionFromHardDeck,
  addQuestionToHardDeck,
  isQuestionInHardDeck,
  pruneSlashedFromHardQuestionDeck,
  syncHardQuestionDeckForCurrentRules,
  areQuestionIdListsEqual,
  areSeedDecksImported,
  isLightHydrocarbonSeedCurrent,
  orderSeedDecks,
  mergeImportReports,
  buildDeckId,
  buildStatSummary,
  buildLowAccuracyQuestions,
  buildHardQuestionDeckQuestions,
  sortHardQuestions,
  isAutoHardQuestionLocked,
  isRecoveredHardQuestion,
  isManualHardQuestionAddBlocked,
  getQuestionCorrectRate,
  getQuestionAttemptCount,
  applySessionStats,
  applySessionQuestionResults,
  applySessionDailyStats,
  recordQuestionResult,
  buildQuestionResultStat,
  recordQuestionResultWithStat,
  recordQuestionResultInData,
  recordDailyStudyResult,
  createEmptyDailyStat,
  buildStudyHeatmap,
  getActivityLevel,
  getLocalDateKey,
  getDailySummaryDateKey,
  getNextDailySummaryResetAt,
  formatStudyDate,
  findNextFormulaDelimiter,
  findClosingFormulaDelimiter,
  isEscapedDollar,
  parseEditableAnswerKeys,
  findEditableJudgementOption,
  buildEditedQuestionTags,
  escapeEditableHtml,
  isTypingTarget,
  buildPracticeOptionOrders,
  buildDailyReviewSessionItems,
  buildQuestionOptionOrder,
  getFavoritePracticeKey,
  getMistakePracticeKey,
  buildMistakePractice,
  getPracticeWrongQuestionIds,
  reconcileMistakePractice,
  reconcileFavoritePractice,
  applyPendingPracticeAutoAdvance,
  buildPracticeQuestionIds,
  buildInterleavedPracticeQuestionIds,
  buildSlashedPracticeAnswers,
  buildSlashedPracticeResults,
  getPracticeOrderedOptions,
  shufflePracticeKeys,
  shufflePracticeItems,
  getPracticeMode,
  getPracticeActiveIndex,
  getPracticeReviewProgress,
  getPracticePendingIndices,
  getPracticeUnansweredIndices,
  formatQuestionIndexList
} from "./lib/appRules";
import type { DailyReviewSummary, ReviewForecastDay } from "./lib/appRules";

type View = "home" | "dashboard" | "review" | "practice" | "exam" | "bank" | "mistakes" | "stats" | "favorites" | "slashedList" | "dailySummary" | "import" | "export" | "settings";

const ALL_FAVORITES_PRACTICE_DECK_ID = "__all_favorites__";
type QuestionSetFocus = {
  title: string;
  questionIds: string[];
};

type SlashAnimationReason = "manual" | "streak";
type HardQuestionAnimationReason = "manual" | "auto";
type HardQuestionBlockReason = "slashed" | "highAccuracy" | "autoRule";

type SlashAnimationState = {
  questionId: string;
  reason: SlashAnimationReason;
};

type HardQuestionAnimationState = {
  questionId: string;
  reason: HardQuestionAnimationReason;
};

type HardQuestionBlockState = {
  questionId: string;
  reason: HardQuestionBlockReason;
};

type DeckActionDialogState = { kind: "reset" | "delete" | "removePlan"; deckId: string };

type SeedDeckConfig = {
  id: string;
  name: string;
  file: string;
  source?: string;
};

const TYPE_ORDER: QuestionType[] = ["判断题", "单选题", "多选题"];
const PRACTICE_INTERLEAVE_TYPES: QuestionType[] = ["单选题", "判断题", "多选题"];
const PROFICIENCY_LEVELS: ProficiencyLevel[] = ["已熟练", "欠熟练", "学习中", "未学习"];
const PROFICIENCY_CHART_LEVELS: ProficiencyLevel[] = ["未学习", "学习中", "欠熟练", "已熟练"];
const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
const QUICK_EXAM_TOTAL = 100;
const DAILY_REVIEW_LIMIT = 1000;
const MISTAKE_CLEAR_CORRECT_STREAK = 3;
const AUTO_SLASH_CORRECT_STREAK = 5;
const ALL_DAILY_REVIEW_DECK_ID = "deck_all_daily_review";
const LIGHT_HYDROCARBON_DECK_ID = "deck_light_hydrocarbon_senior_technician";
const HARD_QUESTION_DECK_ID = "deck_hard_low_accuracy";
const HARD_QUESTION_DECK_NAME = "重难题";
const HARD_QUESTION_RATE_THRESHOLD = 0.5;
const HARD_QUESTION_MIN_ATTEMPTS = 2;
const HARD_QUESTION_RECOVERY_CORRECT_STREAK = 2;
const MANUAL_HARD_QUESTION_BLOCK_RATE_THRESHOLD = 0.75;
const BOOTSTRAP_PROGRESS_MARKER_KEY = "examdeck:bootstrap-progress:2026-06-29-18-25-00";
const QUESTION_BANK_EXPORT_DISABLED_MESSAGE = "由于版权风险原因，暂不支持导出题库，需要题库请在坦途联系软件作者！";
const DISABLE_QUESTION_BANK_EXPORT = import.meta.env.VITE_DISABLE_QUESTION_BANK_EXPORT === "1";
const IS_WINDOWS = navigator.platform.toLowerCase().includes("win");
const IS_ANDROID_USER_AGENT = /android/i.test(navigator.userAgent);
const SHORTCUT_MODIFIER_LABEL = IS_WINDOWS ? "Alt" : "Command";
const BACK_SHORTCUT_LABEL = IS_WINDOWS ? "Ctrl" : SHORTCUT_MODIFIER_LABEL;

function isBackShortcut(event: KeyboardEvent) {
  return event.key.toLowerCase() === "z" && (IS_WINDOWS
    ? event.ctrlKey && !event.metaKey && !event.altKey
    : event.metaKey);
}
const BUNDLED_SAFETY_IMAGE_PATHS: Record<string, string> = {
  "0010": "/question-images/safety/safety-0010-image-01.png",
  "0011": "/question-images/safety/safety-0011-image-02.png",
  "0015": "/question-images/safety/safety-0015-image-03.png",
  "0148": "/question-images/safety/safety-0148-image-04.png",
  "0192": "/question-images/safety/safety-0192-image-05.png",
  "0220": "/question-images/safety/safety-0220-image-06.png",
  "0242": "/question-images/safety/safety-0242-image-07.png",
  "0593": "/question-images/safety/safety-0593-image-08.png",
  "0594": "/question-images/safety/safety-0594-image-09.png",
  "0598": "/question-images/safety/safety-0598-image-10.png",
  "0599": "/question-images/safety/safety-0599-image-11.png",
  "0602": "/question-images/safety/safety-0602-image-12.png",
  "0603": "/question-images/safety/safety-0603-image-13.png",
  "0605": "/question-images/safety/safety-0605-image-14.png",
  "0606": "/question-images/safety/safety-0606-image-15.png",
  "0608": "/question-images/safety/safety-0608-image-16.png",
  "0609": "/question-images/safety/safety-0609-image-17.png",
  "0611": "/question-images/safety/safety-0611-image-18.png",
  "0614": "/question-images/safety/safety-0614-image-19.png",
  "0615": "/question-images/safety/safety-0615-image-20.png",
  "0849": "/question-images/safety/safety-0849-image-21.png",
  "0861": "/question-images/safety/safety-0861-image-22.png",
  "0871": "/question-images/safety/safety-0871-image-23.png",
  "0877": "/question-images/safety/safety-0877-image-24.png",
  "0881": "/question-images/safety/safety-0881-image-25.png",
  "0917": "/question-images/safety/safety-0917-image-26.png",
  "0986": "/question-images/safety/safety-0986-image-27.png",
  "0993": "/question-images/safety/safety-0993-image-28.png"
};
const SEED_DECKS: SeedDeckConfig[] = [
  { id: "deck_gas_purification_junior", name: "天然气净化工初级工", file: "gas-purification-junior.xlsx" },
  { id: "deck_gas_purification_intermediate", name: "天然气净化工中级工", file: "gas-purification-intermediate.xlsx" },
  { id: "deck_gas_purification_senior", name: "天然气净化工高级工", file: "gas-purification-senior.xlsx" },
  { id: "deck_tech", name: "天然气净化工技师", file: "tech.xlsx", source: "技师题" },
  { id: LIGHT_HYDROCARBON_DECK_ID, name: "轻烃操作工高级工及技师", file: "light-hydrocarbon-senior-technician.xlsx" },
  { id: "deck_oilfield_risk_control", name: "油气田开发危害因素辨识与风险防控", file: "oilfield-risk-control.xlsx" },
  { id: "deck_oil_production_junior", name: "采油工初级", file: "oil-production-junior.xlsx" },
  { id: "deck_oil_production_intermediate", name: "采油工中级", file: "oil-production-intermediate.xlsx" },
  { id: "deck_oil_production_senior", name: "采油工高级", file: "oil-production-senior.xlsx" },
  { id: "deck_oil_production_technician", name: "采油工技师", file: "oil-production-technician.xlsx" },
  { id: "deck_gathering_transportation_junior", name: "集输工初级", file: "gathering-transportation-junior.xlsx" },
  { id: "deck_gathering_transportation_intermediate", name: "集输工中级", file: "gathering-transportation-intermediate.xlsx" },
  { id: "deck_gathering_transportation_senior", name: "集输工高级", file: "gathering-transportation-senior.xlsx" },
  { id: "deck_gathering_transportation_technician", name: "集输工技师", file: "gathering-transportation-technician.xlsx" }
] as const;

const DEFAULT_CONFIG: ExamConfig = {
  judgeCount: 0,
  singleCount: 0,
  multipleCount: 0,
  wrongFirst: true,
  excludeRecent: false,
  shuffleOptions: true,
  tags: []
};

const navItems = [
  { key: "dashboard", label: "工作台", icon: ClipboardList },
  { key: "review", label: "每日复习", icon: CalendarCheck },
  { key: "practice", label: "顺序刷题", icon: CheckCircle2 },
  { key: "exam", label: "模拟考试", icon: Play },
  { key: "bank", label: "题库", icon: BookOpen },
  { key: "mistakes", label: "错题", icon: AlertTriangle },
  { key: "stats", label: "统计", icon: BarChart3 },
  { key: "favorites", label: "收藏", icon: Star },
  { key: "slashedList", label: "已斩", icon: Sword },
  { key: "dailySummary", label: "今日总结", icon: NotebookPen },
  { key: "import", label: "导入", icon: Upload },
  { key: "export", label: "导出", icon: Download },
  { key: "settings", label: "设置", icon: Settings }
] as const;

const GLOBAL_NAV_KEYS = new Set<View>(["favorites", "slashedList", "dailySummary", "import", "export", "settings"]);
const HOME_NAV_KEYS = new Set<View>(["review", ...GLOBAL_NAV_KEYS]);
const DECK_HIDDEN_NAV_KEYS = new Set<View>(["practice", "exam", "dailySummary", "import", "export", "settings"]);
const HARD_DECK_NAV_KEYS = new Set<View>(["practice"]);
const XINJIANG_FOOD_NAMES = ["烤包子", "抓饭", "拉条子", "大盘鸡", "馕坑肉"];

function renderBrandSubtitleLine(line: string): ReactNode {
  const foodName = XINJIANG_FOOD_NAMES.find((name) => line.includes(name));
  if (!foodName) return line;
  const [before, after] = line.split(foodName);
  return (
    <>
      {before}
      <span className="brand-food-highlight">{foodName}</span>
      {after}
    </>
  );
}

function App() {
  const [data, setData] = useState<AppData>(() => normalizeAppDataForCurrentRules(loadData()));
  const initialActiveSession = getRestorableActiveSession(data.activeSession, data);
  const [view, setView] = useState<View>("home");
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [activePracticeStorageKey, setActivePracticeStorageKey] = useState<string | null>(null);
  const [config, setConfig] = useState<ExamConfig>(() => initialActiveSession?.config ?? DEFAULT_CONFIG);
  const [activeSession, setActiveSession] = useState<ExamSession | null>(() => initialActiveSession);
  const [activeReviewSession, setActiveReviewSession] = useState<DailyReviewSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(() => getStoredSessionIndex(initialActiveSession));
  const [reviewIndex, setReviewIndex] = useState(0);
  const [practiceShuffleOptions, setPracticeShuffleOptions] = useState(false);
  const [practiceShuffleQuestions, setPracticeShuffleQuestions] = useState(false);
  const [practiceAutoAdvanceCorrect, setPracticeAutoAdvanceCorrect] = useState(true);
  const [reviewShuffleOptions] = useState(true);
  const [mistakeShuffleOptions, setMistakeShuffleOptions] = useState(true);
  const [status, setStatus] = useState("准备就绪");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [exportDeckId, setExportDeckId] = useState("");
  const [dailyMistakeSummary, setDailyMistakeSummary] = useState<DailyMistakeSummary | null>(() => data.dailyMistakeSummary ?? null);
  const [persistentStorageChecked, setPersistentStorageChecked] = useState(false);
  const [bootstrapProgressChecked, setBootstrapProgressChecked] = useState(false);
  const [dailySummaryDateKey, setDailySummaryDateKey] = useState(() => getDailySummaryDateKey(new Date()));
  const [greetingTime, setGreetingTime] = useState(() => new Date());
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<QuestionType | "全部">("全部");
  const [bankFocus, setBankFocus] = useState<QuestionSetFocus | null>(null);
  const [detailQuestionId, setDetailQuestionId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [showCopyright, setShowCopyright] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [brandAnimationKey, setBrandAnimationKey] = useState(0);
  const [dailyReviewFinishDialogOpen, setDailyReviewFinishDialogOpen] = useState(false);
  const [mistakePracticeFinishDialogOpen, setMistakePracticeFinishDialogOpen] = useState(false);
  const [answerProgressCollapsed, setAnswerProgressCollapsed] = useState(() => globalThis.matchMedia?.("(max-width: 640px)").matches ?? false);
  const [slashAnimation, setSlashAnimation] = useState<SlashAnimationState | null>(null);
  const [hardQuestionAnimation, setHardQuestionAnimation] = useState<HardQuestionAnimationState | null>(null);
  const [mistakeClearAnimationQuestionId, setMistakeClearAnimationQuestionId] = useState<string | null>(null);
  const [hardQuestionClearAnimationQuestionId, setHardQuestionClearAnimationQuestionId] = useState<string | null>(null);
  const [hardQuestionBlockedToast, setHardQuestionBlockedToast] = useState<HardQuestionBlockState | null>(null);
  const [slashBlockedToastId, setSlashBlockedToastId] = useState<string | null>(null);
  const [deckActionDialog, setDeckActionDialog] = useState<DeckActionDialogState | null>(null);
  const seedAttempted = useRef(false);
  const dataRef = useRef(data);
  const previousViewRef = useRef(view);
  const storageErrorReported = useRef(false);
  const practiceAutoAdvanceTimer = useRef<number | null>(null);
  const reviewAutoAdvanceTimer = useRef<number | null>(null);
  const activeSessionRef = useRef<ExamSession | null>(activeSession);
  const activeReviewSessionRef = useRef<DailyReviewSession | null>(activeReviewSession);
  const currentIndexRef = useRef(currentIndex);
  const reviewIndexRef = useRef(reviewIndex);
  const slashAnimationTimer = useRef<number | null>(null);
  const hardQuestionAnimationTimer = useRef<number | null>(null);
  const mistakeClearAnimationTimer = useRef<number | null>(null);
  const hardQuestionClearAnimationTimer = useRef<number | null>(null);
  const hardQuestionBlockedToastTimer = useRef<number | null>(null);
  const slashBlockedToastTimer = useRef<number | null>(null);
  const dailyReviewFinishPromptedKey = useRef<string | null>(null);
  const mainAreaRef = useRef<HTMLElement>(null);
  const previousSlashedIds = useRef(new Set(data.slashedQuestionIds ?? []));
  const previousHardQuestionIds = useRef(new Set(data.decks.find((deck) => deck.id === HARD_QUESTION_DECK_ID)?.questionIds ?? []));
  const manualSlashQuestionIds = useRef(new Set<string>());
  const manualHardQuestionIds = useRef(new Set<string>());

  async function confirmAction(title: string, message: string, confirmLabel = "确认", danger = false) {
    if (!document.documentElement.classList.contains("native-android")) return globalThis.navigator?.userAgent.includes("jsdom") ? true : window.confirm(message) !== false;
    const { showAndroidConfirmDialog } = await import("./lib/androidSubmitSummary");
    return showAndroidConfirmDialog({ title, message, confirmLabel, danger });
  }

  useEffect(() => {
    if (!persistentStorageChecked || !bootstrapProgressChecked) return;
    const timer = window.setTimeout(() => {
      void saveData(data).then((result) => {
        if (!result.ok) {
          if (!storageErrorReported.current) {
            storageErrorReported.current = true;
            setStatus(`学习数据保存失败：${result.error ?? "请导出备份后重启软件"}`);
          }
          return;
        }
        storageErrorReported.current = false;
      });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [bootstrapProgressChecked, data, persistentStorageChecked]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    const previousView = previousViewRef.current;
    previousViewRef.current = view;
    if (previousView !== "home" && view === "home") {
      setBrandAnimationKey((key) => key + 1);
    }
  }, [view]);

  useEffect(() => {
    let cancelled = false;
    async function loadPersistentData() {
      const storedData = await loadDataFromPersistentStorage();
      if (!cancelled && storedData && shouldUsePersistentData(storedData, dataRef.current)) {
        const normalizedData = normalizeAppDataForCurrentRules(storedData);
        const restoredActiveSession = getRestorableActiveSession(normalizedData.activeSession, normalizedData);
        setData(normalizedData);
        setDailyMistakeSummary(normalizedData.dailyMistakeSummary ?? null);
        setActiveReviewSession(null);
        setReviewIndex(0);
        setActiveSession(restoredActiveSession);
        setCurrentIndex(getStoredSessionIndex(restoredActiveSession));
        setActiveDeckId(null);
        if (restoredActiveSession) {
          setConfig(restoredActiveSession.config);
          setStatus("已载入本机学习数据，未交卷考试可进入题库继续");
        }
      }
      if (!cancelled) {
        setPersistentStorageChecked(true);
      }
    }
    void loadPersistentData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setData((previous) => normalizeAppDataForCurrentRules(previous));
  }, [data.slashedQuestionIds]);

  useEffect(() => {
    const persistedSession = normalizeDailyReviewSession(activeReviewSession, reviewIndex);
    if (!persistedSession) {
      if (activeReviewSession) {
        setData((previous) => removeDailyReviewSessionFromData(previous, activeReviewSession.deckId));
      }
      return;
    }
    setData((previous) => {
      const previousSession = previous.dailyReviewSessions[persistedSession.deckId];
      if (areDailyReviewSessionsEqual(previousSession, persistedSession) && areDailyReviewSessionsEqual(previous.dailyReviewSession, persistedSession)) {
        return previous;
      }
      return {
        ...previous,
        dailyReviewSessions: {
          ...previous.dailyReviewSessions,
          [persistedSession.deckId]: persistedSession
        },
        dailyReviewSession: persistedSession
      };
    });
  }, [activeReviewSession, reviewIndex]);

  useEffect(() => {
    const persistedSession = normalizeActiveExamSession(activeSession, currentIndex);
    setData((previous) => (
      areExamSessionsEqual(previous.activeSession, persistedSession)
        ? previous
        : { ...previous, activeSession: persistedSession }
    ));
  }, [activeSession, currentIndex]);

  useEffect(() => {
    setData((previous) => (
      areDailyMistakeSummariesEqual(previous.dailyMistakeSummary, dailyMistakeSummary)
        ? previous
        : { ...previous, dailyMistakeSummary }
    ));
  }, [dailyMistakeSummary]);

  useEffect(() => {
    const now = new Date();
    const nextReset = getNextDailySummaryResetAt(now);
    const delay = Math.max(1000, nextReset.getTime() - now.getTime());
    const timer = window.setTimeout(() => {
      setDailySummaryDateKey(getDailySummaryDateKey(new Date()));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [dailySummaryDateKey]);

  useEffect(() => {
    const timer = window.setInterval(() => setGreetingTime(new Date()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => {
    clearAutoAdvanceTimers();
    clearSlashAnimation();
    clearHardQuestionAnimation();
    clearMistakeClearAnimation();
    clearHardQuestionClearAnimation();
    clearHardQuestionBlockedToast();
    clearSlashBlockedToast();
  }, []);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    const flushData = () => saveData(dataRef.current);
    const flushDataOnUnload = () => { void flushData(); };
    window.examdeckFlushData = flushData;
    window.addEventListener("pagehide", flushDataOnUnload);
    window.addEventListener("beforeunload", flushDataOnUnload);
    return () => {
      if (window.examdeckFlushData === flushData) delete window.examdeckFlushData;
      window.removeEventListener("pagehide", flushDataOnUnload);
      window.removeEventListener("beforeunload", flushDataOnUnload);
    };
  }, []);

  useEffect(() => {
    activeReviewSessionRef.current = activeReviewSession;
  }, [activeReviewSession]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    reviewIndexRef.current = reviewIndex;
  }, [reviewIndex]);

  useEffect(() => {
    if (!persistentStorageChecked || bootstrapProgressChecked) return;
    if (hasBootstrapProgressImportMarker() && dataRef.current.questions.length > 0 && dataRef.current.decks.length > 0) {
      setBootstrapProgressChecked(true);
      return;
    }
    let cancelled = false;
    async function importBootstrapProgress() {
      try {
        const bootstrapData = await loadBootstrapSeedData(import.meta.env.BASE_URL);
        const restoredData = mergeBootstrapDataWithCurrentProgress(dataRef.current, bootstrapData);
        if (cancelled || restoredData.questions.length === 0) return;
        if (shouldImportBootstrapProgress(dataRef.current, restoredData)) {
          const restoredActiveSession = getRestorableActiveSession(restoredData.activeSession, restoredData);
          setData((previous) => (
            shouldImportBootstrapProgress(previous, restoredData)
              ? restoredData
              : previous
          ));
          setDailyMistakeSummary(restoredData.dailyMistakeSummary ?? null);
          setActiveReviewSession(null);
          setReviewIndex(0);
          setActiveSession(restoredActiveSession);
          setCurrentIndex(getStoredSessionIndex(restoredActiveSession));
          setActiveDeckId(null);
          if (restoredActiveSession) {
            setConfig(restoredActiveSession.config);
            setStatus("已载入内置学习进度，未交卷考试可进入题库继续");
          } else {
            setStatus(`已载入内置学习进度：${restoredData.questions.length} 道题`);
          }
        }
        markBootstrapProgressImported();
      } catch {
        // 没有内置进度时，继续走内置题库导入。
      } finally {
        if (!cancelled) setBootstrapProgressChecked(true);
      }
    }
    void importBootstrapProgress();
    return () => {
      cancelled = true;
    };
  }, [bootstrapProgressChecked, persistentStorageChecked]);

  useEffect(() => {
    if (!bootstrapProgressChecked || seedAttempted.current || areSeedDecksImported(data)) return;
    seedAttempted.current = true;
    void importSeed();
  }, [bootstrapProgressChecked, data.decks]);

  useEffect(() => {
    if (dailyMistakeSummary && dailyMistakeSummary.date !== dailySummaryDateKey) {
      setDailyMistakeSummary(null);
    }
  }, [dailyMistakeSummary, dailySummaryDateKey]);

  useEffect(() => {
    if (!activeReviewSession || isDailyReviewSessionCurrent(activeReviewSession, dailySummaryDateKey)) return;
    clearReviewAutoAdvance();
    setDailyReviewFinishDialogOpen(false);
    dailyReviewFinishPromptedKey.current = null;
    const finished = activeReviewSession.items.filter((item) => item.isCorrect !== undefined).length;
    const wrong = activeReviewSession.items.filter((item) => item.isCorrect === false).length;
    const expiredDeckId = activeReviewSession.deckId;
    setActiveReviewSession(null);
    setReviewIndex(0);
    setData((previous) => removeDailyReviewSessionFromData(previous, expiredDeckId));
    setStatus(`已跨过凌晨 4 点，自动结算上一日复习：已判定 ${finished} 道，错 ${wrong} 道；今日复习已刷新`);
  }, [activeReviewSession, dailySummaryDateKey]);

  useEffect(() => {
    if (view !== "review" || !activeReviewSession || dailyReviewFinishDialogOpen) return;
    if (activeReviewSession.items.length === 0) return;
    const allJudged = activeReviewSession.items.every((item) => item.isCorrect !== undefined);
    if (!allJudged) return;
    const promptKey = buildDailyReviewFinishPromptKey(activeReviewSession);
    if (dailyReviewFinishPromptedKey.current === promptKey) return;
    dailyReviewFinishPromptedKey.current = promptKey;
    clearReviewAutoAdvance();
    setDailyReviewFinishDialogOpen(true);
  }, [view, activeReviewSession, dailyReviewFinishDialogOpen]);

  const questionById = useMemo(() => new Map(data.questions.map((question) => [question.id, question])), [data.questions]);
  const favoriteQuestionSet = useMemo(() => new Set(data.favoriteQuestionIds ?? []), [data.favoriteQuestionIds]);
  const slashedQuestionSet = useMemo(() => new Set(data.slashedQuestionIds ?? []), [data.slashedQuestionIds]);
  const hardQuestionDeck = useMemo(() => data.decks.find((deck) => deck.id === HARD_QUESTION_DECK_ID) ?? null, [data.decks]);
  const hardQuestionSet = useMemo(() => new Set(hardQuestionDeck?.questionIds ?? []), [hardQuestionDeck]);
  const favoriteQuestions = useMemo(
    () => (data.favoriteQuestionIds ?? []).map((questionId) => questionById.get(questionId)).filter(Boolean) as Question[],
    [data.favoriteQuestionIds, questionById]
  );
  const slashedQuestions = useMemo(
    () => (data.slashedQuestionIds ?? []).map((questionId) => questionById.get(questionId)).filter(Boolean) as Question[],
    [data.slashedQuestionIds, questionById]
  );
  const todayWrongQuestions = useMemo(
    () => buildDailySummaryWrongQuestions(data.questions, data.stats, dailySummaryDateKey),
    [data.questions, data.stats, dailySummaryDateKey]
  );
  const dailySummaryQuestions = useMemo(
    () => dailyMistakeSummary?.date === dailySummaryDateKey
      ? dailyMistakeSummary.questionIds.map((questionId) => questionById.get(questionId)).filter(Boolean) as Question[]
      : [],
    [dailyMistakeSummary, questionById, dailySummaryDateKey]
  );
  const detailQuestion = detailQuestionId ? questionById.get(detailQuestionId) ?? null : null;
  const editingQuestion = editingQuestionId ? questionById.get(editingQuestionId) ?? null : null;
  const allDailyReviewDeck = useMemo(() => buildAllDailyReviewDeck(data.decks), [data.decks]);
  const activeDeck = useMemo(
    () => activeDeckId === ALL_DAILY_REVIEW_DECK_ID
      ? allDailyReviewDeck
      : data.decks.find((deck) => deck.id === activeDeckId) ?? null,
    [data.decks, activeDeckId, allDailyReviewDeck]
  );
  const sidebarSubtitle = activeDeck?.name ?? getTimeGreeting(greetingTime);
  const sidebarSubtitleLines = formatSidebarSubtitle(sidebarSubtitle);
  const isActiveHardDeck = isHardQuestionDeck(activeDeck);
  const isActiveAllDailyReviewDeck = isAllDailyReviewDeck(activeDeck);
  const activeQuestions = useMemo(() => getDeckQuestions(data.questions, activeDeck), [data.questions, activeDeck]);

  useEffect(() => {
    if (view !== "review") return;
    if (!activeReviewSession || isDailyReviewSessionComplete(activeReviewSession)) {
      setDailyReviewFinishDialogOpen(false);
      setReviewIndex(0);
      setView(isActiveAllDailyReviewDeck ? "home" : "dashboard");
    }
  }, [view, activeReviewSession, isActiveAllDailyReviewDeck]);

  const activeQuestionIdSet = useMemo(() => new Set(activeQuestions.map((question) => question.id)), [activeQuestions]);
  const scopedFavoriteQuestions = useMemo(
    () => activeDeck ? favoriteQuestions.filter((question) => activeQuestionIdSet.has(question.id)) : favoriteQuestions,
    [activeDeck, activeQuestionIdSet, favoriteQuestions]
  );
  const scopedSlashedQuestions = useMemo(
    () => activeDeck ? slashedQuestions.filter((question) => activeQuestionIdSet.has(question.id)) : slashedQuestions,
    [activeDeck, activeQuestionIdSet, slashedQuestions]
  );
  const activeReviewQuestions = useMemo(
    () => activeQuestions.filter((question) => !slashedQuestionSet.has(question.id)),
    [activeQuestions, slashedQuestionSet]
  );
  const currentPracticeStorageKey = activePracticeStorageKey ?? activeDeck?.id ?? null;
  const activePractice = currentPracticeStorageKey ? data.practices[currentPracticeStorageKey] : undefined;
  const activePracticeDeck = activeDeck ?? (activePractice?.scope === "favorites" ? { id: activePractice.deckId, name: "全部收藏题", questionIds: activePractice.questionIds, createdAt: activePractice.startedAt, updatedAt: activePractice.updatedAt } : null);
  const favoritePractice = data.practices[getFavoritePracticeKey(activeDeck?.id ?? ALL_FAVORITES_PRACTICE_DECK_ID)];
  const mistakePractice = activeDeck ? data.practices[getMistakePracticeKey(activeDeck.id)] : undefined;
  const isAnsweringView = (view === "practice" && Boolean(activePractice && !activePractice.submittedAt)) || (view === "exam" && Boolean(activeSession && !activeSession.submittedAt)) || (view === "review" && Boolean(activeReviewSession));
  const desktopCloseGuard = useDesktopCloseGuard({ enabled: IS_WINDOWS || !IS_ANDROID_USER_AGENT, isAnsweringView, flushData: () => saveData(dataRef.current), setStatus });
  useAndroidLifecycle({ dataRef, view, activeDeckId, isAnsweringView, navOpen, answerProgressCollapsed, detailQuestionId, editingQuestionId, showCopyright, hasDeckActionDialog: Boolean(deckActionDialog), dailyReviewFinishDialogOpen, setNavOpen, setSidebarCollapsed, setAnswerProgressCollapsed, setDetailQuestionId, setEditingQuestionId, setShowCopyright, setDeckActionDialog, setDailyReviewFinishDialogOpen, setView, goHome, requestAnsweringLeave, setStatus });
  useAndroidAnswerSwipe({ isAnsweringView, view, activeSession, currentIndex, activeReviewSession, reviewIndex, activePractice, activeDeck: activePracticeDeck, questionById, goToExamIndex, goToReviewIndex, setPracticeIndex, confirmDailyReviewQuestion, confirmPracticeQuestion });
  const answeringEntryKey = view === "practice" && activePractice
    ? `${view}:${activePractice.startedAt}`
    : view === "exam" && activeSession
      ? `${view}:${activeSession.id}`
      : view === "review" && activeReviewSession
        ? `${view}:${activeReviewSession.id}`
        : "";
  const dailyReviewPlan = useMemo(() => buildDailyReviewPlan(activeReviewQuestions, data.stats), [activeReviewQuestions, data.stats]);
  const dailyReviewSummary = useMemo(() => buildDailyReviewSummary(activeReviewQuestions, data.stats), [activeReviewQuestions, data.stats]);
  const typeCounts = useMemo(() => countByType(activeQuestions), [activeQuestions]);
  const statSummary = useMemo(() => buildStatSummary(data, activeQuestions), [data, activeQuestions]);
  const deckSessions = useMemo(() => activeDeck ? data.sessions.filter((session) => session.deckId === activeDeck.id) : [], [data.sessions, activeDeck]);
  const filteredQuestions = useMemo(() => {
    const focusedIds = bankFocus ? new Set(bankFocus.questionIds) : null;
    const scopedQuestions = activeQuestions
      .filter((question) => !focusedIds || focusedIds.has(question.id))
      .filter((question) => typeFilter === "全部" || question.type === typeFilter);
    return query.trim() ? searchQuestions(scopedQuestions, query, scopedQuestions.length) : scopedQuestions;
  }, [activeQuestions, bankFocus, query, typeFilter]);
  const mistakeQuestions = useMemo(
    () => activeQuestions.filter((question) => isActiveMistake(data.stats[question.id])).sort((a, b) => (data.stats[b.id]?.wrong ?? 0) - (data.stats[a.id]?.wrong ?? 0)),
    [activeQuestions, data.stats]
  );

  useEffect(() => {
    setSidebarCollapsed(isAnsweringView);
    if (!isAnsweringView) setNavOpen(false);
  }, [isAnsweringView]);

  useLayoutEffect(() => {
    if (!answeringEntryKey) return;
    const frame = window.requestAnimationFrame(() => {
      scrollElementToTop(mainAreaRef.current);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [answeringEntryKey]);
  useLayoutEffect(() => { scrollElementToTop(mainAreaRef.current); scrollWindowToTop(); }, [view, activeDeckId]);

  useEffect(() => {
    const current = new Set(data.slashedQuestionIds ?? []);
    const added = [...current].filter((questionId) => !previousSlashedIds.current.has(questionId));
    previousSlashedIds.current = current;
    if (!persistentStorageChecked || !bootstrapProgressChecked) return;
    if (added.length > 0) {
      const questionId = added[added.length - 1];
      const reason: SlashAnimationReason = manualSlashQuestionIds.current.has(questionId) ? "manual" : "streak";
      manualSlashQuestionIds.current.delete(questionId);
      showSlashAnimation(questionId, reason);
    }
  }, [bootstrapProgressChecked, data.slashedQuestionIds, persistentStorageChecked]);

  useEffect(() => {
    const current = new Set(hardQuestionDeck?.questionIds ?? []);
    const added = [...current].filter((questionId) => !previousHardQuestionIds.current.has(questionId));
    previousHardQuestionIds.current = current;
    if (!persistentStorageChecked || !bootstrapProgressChecked) return;
    if (added.length > 0) {
      const questionId = added[added.length - 1];
      const reason: HardQuestionAnimationReason = manualHardQuestionIds.current.has(questionId) ? "manual" : "auto";
      manualHardQuestionIds.current.delete(questionId);
      showHardQuestionAnimation(questionId, reason);
    }
  }, [bootstrapProgressChecked, hardQuestionDeck, persistentStorageChecked]);

  useEffect(() => {
    if (!activePractice || activePractice.submittedAt) return;
    setPracticeShuffleOptions(Boolean(activePractice.shuffleOptions));
    setPracticeShuffleQuestions(Boolean(activePractice.shuffleQuestions));
    setPracticeAutoAdvanceCorrect(activePractice.autoAdvanceCorrect !== false);
  }, [
    activePractice?.deckId,
    activePractice?.startedAt,
    activePractice?.shuffleOptions,
    activePractice?.shuffleQuestions,
    activePractice?.autoAdvanceCorrect,
    activePractice?.submittedAt
  ]);

  useEffect(() => {
    if (view !== "exam" || !activeSession || activeSession.submittedAt) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (!activeSession || event.defaultPrevented) return;
      if (isTypingTarget(event.target)) return;
      const shortcutModifier = IS_WINDOWS ? event.altKey && !event.metaKey && !event.ctrlKey : event.metaKey;

      if (shortcutModifier && event.key === "1") { event.preventDefault(); const item = activeSession.items[currentIndex]; if (item) toggleFavoriteQuestion(item.questionId); return; }

      if (shortcutModifier && event.key === "4") { event.preventDefault(); const item = activeSession.items[currentIndex]; if (item) toggleSlashedQuestion(item.questionId); return; }

      if (shortcutModifier && event.key === "5") { event.preventDefault(); const item = activeSession.items[currentIndex]; if (item) toggleHardQuestion(item.questionId); return; }

      if (isBackShortcut(event)) {
        event.preventDefault();
        if (currentIndex > 0) {
          goToExamIndex(currentIndex - 1);
        }
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const item = activeSession.items[currentIndex];
      const question = item ? questionById.get(item.questionId) : undefined;
      if (!item || !question) return;

      if (["1", "2", "3", "4"].includes(event.key)) {
        const option = getOrderedOptions(question, item)[Number(event.key) - 1];
        if (!option) return;
        event.preventDefault();
        toggleOption(option.key);
        return;
      }

      if (event.code === "Space" || event.key === " ") {
        event.preventDefault();
        if (currentIndex < activeSession.items.length - 1) {
          goToExamIndex(currentIndex + 1);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view, activeSession, currentIndex, questionById]);

  useEffect(() => {
    if (view !== "review" || !activeReviewSession) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (!activeReviewSession || event.defaultPrevented) return;
      if (isTypingTarget(event.target)) return;
      const shortcutModifier = IS_WINDOWS ? event.altKey && !event.metaKey && !event.ctrlKey : event.metaKey;

      if (shortcutModifier && event.key === "1") { event.preventDefault(); const item = activeReviewSession.items[reviewIndex]; if (item) toggleFavoriteQuestion(item.questionId); return; }

      if (shortcutModifier && event.key === "4") { event.preventDefault(); const item = activeReviewSession.items[reviewIndex]; if (item) toggleSlashedQuestion(item.questionId); return; }

      if (shortcutModifier && event.key === "5") { event.preventDefault(); const item = activeReviewSession.items[reviewIndex]; if (item) toggleHardQuestion(item.questionId); return; }

      if (isBackShortcut(event)) {
        event.preventDefault();
        if (reviewIndex > 0) {
          goToReviewIndex(reviewIndex - 1);
        }
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const item = activeReviewSession.items[reviewIndex];
      const question = item ? questionById.get(item.questionId) : undefined;
      if (!item || !question) return;

      if (["1", "2", "3", "4"].includes(event.key)) {
        const option = getOrderedOptions(question, item)[Number(event.key) - 1];
        if (!option) return;
        event.preventDefault();
        toggleDailyReviewOption(option.key);
        return;
      }

      if (event.code === "Space" || event.key === " ") {
        event.preventDefault();
        if (question.type === "多选题" && item.selectedKeys.length > 0 && item.isCorrect === undefined) {
          confirmDailyReviewQuestion();
        } else if (reviewIndex < activeReviewSession.items.length - 1) {
          goToReviewIndex(reviewIndex + 1);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view, activeReviewSession, reviewIndex, questionById]);

  useEffect(() => {
    if (view !== "practice" || !activePractice || activePractice.submittedAt) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (!activePractice || event.defaultPrevented) return;
      if (isTypingTarget(event.target)) return;
      const shortcutModifier = IS_WINDOWS ? event.altKey && !event.metaKey && !event.ctrlKey : event.metaKey;

      if (shortcutModifier && event.key === "1") {
        event.preventDefault();
        const practiceIndex = getPracticeActiveIndex(activePractice);
        const questionId = activePractice.questionIds[practiceIndex];
        if (questionId) toggleFavoriteQuestion(questionId);
        return;
      }

      if (shortcutModifier && event.key === "4") {
        event.preventDefault();
        const practiceIndex = getPracticeActiveIndex(activePractice);
        const questionId = activePractice.questionIds[practiceIndex];
        if (questionId) toggleSlashedQuestion(questionId);
        return;
      }

      if (shortcutModifier && event.key === "5") {
        event.preventDefault();
        const practiceIndex = getPracticeActiveIndex(activePractice);
        const questionId = activePractice.questionIds[practiceIndex];
        if (questionId) toggleHardQuestion(questionId);
        return;
      }

      if (isBackShortcut(event)) {
        event.preventDefault();
        const practiceIndex = getPracticeActiveIndex(activePractice);
        if (practiceIndex > 0) {
          setPracticeIndex(practiceIndex - 1);
        }
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const practiceIndex = getPracticeActiveIndex(activePractice);
      const isReviewMode = activePractice.scope !== "mistakes" && getPracticeMode(activePractice) === "review";
      const questionId = activePractice.questionIds[practiceIndex];
      const question = questionById.get(questionId);
      if (!question) return;
      const selectedKeys = activePractice.answers[questionId] ?? [];
      const isFinalized = (activePractice.results ?? {})[questionId] !== undefined;

      if (isReviewMode) {
        if (event.code === "Space" || event.key === " ") {
          event.preventDefault();
          if (practiceIndex < activePractice.questionIds.length - 1) {
            setPracticeIndex(practiceIndex + 1);
          }
        }
        return;
      }

      if (["1", "2", "3", "4"].includes(event.key)) {
        const option = getPracticeOrderedOptions(question, activePractice)[Number(event.key) - 1];
        if (!option) return;
        event.preventDefault();
        togglePracticeOption(option.key);
        return;
      }

      if (event.code === "Space" || event.key === " ") {
        event.preventDefault();
        if (!isFinalized && selectedKeys.length > 0) {
          confirmPracticeQuestion();
        } else if (practiceIndex < activePractice.questionIds.length - 1) {
          setPracticeIndex(practiceIndex + 1);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view, activePractice, questionById]);

  async function importSeed() {
    try {
      setStatus("正在导入内置 Excel 题库");
      const seedResults: { seed: SeedDeckConfig; result: Awaited<ReturnType<typeof parseExcelWorkbook>> }[] = [];
      for (const seed of SEED_DECKS) {
        const response = await fetch(`${import.meta.env.BASE_URL}seed/${seed.file}`);
        if (!response.ok) throw new Error(`内置题库文件未找到：${seed.name}`);
        const buffer = await response.arrayBuffer();
        const source = seed.source ?? seed.name;
        const embeddedImages = await extractEmbeddedImages(buffer, source);
        const result = await parseExcelWorkbook(buffer, source, embeddedImages);
        seedResults.push({ seed, result });
      }
      setData((previous) => {
        let next = previous;
        for (const { seed, result } of seedResults) {
          next = upsertDeck(next, seed.id, seed.name, result.questions, true);
        }
        return {
          ...orderSeedDecks(next),
          seedImported: true
        };
      });
      const nextReport = mergeImportReports(seedResults.map(({ seed, result }) => ({
        label: seed.name,
        report: result.report
      })));
      setReport(nextReport);
      setStatus(`已导入/更新 ${SEED_DECKS.length} 个内置题库，共 ${nextReport.imported} 道客观题，跳过 ${nextReport.skipped} 行${formatImportSkippedSummary(nextReport)}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "内置题库导入失败");
    }
  }

  async function handleExcelImport(file?: File) {
    if (!file) return;
    try {
      setStatus("正在解析 Excel");
      const result = await parseExcelFile(file);
      const deckName = file.name.replace(/\.xlsx$/i, "");
      const deckId = buildDeckId(deckName);
      setData((previous) => {
        const nextData = upsertDeck(previous, deckId, deckName, result.questions);
        void saveData(nextData);
        return nextData;
      });
      setActiveDeckId(deckId);
      setActivePracticeStorageKey(deckId);
      setConfig(buildDefaultExamConfig(result.questions));
      setBankFocus(null);
      setView("dashboard");
      setReport(result.report);
      setStatus(`已导入 ${deckName}：${result.report.imported} 道客观题，图片 ${result.report.images ?? 0} 张，跳过 ${result.report.skipped} 行${formatImportSkippedSummary(result.report)}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Excel 导入失败");
    }
  }

  async function startExam(nextConfig = config, questionPool: Question[] = activeQuestions, stats: AppData["stats"] = data.stats, targetDeck: Deck | null = activeDeck, statusLabel = "题") {
    if (!targetDeck) {
      setStatus("请先选择一个题库");
      setView("home");
      return;
    }
    if (!await confirmReplaceActiveExam()) return;
    clearAutoAdvanceTimers();
    const items = buildExamItems(questionPool, stats, nextConfig);
    if (items.length === 0) {
      setStatus("当前配置没有可抽取题目");
      return;
    }

    const session: ExamSession = { id: `exam_${Date.now()}`, deckId: targetDeck.id, startedAt: new Date().toISOString(), config: nextConfig, items, currentIndex: 0 };
    setActiveDeckId(targetDeck.id);
    setActivePracticeStorageKey(targetDeck.id);
    setActiveSession(session);
    setCurrentIndex(0);
    setView("exam");
    setStatus(`已生成 ${items.length} 道${statusLabel}`);
  }

  function startMistakePractice(questionIds?: string[], reset = false) {
    const snapshot = dataRef.current;
    const targetDeck = activeDeckId ? snapshot.decks.find((deck) => deck.id === activeDeckId) ?? null : null;
    if (!targetDeck) { setStatus("请先选择一个题库"); setView("home"); return; }
    const deckQuestions = getDeckQuestions(snapshot.questions, targetDeck);
    const byId = new Map(deckQuestions.map((question) => [question.id, question]));
    const slashed = new Set(snapshot.slashedQuestionIds ?? []);
    const questions = (questionIds
      ? questionIds.map((questionId) => byId.get(questionId)).filter((question): question is Question => Boolean(question && !slashed.has(question.id)))
      : deckQuestions.filter((question) => isActiveMistake(snapshot.stats[question.id]) && !slashed.has(question.id)).sort((a, b) => (snapshot.stats[b.id]?.wrong ?? 0) - (snapshot.stats[a.id]?.wrong ?? 0)));
    if (questions.length === 0) { setStatus("当前题库暂无未斩错题"); return; }
    const storageKey = getMistakePracticeKey(targetDeck.id);
    clearAutoAdvanceTimers();
    setActiveDeckId(targetDeck.id);
    setActivePracticeStorageKey(storageKey);
    setPracticeShuffleOptions(mistakeShuffleOptions);
    setPracticeShuffleQuestions(false);
    setPracticeAutoAdvanceCorrect(true);
    setMistakePracticeFinishDialogOpen(false);
    const existingPractice = snapshot.practices[storageKey];
    if (!questionIds && !reset && existingPractice?.scope === "mistakes" && !existingPractice.submittedAt) {
      const reconciledPractice = reconcileMistakePractice(existingPractice, deckQuestions, slashed);
      if (reconciledPractice.questionIds.length > 0) {
        setPracticeShuffleOptions(Boolean(reconciledPractice.shuffleOptions));
        setPracticeAutoAdvanceCorrect(reconciledPractice.autoAdvanceCorrect !== false);
        setData((previous) => ({
          ...previous,
          practices: {
            ...previous.practices,
            [storageKey]: reconciledPractice
          }
        }));
        setView("practice");
        setStatus(`已恢复错题刷题进度，共 ${reconciledPractice.questionIds.length} 道`);
        return;
      }
    }
    const practice = buildMistakePractice(targetDeck.id, questions, mistakeShuffleOptions, true);
    setData((previous) => ({ ...previous, practices: { ...previous.practices, [storageKey]: practice } }));
    setView("practice");
    setStatus(`${questionIds ? "已继续" : reset ? "已重新开始" : "已开始"}错题刷题，共 ${questions.length} 道`);
  }

  async function startQuickExam(deckId: string) {
    const deck = data.decks.find((deck) => deck.id === deckId);
    if (!deck) {
      setStatus("没有找到题库");
      return;
    }

    clearAutoAdvanceTimers();
    const questions = getDeckQuestions(data.questions, deck);
    const quickConfig = buildQuickExamConfig(questions);
    const items = buildExamItems(questions, data.stats, quickConfig);
    if (items.length === 0) {
      setStatus("当前题库没有可抽取题目");
      return;
    }

    if (!await confirmReplaceActiveExam()) return;

    setActiveDeckId(deck.id);
    setActivePracticeStorageKey(deck.id);
    const session: ExamSession = {
      id: `exam_${Date.now()}`,
      deckId: deck.id,
      startedAt: new Date().toISOString(),
      config: quickConfig,
      items,
      currentIndex: 0
    };
    setActiveSession(session);
    setCurrentIndex(0);
    setQuery("");
    setTypeFilter("全部");
    setBankFocus(null);
    setConfig(quickConfig);
    setView("exam");
    setStatus(`已生成 ${items.length} 道快练题`);
  }

  function resumeActiveExam(session = activeSession) {
    if (!session || session.submittedAt) return;
    clearAutoAdvanceTimers();
    setActiveDeckId(session.deckId);
    setActivePracticeStorageKey(session.deckId);
    setConfig(session.config);
    setCurrentIndex(getStoredSessionIndex(session));
    setView("exam");
    setStatus("已恢复未交卷的模拟考试");
  }

  async function confirmReplaceActiveExam() {
    if (!activeSession || activeSession.submittedAt) return true;
    const answered = activeSession.items.filter((item) => item.selectedKeys.length > 0).length;
    const shouldReplace = await confirmAction("放弃当前考试？", `当前还有一场未交卷的模拟考试，已作答 ${answered}/${activeSession.items.length} 题。要放弃这场考试并重新组卷吗？`, "重新组卷", true);
    if (!shouldReplace) {
      resumeActiveExam(activeSession);
      return false;
    }
    setActiveSession(null);
    return true;
  }

  function updateItem(updater: (item: ExamItem, question: Question) => ExamItem) {
    setActiveSession((session) => {
      if (!session || session.submittedAt) return session;
      const item = session.items[currentIndex];
      const question = questionById.get(item.questionId);
      if (!question) return session;
      const items = [...session.items];
      items[currentIndex] = updater(item, question);
      return { ...session, items };
    });
  }

  function goToExamIndex(index: number) {
    const maxIndex = activeSession ? Math.max(0, activeSession.items.length - 1) : 0;
    setCurrentIndex(Math.max(0, Math.min(maxIndex, index)));
  }

  function goToReviewIndex(index: number) {
    clearReviewAutoAdvance();
    setReviewIndex(index);
    setActiveReviewSession((session) => {
      if (!session) return session;
      const boundedIndex = Math.max(0, Math.min(session.items.length - 1, index));
      return { ...session, reviewIndex: boundedIndex, updatedAt: new Date().toISOString() };
    });
  }

  function toggleOption(key: string) {
    const session = activeSession;
    const item = session?.items[currentIndex];
    const question = item ? questionById.get(item.questionId) : undefined;
    if (!session || !item || !question || session.submittedAt) return;

    const selectedKeys = question.type === "多选题"
      ? item.selectedKeys.includes(key)
        ? item.selectedKeys.filter((selected) => selected !== key)
        : [...item.selectedKeys, key]
      : [key];

    updateItem((item) => {
      return {
        ...item,
        selectedKeys
      };
    });
  }

  function confirmExamQuestion() {
    const session = activeSession;
    const item = session?.items[currentIndex];
    const question = item ? questionById.get(item.questionId) : undefined;
    if (!session || !item || !question || session.submittedAt || item.isCorrect !== undefined || item.selectedKeys.length === 0) return;

    const isCorrect = isAnswerCorrect(question, item.selectedKeys);
    updateItem((item) => ({ ...item, isCorrect }));
  }

  function startDailyReview() {
    if (!activeDeck) {
      setStatus("请先选择一个题库");
      setView("home");
      return;
    }
    clearAutoAdvanceTimers();
    const storedSession = data.dailyReviewSessions[activeDeck.id];
    if (storedSession && (!isDailyReviewSessionCurrent(storedSession, dailySummaryDateKey) || isDailyReviewSessionComplete(storedSession))) {
      const finished = storedSession.items.filter((item) => item.isCorrect !== undefined).length;
      const wrong = storedSession.items.filter((item) => item.isCorrect === false).length;
      if (activeReviewSession?.deckId === storedSession.deckId) {
        setActiveReviewSession(null);
        setReviewIndex(0);
      }
      setData((previous) => removeDailyReviewSessionFromData(previous, storedSession.deckId));
      setStatus(isDailyReviewSessionComplete(storedSession)
        ? `已清理完成的每日复习：已判定 ${finished} 道，错 ${wrong} 道；正在刷新今日复习`
        : `已跨过凌晨 4 点，自动结算上一日复习：已判定 ${finished} 道，错 ${wrong} 道；正在刷新今日复习`);
    }
    const currentStoredSession = getCurrentDailyReviewSession(data, activeDeck.id, dailySummaryDateKey);
    if (currentStoredSession) {
      setActiveReviewSession(currentStoredSession);
      setReviewIndex(currentStoredSession.reviewIndex);
      setView("review");
      setStatus("已恢复每日复习进度");
      return;
    }
    if (dailyReviewPlan.length === 0) {
      setReviewIndex(0);
      setStatus("今日没有到期复习题");
      setView("dashboard");
      return;
    }
    const now = new Date().toISOString();
    const nextSession: DailyReviewSession = {
      id: `review_${Date.now()}`,
      deckId: activeDeck.id,
      startedAt: now,
      updatedAt: now,
      reviewIndex: 0,
      items: buildDailyReviewSessionItems(dailyReviewPlan, questionById, reviewShuffleOptions)
    };
    setActiveReviewSession(nextSession);
    setReviewIndex(0);
    setView("review");
    setStatus(`${isAllDailyReviewDeck(activeDeck) ? "全题库每日复习" : "今日复习"} ${dailyReviewPlan.length} 道题${dailyReviewSummary.capped ? "（已按优先级截取最需要复习的 1000 道）" : ""}`);
  }

  function startAllDailyReview() {
    const reviewDeck = buildAllDailyReviewDeck(data.decks);
    const reviewQuestions = getDeckQuestions(data.questions, reviewDeck).filter((question) => !slashedQuestionSet.has(question.id));
    const reviewPlan = buildDailyReviewPlan(reviewQuestions, data.stats);
    const reviewSummary = buildDailyReviewSummary(reviewQuestions, data.stats);
    clearAutoAdvanceTimers();

    const storedSession = data.dailyReviewSessions[ALL_DAILY_REVIEW_DECK_ID];
    if (storedSession && (!isDailyReviewSessionCurrent(storedSession, dailySummaryDateKey) || isDailyReviewSessionComplete(storedSession))) {
      const finished = storedSession.items.filter((item) => item.isCorrect !== undefined).length;
      const wrong = storedSession.items.filter((item) => item.isCorrect === false).length;
      if (activeReviewSession?.deckId === storedSession.deckId) {
        setActiveReviewSession(null);
        setReviewIndex(0);
      }
      setData((previous) => removeDailyReviewSessionFromData(previous, storedSession.deckId));
      setStatus(isDailyReviewSessionComplete(storedSession)
        ? `已清理完成的全题库每日复习：已判定 ${finished} 道，错 ${wrong} 道；正在刷新全题库复习`
        : `已跨过凌晨 4 点，自动结算上一日复习：已判定 ${finished} 道，错 ${wrong} 道；正在刷新全题库复习`);
    }

    const currentStoredSession = getCurrentDailyReviewSession(data, ALL_DAILY_REVIEW_DECK_ID, dailySummaryDateKey);
    if (currentStoredSession) {
      setActiveDeckId(ALL_DAILY_REVIEW_DECK_ID);
      setActiveReviewSession(currentStoredSession);
      setReviewIndex(currentStoredSession.reviewIndex);
      setView("review");
      setStatus("已恢复全题库每日复习进度");
      return;
    }

    setActiveDeckId(ALL_DAILY_REVIEW_DECK_ID);
    if (reviewPlan.length === 0) {
      setReviewIndex(0);
      setActiveDeckId(null);
      setView("home");
      setStatus("全题库今日没有到期复习题");
      return;
    }

    const now = new Date().toISOString();
    const nextSession: DailyReviewSession = {
      id: `review_${Date.now()}`,
      deckId: ALL_DAILY_REVIEW_DECK_ID,
      startedAt: now,
      updatedAt: now,
      reviewIndex: 0,
      items: buildDailyReviewSessionItems(reviewPlan, questionById, reviewShuffleOptions)
    };
    setActiveReviewSession(nextSession);
    setReviewIndex(0);
    setView("review");
    setStatus(`全题库每日复习 ${reviewPlan.length} 道题${reviewSummary.capped ? "（已按优先级截取最需要复习的 1000 道）" : ""}`);
  }

  function updateDailyReviewItem(updater: (item: DailyReviewItem, question: Question) => DailyReviewItem) {
    setActiveReviewSession((session) => {
      if (!session) return session;
      const item = session.items[reviewIndex];
      const question = item ? questionById.get(item.questionId) : undefined;
      if (!item || !question) return session;
      const items = [...session.items];
      items[reviewIndex] = updater(item, question);
      return { ...session, items, reviewIndex, updatedAt: new Date().toISOString() };
    });
  }

  function recordDailyReviewResult(questionId: string, isCorrect: boolean, timestamp: string) {
    const shouldShowHardQuestionClear = shouldTriggerHardQuestionClearAnimation(data, questionId, isCorrect);
    if (shouldTriggerMistakeClearAnimation(data.stats[questionId], isCorrect)) {
      showMistakeClearAnimation(questionId);
    }
    if (shouldShowHardQuestionClear) {
      showHardQuestionClearAnimation(questionId);
    }
    setData((previous) => {
      const tracked = recordQuestionResultInData(previous, questionId, isCorrect, timestamp);
      return {
        ...tracked,
        dailyStats: recordDailyStudyResult(previous.dailyStats, isCorrect, timestamp)
      };
    });
  }

  function toggleDailyReviewOption(key: string) {
    const session = activeReviewSession;
    const item = session?.items[reviewIndex];
    const question = item ? questionById.get(item.questionId) : undefined;
    if (!session || !item || !question || item.isCorrect !== undefined) return;

    const selectedKeys = question.type === "多选题"
      ? item.selectedKeys.includes(key)
        ? item.selectedKeys.filter((selected) => selected !== key)
        : [...item.selectedKeys, key]
      : [key];
    const shouldConfirmNow = question.type !== "多选题";
    const isCorrect = shouldConfirmNow ? isAnswerCorrect(question, selectedKeys) : undefined;

    updateDailyReviewItem((item) => ({
      ...item,
      selectedKeys,
      ...(shouldConfirmNow ? { isCorrect } : {})
    }));

    if (shouldConfirmNow && isCorrect !== undefined) {
      recordDailyReviewResult(question.id, isCorrect, new Date().toISOString());
      if (isCorrect && reviewIndex < session.items.length - 1) {
        scheduleReviewAutoAdvance(question.id, reviewIndex, reviewIndex + 1);
      }
    }
  }

  function confirmDailyReviewQuestion() {
    const session = activeReviewSession;
    const item = session?.items[reviewIndex];
    const question = item ? questionById.get(item.questionId) : undefined;
    if (!session || !item || !question || item.isCorrect !== undefined || item.selectedKeys.length === 0) return;

    const isCorrect = isAnswerCorrect(question, item.selectedKeys);
    updateDailyReviewItem((item) => ({ ...item, isCorrect }));
    recordDailyReviewResult(question.id, isCorrect, new Date().toISOString());
    if (isCorrect && reviewIndex < session.items.length - 1) {
      scheduleReviewAutoAdvance(question.id, reviewIndex, reviewIndex + 1);
    }
  }

  function requestFinishDailyReview() {
    if (!activeReviewSession) return;
    clearReviewAutoAdvance();
    setDailyReviewFinishDialogOpen(true);
  }

  function finishDailyReview() {
    if (!activeReviewSession) return;
    clearReviewAutoAdvance();
    setDailyReviewFinishDialogOpen(false);
    const finished = activeReviewSession.items.filter((item) => item.isCorrect !== undefined).length;
    const wrong = activeReviewSession.items.filter((item) => item.isCorrect === false).length;
    const completedAt = new Date().toISOString();
    setData((previous) => ({
      ...removeDailyReviewSessionFromData(previous, activeReviewSession.deckId),
      dailyReviewCompletion: {
        date: dailySummaryDateKey,
        deckId: activeReviewSession.deckId,
        completedAt,
        finished,
        wrong
      }
    }));
    setActiveReviewSession(null);
    setReviewIndex(0);
    setView(isAllDailyReviewDeck(activeDeck) ? "home" : "dashboard");
    setStatus(`每日复习完成：已判定 ${finished} 道，错 ${wrong} 道`);
  }

  function leaveDailyReview(nextView?: View) {
    clearReviewAutoAdvance();
    setDailyReviewFinishDialogOpen(false);
    setSidebarCollapsed(false);
    setNavOpen(false);
    setView(nextView ?? (isAllDailyReviewDeck(activeDeck) ? "home" : "dashboard"));
    setStatus("每日复习进度已暂存，可稍后继续");
  }

  function requeueDailyReviewMistakes() {
    if (!activeReviewSession) return;
    clearReviewAutoAdvance();
    const wrongItems = activeReviewSession.items.filter((item) => item.isCorrect === false);
    const slashed = new Set(dataRef.current.slashedQuestionIds ?? []);
    const requeueableWrongItems = wrongItems.filter((item) => !slashed.has(item.questionId));
    const skippedSlashedCount = wrongItems.length - requeueableWrongItems.length;
    if (requeueableWrongItems.length === 0) {
      setStatus(skippedSlashedCount > 0 ? `本轮 ${skippedSlashedCount} 道错题已斩题，不再放回每日复习` : "本轮没有错题可重新配置");
      return;
    }
    const resetItems = buildDailyReviewSessionItems(requeueableWrongItems.map((item) => {
      const { isCorrect: _isCorrect, selectedKeys: _selectedKeys, ...rest } = item;
      return {
        ...rest,
        selectedKeys: []
      };
    }), questionById, reviewShuffleOptions);
    const now = new Date().toISOString();
    setActiveReviewSession((session) => (
      session
        ? {
          ...session,
          items: resetItems,
          reviewIndex: 0,
          updatedAt: now
        }
        : session
    ));
    setReviewIndex(0);
    setDailyReviewFinishDialogOpen(false);
    setStatus(`已将 ${requeueableWrongItems.length} 道错题重新配置到今日复习${skippedSlashedCount > 0 ? `，跳过 ${skippedSlashedCount} 道已斩题` : ""}`);
  }

  function submitExam() {
    const session = activeSessionRef.current;
    if (!session || session.submittedAt) return;
    const unansweredIndex = session.items.findIndex((item) => item.selectedKeys.length === 0);
    if (unansweredIndex >= 0) {
      const unansweredCount = session.items.filter((item) => item.selectedKeys.length === 0).length;
      setCurrentIndex(unansweredIndex);
      setStatus(`还有 ${unansweredCount} 道题未作答，已跳到第 ${unansweredIndex + 1} 题；答完后再交卷`);
      return;
    }

    const submittedAt = new Date().toISOString();
    const items = session.items.map((item) => {
      const question = questionById.get(item.questionId);
      return question ? { ...item, isCorrect: isAnswerCorrect(question, item.selectedKeys) } : item;
    });
    const correct = items.filter((item) => item.isCorrect).length;
    const score = Math.round((correct / Math.max(1, items.length)) * 1000) / 10;
    const durationSeconds = Math.max(1, Math.floor((new Date(submittedAt).getTime() - new Date(session.startedAt).getTime()) / 1000));
    const finishedSession: ExamSession = { ...session, items, submittedAt, score, durationSeconds };
    const currentData = dataRef.current;
    const clearedMistakeQuestionIds = items
      .filter((item) => shouldTriggerMistakeClearAnimation(currentData.stats[item.questionId], Boolean(item.isCorrect)))
      .map((item) => item.questionId);
    const clearedHardQuestionIds = items
      .filter((item) => shouldTriggerHardQuestionClearAnimation(currentData, item.questionId, Boolean(item.isCorrect)))
      .map((item) => item.questionId);

    setData((previous) => {
      const tracked = applySessionQuestionResults(previous, finishedSession);
      return {
        ...tracked,
        activeSession: null,
        dailyStats: applySessionDailyStats(previous.dailyStats, finishedSession),
        sessions: addFinishedSession(previous.sessions, finishedSession)
      };
    });
    setActiveSession(finishedSession);
    if (clearedMistakeQuestionIds.length > 0) showMistakeClearAnimation(clearedMistakeQuestionIds[clearedMistakeQuestionIds.length - 1]);
    if (clearedHardQuestionIds.length > 0) showHardQuestionClearAnimation(clearedHardQuestionIds[clearedHardQuestionIds.length - 1]);
    setStatus(`交卷完成：${score}%`);
    if (document.documentElement.classList.contains("native-android")) void import("./lib/androidSubmitSummary").then(({ showAndroidSubmitSummary }) => showAndroidSubmitSummary({ title: "模拟考试完成", score, correct, total: items.length, detail: "考试记录和错题统计已保存。", onReturn: leaveExam }));
    else if (IS_WINDOWS) window.alert(`交卷完成：${score}%\n请点击“返回上一级”回到工作台。`);
  }

  async function resetStats() {
    if (!await confirmAction("初始化软件？", "软件初始化会清空所有个人学习数据，并恢复内置固定题库；自定义题库会保留。继续吗？", "初始化", true)) return;
    clearAutoAdvanceTimers();
    setStatus("正在初始化软件");
    const baseData = clearPersonalDataForInitialization(dataRef.current);
    let nextData = baseData;
    let restoredCount = 0;
    let restoreError: unknown = null;
    try {
      const bootstrapData = await loadBootstrapSeedData(import.meta.env.BASE_URL);
      const restored = restoreSeedDecksFromBootstrap(baseData, bootstrapData, SEED_DECKS);
      nextData = restored.data;
      restoredCount = restored.restoredCount;
    } catch (error) {
      restoreError = error;
    }
    dataRef.current = nextData;
    setData(nextData);
    void saveData(nextData);
    setActiveSession(null);
    setActiveReviewSession(null);
    setDailyMistakeSummary(null);
    setActiveDeckId(null);
    setCurrentIndex(0);
    setReviewIndex(0);
    setActivePracticeStorageKey(null);
    setView("home");
    setStatus(restoreError
      ? "已初始化软件，但内置固定题库恢复失败，请重启或重新安装后再试"
      : `已初始化软件，恢复 ${restoredCount} 个固定题库`
    );
  }

  async function resetAll() {
    if (!await confirmAction("清空所有数据？", "清空题库、统计和导入状态？", "清空", true)) return;
    void clearQuestionImages();
    clearAutoAdvanceTimers();
    dataRef.current = emptyData; setData(emptyData); void saveData(emptyData);
    setActiveSession(null);
    setActiveReviewSession(null);
    setDailyMistakeSummary(null);
    setActiveDeckId(null);
    setActivePracticeStorageKey(null);
    seedAttempted.current = false;
    setView("home");
    setStatus("全部数据已清空");
  }

  function resetDeckProgress(deckId: string) {
    const deck = dataRef.current.decks.find((item) => item.id === deckId);
    if (!deck) return;
    setDeckActionDialog({ kind: "reset", deckId });
  }

  function executeResetDeckProgress(deckId: string) {
    const deck = dataRef.current.decks.find((item) => item.id === deckId);
    if (!deck) {
      setDeckActionDialog(null);
      return;
    }
    clearAutoAdvanceTimers();
    const nextData = resetDeckProgressForDeck(dataRef.current, deckId);
    setData(nextData);
    setDailyMistakeSummary(nextData.dailyMistakeSummary ?? null);
    if (activeSessionRef.current?.deckId === deckId) {
      setActiveSession(null);
      setCurrentIndex(0);
    }
    if (activeReviewSessionRef.current?.deckId === deckId) {
      setActiveReviewSession(null);
      setReviewIndex(0);
    }
    if (activeDeckId === deckId) {
      setActiveDeckId(null);
      setActivePracticeStorageKey(null);
      setView("home");
    }
    setStatus(`已重置「${deck.name}」的学习进度`);
    setDeckActionDialog(null);
  }

  function deleteDeck(deckId: string) {
    const deck = dataRef.current.decks.find((item) => item.id === deckId);
    if (!deck) return;
    setDeckActionDialog({ kind: "delete", deckId });
  }

  function removeDeckFromStudyPlan(deckId: string) {
    const deck = dataRef.current.decks.find((item) => item.id === deckId);
    if (!deck || isHardQuestionDeck(deck) || isAllDailyReviewDeck(deck)) return;
    if (!(dataRef.current.studyPlanDeckIds ?? []).includes(deckId)) return;
    setDeckActionDialog({ kind: "removePlan", deckId });
  }

  async function toggleStudyPlanDeck(deckId: string) {
    const deck = dataRef.current.decks.find((item) => item.id === deckId);
    if (!deck || isHardQuestionDeck(deck) || isAllDailyReviewDeck(deck)) return;
    const isAlreadyPlanned = (dataRef.current.studyPlanDeckIds ?? []).includes(deckId);
    if (isAlreadyPlanned) return;
    if (!await confirmAction("加入学习计划", `将「${deck.name}」加入学习计划？`, "加入")) return;
    setData((previous) => {
      const currentIds = previous.studyPlanDeckIds ?? [];
      return normalizeAppDataForCurrentRules({
        ...previous,
        studyPlanDeckIds: uniqueIds([...currentIds, deckId])
      });
    });
    setStatus(`已将「${deck.name}」加入学习计划`);
  }

  function executeRemoveDeckFromStudyPlan(deckId: string) {
    const deck = dataRef.current.decks.find((item) => item.id === deckId);
    if (!deck) {
      setDeckActionDialog(null);
      return;
    }
    clearAutoAdvanceTimers();
    const resetData = resetDeckProgressForDeck(dataRef.current, deckId);
    const nextData = normalizeAppDataForCurrentRules({
      ...resetData,
      studyPlanDeckIds: (resetData.studyPlanDeckIds ?? []).filter((item) => item !== deckId)
    });
    setData(nextData);
    setDailyMistakeSummary(nextData.dailyMistakeSummary ?? null);
    if (activeSessionRef.current?.deckId === deckId) {
      setActiveSession(null);
      setCurrentIndex(0);
    }
    if (activeReviewSessionRef.current?.deckId === deckId) {
      setActiveReviewSession(null);
      setReviewIndex(0);
    }
    if (activeDeckId === deckId) {
      setActiveDeckId(null);
      setActivePracticeStorageKey(null);
      setView("home");
    }
    setStatus(`已将「${deck.name}」移出学习计划，并重置该题库进度`);
    setDeckActionDialog(null);
  }

  function executeDeleteDeck(deckId: string) {
    const deck = dataRef.current.decks.find((item) => item.id === deckId);
    if (!deck) {
      setDeckActionDialog(null);
      return;
    }
    clearAutoAdvanceTimers();
    const nextData = deleteDeckFromData(dataRef.current, deckId);
    setData(nextData);
    setDailyMistakeSummary(nextData.dailyMistakeSummary ?? null);
    if (activeSessionRef.current?.deckId === deckId) {
      setActiveSession(null);
      setCurrentIndex(0);
    }
    if (activeReviewSessionRef.current?.deckId === deckId) {
      setActiveReviewSession(null);
      setReviewIndex(0);
    }
    if (activeDeckId === deckId) {
      setActiveDeckId(null);
      setActivePracticeStorageKey(null);
      setView("home");
    }
    setStatus(`已删除题库「${deck.name}」`);
    setDeckActionDialog(null);
  }

  function confirmDeckAction() {
    if (!deckActionDialog) return;
    if (deckActionDialog.kind === "reset") {
      executeResetDeckProgress(deckActionDialog.deckId);
      return;
    }
    if (deckActionDialog.kind === "removePlan") {
      executeRemoveDeckFromStudyPlan(deckActionDialog.deckId);
      return;
    }
    executeDeleteDeck(deckActionDialog.deckId);
  }

  function discardSubmittedPractice(storageKey: string) { setData((previous) => { if (!previous.practices[storageKey]?.submittedAt) return previous; const { [storageKey]: _submittedPractice, ...nextPractices } = previous.practices; return { ...previous, practices: nextPractices }; }); }

  function openDeckView(deckId: string, nextView: View = "dashboard") {
    clearAutoAdvanceTimers();
    const deck = deckId === ALL_DAILY_REVIEW_DECK_ID ? allDailyReviewDeck : data.decks.find((deck) => deck.id === deckId) ?? null;
    const isHardDeck = isHardQuestionDeck(deck);
    const resolvedView = isHardQuestionDeck(deck) && !HARD_DECK_NAV_KEYS.has(nextView)
      ? "practice"
      : isAllDailyReviewDeck(deck) && nextView !== "review"
        ? "review"
        : nextView;
    if (isHardDeck && document.documentElement.classList.contains("native-android") && data.practices[deckId]?.submittedAt) discardSubmittedPractice(deckId);
    setActiveDeckId(deckId);
    setActivePracticeStorageKey(deckId);
    if (deck && !isHardDeck && !isAllDailyReviewDeck(deck)) {
      setConfig(buildDefaultExamConfig(getDeckQuestions(data.questions, deck)));
    }
    setQuery("");
    setTypeFilter("全部");
    setBankFocus(null);
    setView(resolvedView);
  }

  function openDeck(deckId: string) {
    openDeckView(deckId, "dashboard");
  }

  function goHome() {
    clearAutoAdvanceTimers();
    setActiveDeckId(null);
    setActivePracticeStorageKey(null);
    setBankFocus(null);
    if (view === "home") {
      setBrandAnimationKey((key) => key + 1);
    }
    setView("home");
  }

  function leaveExam() { clearAutoAdvanceTimers(); setActiveSession(null); setCurrentIndex(0); setView(activeDeck ? "dashboard" : "home"); }

  function prepareAnsweringNavigation() {
    if (!isAnsweringView) return;
    clearAutoAdvanceTimers(); setAnswerProgressCollapsed(true); setSidebarCollapsed(false); setNavOpen(false);
    if (view === "review") {
      clearReviewAutoAdvance(); setDailyReviewFinishDialogOpen(false); setStatus("每日复习进度已暂存，可稍后继续");
      return;
    }
    setStatus("进度已保存，可稍后继续");
  }

  function requestAnsweringLeave() { if (!isAnsweringView) return; prepareAnsweringNavigation(); setView(view === "review" ? (isAllDailyReviewDeck(activeDeck) ? "home" : "dashboard") : activeDeck ? "dashboard" : "home"); }

  function navigateHomeFromSidebar() { if (isAnsweringView) prepareAnsweringNavigation(); goHome(); setNavOpen(false); }

  function navigateSidebarItem(itemKey: View) {
    if (isAnsweringView) prepareAnsweringNavigation();
    setActivePracticeStorageKey(activeDeck?.id ?? null);
    if (itemKey === "review") {
      if (!activeDeck || isAllDailyReviewDeck(activeDeck)) startAllDailyReview();
      else startDailyReview();
      setNavOpen(false);
      return;
    }
    if (itemKey === "bank") setBankFocus(null);
    setView(itemKey);
    setNavOpen(false);
  }

  function openQuestionSet(title: string, questions: Question[]) {
    setBankFocus({ title, questionIds: questions.map((question) => question.id) });
    setQuery("");
    setTypeFilter("全部");
    setView("bank");
    setStatus(`${title}：${questions.length} 道题`);
  }

  async function exportActiveDeckExcel() {
    if (DISABLE_QUESTION_BANK_EXPORT) {
      setStatus(QUESTION_BANK_EXPORT_DISABLED_MESSAGE); window.alert(QUESTION_BANK_EXPORT_DISABLED_MESSAGE);
      return;
    }
    if (!activeDeckId) {
      setStatus("请先选择一个题库");
      return;
    }
    await exportDeckExcelById(activeDeckId);
  }

  async function exportDeckExcelById(deckId: string) {
    if (DISABLE_QUESTION_BANK_EXPORT) {
      setStatus(QUESTION_BANK_EXPORT_DISABLED_MESSAGE); window.alert(QUESTION_BANK_EXPORT_DISABLED_MESSAGE);
      return;
    }
    const deck = data.decks.find((item) => item.id === deckId);
    if (!deck) {
      setStatus("请选择要导出的题库");
      return;
    }
    if (isHardQuestionDeck(deck)) {
      setStatus("重难题是个人生成题库，不提供导出");
      return;
    }

    const questions = getDeckQuestions(data.questions, deck);
    if (questions.length === 0) {
      setStatus(`${deck.name} 暂无可导出的题目`);
      return;
    }

    try {
      setStatus(`正在导出 ${deck.name}...`);
      await exportQuestionsToExcel(deck.name, questions, data.notes);
      setStatus(`已导出 ${deck.name} Excel 题库`);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("已取消导出题库");
        return;
      }
      setStatus(error instanceof Error ? error.message : "Excel 题库导出失败");
    }
  }

  async function exportAllDecksExcel() {
    if (DISABLE_QUESTION_BANK_EXPORT) {
      setStatus(QUESTION_BANK_EXPORT_DISABLED_MESSAGE); window.alert(QUESTION_BANK_EXPORT_DISABLED_MESSAGE);
      return;
    }
    const decks = data.decks
      .filter((deck) => !isHardQuestionDeck(deck))
      .map((deck) => ({ deckName: deck.name, questions: getDeckQuestions(data.questions, deck), notes: data.notes }))
      .filter((deck) => deck.questions.length > 0);

    if (decks.length === 0) {
      setStatus("暂无可导出的题库");
      return;
    }

    try {
      setStatus(`正在导出全部 ${decks.length} 个题库...`);
      await exportQuestionDecksToZip(decks);
      setStatus(`已导出全部 ${decks.length} 个题库`);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("已取消导出全部题库");
        return;
      }
      setStatus(error instanceof Error ? error.message : "全部题库导出失败");
    }
  }

  function generateDailyMistakeSummary() {
    const generatedAt = new Date().toISOString();
    setDailyMistakeSummary({
      date: dailySummaryDateKey,
      generatedAt,
      questionIds: todayWrongQuestions.map((question) => question.id)
    });
    setView("dailySummary");
    setStatus(`已生成今日错题总结：${todayWrongQuestions.length} 道`);
  }

  function buildHardQuestionDeck() {
    const hardQuestions = buildHardQuestionDeckQuestions(data.questions, data.stats, slashedQuestionSet, hardQuestionSet);
    if (hardQuestions.length === 0) {
      const hasHardDeck = data.decks.some((deck) => deck.id === HARD_QUESTION_DECK_ID);
      if (hasHardDeck) {
        setData((previous) => upsertDeck(previous, HARD_QUESTION_DECK_ID, HARD_QUESTION_DECK_NAME, []));
        setStatus("已更新重难题：暂无正确率低于 50% 的重难题");
        return;
      }
      setStatus("暂无正确率低于 50% 的重难题");
      return;
    }

    setData((previous) => upsertDeck(
      previous,
      HARD_QUESTION_DECK_ID,
      HARD_QUESTION_DECK_NAME,
      buildHardQuestionDeckQuestions(
        previous.questions,
        previous.stats,
        new Set(previous.slashedQuestionIds ?? []),
        new Set(previous.decks.find((deck) => deck.id === HARD_QUESTION_DECK_ID)?.questionIds ?? [])
      )
    ));
    setStatus(`已更新重难题：${hardQuestions.length} 道，正确率达到 50% 且连续答对 2 次才会移出`);
  }

  function exportDailyMistakeSummaryPdf() {
    if (!dailyMistakeSummary || dailyMistakeSummary.date !== dailySummaryDateKey) {
      setStatus("请先生成今日错题总结");
      return;
    }

    const previousTitle = document.title;
    const cleanup = () => {
      document.body.classList.remove("printing-daily-summary");
      document.title = previousTitle;
      window.removeEventListener("afterprint", cleanup);
    };

    document.body.classList.add("printing-daily-summary");
    document.title = `今日错题总结-${dailySummaryDateKey}`;
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1200);
    setStatus("已打开 PDF 保存窗口");
  }

  async function exportProgressBackup() {
    try {
      await exportData(data);
      setStatus("已保存学习进度备份");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("已取消导出学习进度");
        return;
      }
      setStatus(error instanceof Error ? error.message : "导出学习进度失败");
    }
  }

  async function importProgressBackup(file?: File) {
    if (!file) {
      setStatus("未选择学习进度备份文件");
      return;
    }
    try {
      setStatus(`正在导入学习进度：${file.name}`);
      const raw = await file.text();
      const restoredData = normalizeAppDataForCurrentRules(parseProgressBackup(raw));
      const restoredActiveSession = getRestorableActiveSession(restoredData.activeSession, restoredData);
      const restoredReviewSession = getInitialDailyReviewSession(restoredData, getDailySummaryDateKey(new Date()));
      if (!await confirmAction("导入学习进度？", "导入学习进度会覆盖当前本机题库、统计、复习进度、笔记、收藏和已斩题目，确认继续？", "导入", true)) {
        setStatus("已取消导入学习进度");
        return;
      }
      clearAutoAdvanceTimers();
      await importStoredQuestionImages(extractProgressBackupImages(raw));
      const importedData = { ...restoredData, activeSession: restoredActiveSession };
      const importedStatus = [
        `已导入学习进度：${restoredData.decks.length} 个题库`,
        `${restoredData.questions.length} 道题`,
        `${Object.keys(restoredData.stats ?? {}).length} 条答题记录`,
        `${(restoredData.favoriteQuestionIds ?? []).length} 个收藏`,
        `${(restoredData.slashedQuestionIds ?? []).length} 个已斩题`
      ].join("，");
      setData(importedData);
      setActiveSession(restoredActiveSession);
      setActiveReviewSession(restoredReviewSession);
      setDailyMistakeSummary(restoredData.dailyMistakeSummary ?? null);
      setCurrentIndex(getStoredSessionIndex(restoredActiveSession));
      setReviewIndex(restoredReviewSession?.reviewIndex ?? 0);
      setActiveDeckId(restoredActiveSession?.deckId ?? restoredReviewSession?.deckId ?? null);
      setActivePracticeStorageKey(null);
      setBankFocus(null);
      setDetailQuestionId(null);
      setEditingQuestionId(null);
      const saveResult = await saveData(importedData);
      if (restoredActiveSession) {
        setConfig(restoredActiveSession.config);
        setStatus("已导入学习进度并恢复未交卷的模拟考试");
        setView("exam");
      } else {
        setStatus(saveResult.ok ? importedStatus : `${importedStatus}；但保存失败：${saveResult.error ?? "请重试"}`);
        setView("home");
      }
      window.alert(importedStatus);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "学习进度导入失败");
      window.alert(error instanceof Error ? error.message : "学习进度导入失败");
    }
  }

  function updateQuestionNote(questionId: string, note: string) {
    setData((previous) => {
      const nextNotes = { ...(previous.notes ?? {}) };
      if (note.trim()) {
        nextNotes[questionId] = note;
      } else {
        delete nextNotes[questionId];
      }
      return { ...previous, notes: nextNotes };
    });
  }

  function saveQuestionEdit(updatedQuestion: Question) {
    setData((previous) => {
      const nextData = { ...previous, questions: previous.questions.map((question) => question.id === updatedQuestion.id ? updatedQuestion : question) };
      dataRef.current = nextData;
      void saveData(nextData);
      if (!DISABLE_QUESTION_BANK_EXPORT) void syncEditedQuestionToCanonicalBank(updatedQuestion).then((result) => { if (!result.skipped) setStatus(result.ok ? "题目已更新，并已写回内置题库源" : `题目已更新；题库源写回失败：${result.message ?? "未知错误"}`); });
      return nextData;
    });
    setEditingQuestionId(null);
    setStatus("题目已更新");
  }

  function toggleFavoriteQuestion(questionId: string) {
    const willFavorite = !favoriteQuestionSet.has(questionId);
    setData((previous) => {
      const favorites = new Set(previous.favoriteQuestionIds ?? []);
      if (favorites.has(questionId)) {
        favorites.delete(questionId);
      } else {
        favorites.add(questionId);
      }
      const practices = Object.fromEntries(Object.entries(previous.practices).map(([key, practice]) => {
        if (practice.scope !== "favorites" || practice.submittedAt) return [key, practice];
        const deck = previous.decks.find((item) => item.id === practice.deckId) ?? null;
        if (!deck) return [key, practice];
        const questions = getDeckQuestions(previous.questions, deck).filter((question) => favorites.has(question.id));
        return [key, reconcileFavoritePractice(practice, questions)];
      }));
      const nextData = { ...previous, favoriteQuestionIds: [...favorites], practices };
      void saveData(nextData);
      return nextData;
    });
    setStatus(willFavorite ? "已收藏题目" : "已取消收藏");
  }

  function toggleSlashedQuestion(questionId: string) {
    const currentData = dataRef.current;
    const slashed = new Set(currentData.slashedQuestionIds ?? []);
    const wasSlashed = slashed.has(questionId);
    const willSlash = !wasSlashed;
    const wasHard = isQuestionInHardDeck(currentData, questionId);
    if (willSlash && wasHard) {
      showSlashBlockedToast(questionId);
      setStatus("重难题不允许主动斩题");
      return;
    }
    if (willSlash) {
      manualSlashQuestionIds.current.add(questionId);
      slashed.add(questionId);
    } else {
      manualSlashQuestionIds.current.delete(questionId);
      slashed.delete(questionId);
    }
    const nextData = willSlash
      ? removeQuestionFromHardDeck({ ...currentData, slashedQuestionIds: [...slashed] }, questionId)
      : { ...currentData, slashedQuestionIds: [...slashed] };
    dataRef.current = nextData;
    setData(nextData);
    void saveData(nextData);
    setStatus(willSlash ? (wasHard ? "已斩题目，并已移出重难题" : "已斩题目") : "已取消斩题");
  }

  function toggleHardQuestion(questionId: string) {
    const currentData = dataRef.current;
    const willAdd = !isQuestionInHardDeck(currentData, questionId);
    const isSlashedNow = new Set(currentData.slashedQuestionIds ?? []).has(questionId);
    if (willAdd && isSlashedNow) {
      showHardQuestionBlockedToast(questionId, "slashed");
      setStatus("已斩题目不加入重难题");
      return;
    }
    if (willAdd && isManualHardQuestionAddBlocked(currentData.stats[questionId])) {
      showHardQuestionBlockedToast(questionId, "highAccuracy");
      setStatus("正确率超过 75%，不加入重难题");
      return;
    }
    if (!willAdd && isAutoHardQuestionLocked(currentData, questionId)) {
      showHardQuestionBlockedToast(questionId, "autoRule");
      setStatus("自动进入重难题的题目不能主动移出，恢复到 50% 且连续答对 2 次后会自动移出");
      return;
    }
    if (willAdd) {
      manualHardQuestionIds.current.add(questionId);
    } else {
      manualHardQuestionIds.current.delete(questionId);
    }
    const nextData = willAdd ? addQuestionToHardDeck(currentData, questionId) : removeQuestionFromHardDeck(currentData, questionId);
    dataRef.current = nextData;
    setData(nextData);
    void saveData(nextData);
    setStatus(willAdd ? "已加入重难题库" : "已移出重难题库");
  }

  function showSlashAnimation(questionId: string, reason: SlashAnimationReason) {
    clearSlashAnimation();
    setSlashAnimation({ questionId, reason });
    slashAnimationTimer.current = window.setTimeout(() => {
      slashAnimationTimer.current = null;
      setSlashAnimation(null);
    }, 1500);
  }

  function clearSlashAnimation() {
    if (slashAnimationTimer.current === null) return;
    window.clearTimeout(slashAnimationTimer.current);
    slashAnimationTimer.current = null;
  }

  function showHardQuestionAnimation(questionId: string, reason: HardQuestionAnimationReason) {
    clearHardQuestionAnimation();
    setHardQuestionAnimation({ questionId, reason });
    hardQuestionAnimationTimer.current = window.setTimeout(() => {
      hardQuestionAnimationTimer.current = null;
      setHardQuestionAnimation(null);
    }, 1500);
  }

  function clearHardQuestionAnimation() {
    if (hardQuestionAnimationTimer.current === null) return;
    window.clearTimeout(hardQuestionAnimationTimer.current);
    hardQuestionAnimationTimer.current = null;
  }

  function showMistakeClearAnimation(questionId: string) {
    clearMistakeClearAnimation();
    setMistakeClearAnimationQuestionId(questionId);
    mistakeClearAnimationTimer.current = window.setTimeout(() => {
      mistakeClearAnimationTimer.current = null;
      setMistakeClearAnimationQuestionId(null);
    }, 1800);
  }

  function clearMistakeClearAnimation() {
    if (mistakeClearAnimationTimer.current === null) return;
    window.clearTimeout(mistakeClearAnimationTimer.current);
    mistakeClearAnimationTimer.current = null;
  }

  function showHardQuestionClearAnimation(questionId: string) {
    clearHardQuestionClearAnimation();
    setHardQuestionClearAnimationQuestionId(questionId);
    hardQuestionClearAnimationTimer.current = window.setTimeout(() => {
      hardQuestionClearAnimationTimer.current = null;
      setHardQuestionClearAnimationQuestionId(null);
    }, 1800);
  }

  function clearHardQuestionClearAnimation() {
    if (hardQuestionClearAnimationTimer.current === null) return;
    window.clearTimeout(hardQuestionClearAnimationTimer.current);
    hardQuestionClearAnimationTimer.current = null;
  }

  function showHardQuestionBlockedToast(questionId: string, reason: HardQuestionBlockReason) {
    clearHardQuestionBlockedToast();
    setHardQuestionBlockedToast({ questionId, reason });
    hardQuestionBlockedToastTimer.current = window.setTimeout(() => {
      hardQuestionBlockedToastTimer.current = null;
      setHardQuestionBlockedToast(null);
    }, 1800);
  }

  function clearHardQuestionBlockedToast() {
    if (hardQuestionBlockedToastTimer.current === null) return;
    window.clearTimeout(hardQuestionBlockedToastTimer.current);
    hardQuestionBlockedToastTimer.current = null;
  }

  function showSlashBlockedToast(questionId: string) {
    clearSlashBlockedToast();
    setSlashBlockedToastId(questionId);
    slashBlockedToastTimer.current = window.setTimeout(() => {
      slashBlockedToastTimer.current = null;
      setSlashBlockedToastId(null);
    }, 1800);
  }

  function clearSlashBlockedToast() {
    if (slashBlockedToastTimer.current === null) return;
    window.clearTimeout(slashBlockedToastTimer.current);
    slashBlockedToastTimer.current = null;
  }

  function updatePracticeSettings(patch: Pick<PracticeState, "shuffleOptions" | "shuffleQuestions" | "autoAdvanceCorrect">) {
    if (!currentPracticeStorageKey) return;
    setData((previous) => {
      const practice = previous.practices[currentPracticeStorageKey];
      if (!practice || practice.submittedAt) return previous;
      return {
        ...previous,
        practices: {
          ...previous.practices,
          [currentPracticeStorageKey]: {
            ...practice,
            ...patch,
            updatedAt: new Date().toISOString()
          }
        }
      };
    });
  }

  function updatePracticeShuffleOptions(value: boolean) {
    setPracticeShuffleOptions(value);
    updatePracticeSettings({ shuffleOptions: value });
  }

  function updatePracticeShuffleQuestions(value: boolean) {
    setPracticeShuffleQuestions(value);
    updatePracticeSettings({ shuffleQuestions: value });
  }

  function updatePracticeAutoAdvanceCorrect(value: boolean) {
    setPracticeAutoAdvanceCorrect(value);
    updatePracticeSettings({ autoAdvanceCorrect: value });
  }

  function startFavoritePractice(reset = false, questionIds?: string[]) {
    const sourceQuestions = questionIds ? questionIds.map((questionId) => questionById.get(questionId)).filter((question): question is Question => Boolean(question)) : scopedFavoriteQuestions;
    if (sourceQuestions.length === 0) { setStatus(activeDeck ? "当前题库暂无收藏题" : "暂无收藏题"); return; }
    clearAutoAdvanceTimers();
    const targetDeck = activeDeck ?? { id: ALL_FAVORITES_PRACTICE_DECK_ID, name: "全部收藏题", questionIds: sourceQuestions.map((question) => question.id), createdAt: "", updatedAt: "" };
    const storageKey = getFavoritePracticeKey(targetDeck.id);
    const existingPractice = data.practices[storageKey];
    setActiveDeckId(activeDeck?.id ?? null);
    setActivePracticeStorageKey(storageKey);
    setPracticeShuffleOptions(false);
    setPracticeShuffleQuestions(false);
    setPracticeAutoAdvanceCorrect(existingPractice?.autoAdvanceCorrect !== false);
    if (!questionIds && !reset && existingPractice && !existingPractice.submittedAt) {
      setData((previous) => {
        const existing = previous.practices[storageKey];
        if (!existing || existing.submittedAt) return previous;
        return {
          ...previous,
          practices: {
            ...previous.practices,
            [storageKey]: reconcileFavoritePractice(existing, sourceQuestions)
          }
        };
      });
      setView("practice");
      setStatus(`已恢复收藏刷题进度，共 ${sourceQuestions.length} 道`);
      return;
    }
    const nowIso = new Date().toISOString();
    setData((previous) => ({
      ...previous,
      practices: {
        ...previous.practices,
        [storageKey]: {
          deckId: targetDeck.id,
          scope: "favorites",
          questionIds: sourceQuestions.map((question) => question.id),
          currentIndex: 0,
          mode: "answer",
          optionOrders: buildPracticeOptionOrders(sourceQuestions, false),
          shuffleOptions: false,
          shuffleQuestions: false,
          autoAdvanceCorrect: true,
          answers: {},
          results: {},
          startedAt: nowIso,
          updatedAt: nowIso
        }
      }
    }));
    setView("practice");
    setStatus(`${questionIds ? "已继续" : reset ? "已重新开始" : "已开始"}收藏刷题，共 ${sourceQuestions.length} 道`);
  }

  function startPractice(reset = false, shuffleOptions = practiceShuffleOptions, shuffleQuestions = practiceShuffleQuestions) {
    if (activePractice?.scope === "favorites") {
      startFavoritePractice(reset);
      return;
    }
    if (!activeDeck || activeQuestions.length === 0) {
      setStatus("请先选择一个有题目的题库");
      return;
    }

    clearAutoAdvanceTimers();
    setActivePracticeStorageKey(activeDeck.id);
    const isHardDeck = isHardQuestionDeck(activeDeck);
    const resolvedShuffleOptions = isHardDeck ? false : shuffleOptions;
    const resolvedShuffleQuestions = isHardDeck ? false : shuffleQuestions;
    const existingPractice = data.practices[activeDeck.id];
    if (!reset && existingPractice && !existingPractice.submittedAt) {
      const resumedPractice = applyPendingPracticeAutoAdvance(existingPractice);
      setPracticeShuffleOptions(isHardDeck ? false : Boolean(existingPractice.shuffleOptions));
      setPracticeShuffleQuestions(isHardDeck ? false : Boolean(existingPractice.shuffleQuestions));
      setPracticeAutoAdvanceCorrect(existingPractice.autoAdvanceCorrect !== false);
      if (isHardDeck && (getPracticeMode(existingPractice) !== "answer" || existingPractice.shuffleOptions || existingPractice.shuffleQuestions)) {
        setData((previous) => {
          const practice = previous.practices[activeDeck.id];
          if (!practice || practice.submittedAt) return previous;
          return {
            ...previous,
            practices: {
            ...previous.practices,
            [activeDeck.id]: {
                ...applyPendingPracticeAutoAdvance(practice),
                mode: "answer",
                shuffleOptions: false,
                shuffleQuestions: false,
                updatedAt: new Date().toISOString()
              }
            }
          };
        });
      } else if (resumedPractice !== existingPractice) {
        setData((previous) => ({ ...previous, practices: { ...previous.practices, [activeDeck.id]: resumedPractice } }));
      }
      setView("practice");
      setStatus(isHardDeck ? "已进入重难题顺序刷题" : "已进入顺序刷题");
      return;
    }

    const nowIso = new Date().toISOString();
    setPracticeShuffleOptions(resolvedShuffleOptions);
    setPracticeShuffleQuestions(resolvedShuffleQuestions);
    setData((previous) => {
      const existing = previous.practices[activeDeck.id];
      if (!reset && existing && !existing.submittedAt) return previous;
      const optionOrders = buildPracticeOptionOrders(activeQuestions, resolvedShuffleOptions);
      const slashed = new Set(previous.slashedQuestionIds ?? []);
      const questionIds = buildPracticeQuestionIds(activeQuestions, resolvedShuffleQuestions, isHardDeck ? new Set<string>() : slashed);
      const slashedAnswers = isHardDeck ? {} : buildSlashedPracticeAnswers(activeQuestions, slashed);
      const slashedResults = isHardDeck ? {} : buildSlashedPracticeResults(activeQuestions, slashed);
      return {
        ...previous,
        practices: {
          ...previous.practices,
          [activeDeck.id]: {
            deckId: activeDeck.id,
            scope: "deck",
            questionIds,
            currentIndex: 0,
            mode: "answer",
            optionOrders,
            shuffleOptions: resolvedShuffleOptions,
            shuffleQuestions: resolvedShuffleQuestions,
            autoAdvanceCorrect: practiceAutoAdvanceCorrect,
            answers: slashedAnswers,
            results: slashedResults,
            startedAt: nowIso,
            updatedAt: nowIso
          }
        }
      };
    });
    setView("practice");
    setStatus(isHardDeck ? (reset ? "已重新开始重难题顺序刷题" : "已进入重难题顺序刷题") : (reset ? "已重新开始顺序刷题" : "已进入顺序刷题"));
  }

  function clearPracticeAutoAdvance() {
    if (practiceAutoAdvanceTimer.current === null) return;
    window.clearTimeout(practiceAutoAdvanceTimer.current);
    practiceAutoAdvanceTimer.current = null;
  }

  function clearReviewAutoAdvance() {
    if (reviewAutoAdvanceTimer.current === null) return;
    window.clearTimeout(reviewAutoAdvanceTimer.current);
    reviewAutoAdvanceTimer.current = null;
  }

  function clearAutoAdvanceTimers() {
    clearPracticeAutoAdvance();
    clearReviewAutoAdvance();
  }

  function scheduleReviewAutoAdvance(questionId: string, fromIndex: number, nextIndex: number) {
    clearReviewAutoAdvance();
    reviewAutoAdvanceTimer.current = window.setTimeout(() => {
      reviewAutoAdvanceTimer.current = null;
      const session = activeReviewSessionRef.current;
      if (!session) return;
      if (reviewIndexRef.current !== fromIndex) return;
      if (session.items[fromIndex]?.questionId !== questionId) return;
      const boundedIndex = Math.max(0, Math.min(session.items.length - 1, nextIndex));
      setReviewIndex(boundedIndex);
      setActiveReviewSession((currentSession) => (
        currentSession
          ? { ...currentSession, reviewIndex: boundedIndex, updatedAt: new Date().toISOString() }
          : currentSession
      ));
    }, 500);
  }

  function schedulePracticeAutoAdvance(storageKey: string, questionId: string, fromIndex: number, nextIndex: number) {
    clearPracticeAutoAdvance();
    const update = (previous: AppData, commit = false) => {
      const practice = previous.practices[storageKey];
      if (!practice || practice.submittedAt || practice.questionIds[fromIndex] !== questionId) return previous;
      const boundedIndex = Math.max(0, Math.min(practice.questionIds.length - 1, nextIndex));
      return { ...previous, practices: { ...previous.practices, [storageKey]: { ...practice, pendingAutoAdvanceIndex: commit ? undefined : boundedIndex, ...(commit ? { currentIndex: boundedIndex } : {}), updatedAt: new Date().toISOString() } } };
    };
    setData((previous) => { const next = update(previous); dataRef.current = next; return next; });
    practiceAutoAdvanceTimer.current = window.setTimeout(() => {
      practiceAutoAdvanceTimer.current = null;
      setData((previous) => { const next = update(previous, true); dataRef.current = next; return next; });
    }, 500);
  }

  function setPracticeIndex(index: number) {
    if (!activePracticeDeck || !currentPracticeStorageKey) return;
    clearPracticeAutoAdvance();
    setData((previous) => {
      const practice = previous.practices[currentPracticeStorageKey];
      if (!practice || practice.questionIds.length === 0) return previous;
      const boundedIndex = Math.max(0, Math.min(practice.questionIds.length - 1, index));
      const mode = isHardQuestionDeck(activePracticeDeck) || practice.scope === "mistakes" ? "answer" : getPracticeMode(practice);
      return {
        ...previous,
        practices: {
          ...previous.practices,
          [currentPracticeStorageKey]: {
            ...practice,
            ...(mode === "review" ? { reviewIndex: boundedIndex } : { currentIndex: boundedIndex }),
            pendingAutoAdvanceIndex: undefined,
            updatedAt: new Date().toISOString()
          }
        }
      };
    });
  }

  function setPracticeMode(mode: PracticeMode) {
    if (!activePracticeDeck || !currentPracticeStorageKey) return;
    setData((previous) => {
      const practice = previous.practices[currentPracticeStorageKey];
      if (!practice || practice.submittedAt) return previous;
      if (practice.scope === "mistakes") return previous;
      if (getPracticeMode(practice) === mode) return previous;
      const nextPractice: PracticeState = {
        ...practice,
        mode,
        updatedAt: new Date().toISOString()
      };
      if (mode === "review") {
        nextPractice.reviewIndex = Math.max(0, Math.min(practice.questionIds.length - 1, practice.reviewIndex ?? practice.currentIndex));
      }
      return {
        ...previous,
        practices: {
          ...previous.practices,
          [currentPracticeStorageKey]: nextPractice
        }
      };
    });
  }

  function togglePracticeOption(key: string) {
    if (!activePracticeDeck || !activePractice || !currentPracticeStorageKey || activePractice.submittedAt) return;
    if (activePractice.scope !== "mistakes" && !isHardQuestionDeck(activePracticeDeck) && getPracticeMode(activePractice) === "review") return;
    const questionId = activePractice.questionIds[activePractice.currentIndex];
    const question = questionById.get(questionId);
    const results = activePractice.results ?? {};
    if (!question || results[questionId] !== undefined) return;

    const previousSelected = activePractice.answers[questionId] ?? [];
    const selectedKeys = question.type === "多选题"
      ? previousSelected.includes(key)
        ? previousSelected.filter((selected) => selected !== key)
        : [...previousSelected, key]
      : [key];
    const shouldAutoConfirm = question.type !== "多选题" && selectedKeys.length > 0;
    const isCorrect = shouldAutoConfirm ? isAnswerCorrect(question, selectedKeys) : false;
    const timestamp = new Date().toISOString();
    const shouldAdvance = shouldAutoConfirm && isCorrect && activePractice.autoAdvanceCorrect !== false && activePractice.currentIndex < activePractice.questionIds.length - 1;
    const shouldShowMistakeClear = shouldAutoConfirm && shouldTriggerMistakeClearAnimation(data.stats[questionId], isCorrect);
    const shouldShowHardQuestionClear = shouldAutoConfirm && shouldTriggerHardQuestionClearAnimation(data, questionId, isCorrect);

    setData((previous) => {
      const practice = previous.practices[currentPracticeStorageKey];
      if (!practice || practice.submittedAt) return previous;
      const previousResults = practice.results ?? {};
      if (previousResults[questionId] !== undefined) return previous;
      const nextPractice: PracticeState = {
        ...practice,
        answers: {
          ...practice.answers,
          [questionId]: selectedKeys
        },
        updatedAt: timestamp
      };
      if (!shouldAutoConfirm) {
        return {
          ...previous,
          practices: {
            ...previous.practices,
            [currentPracticeStorageKey]: nextPractice
          }
        };
      }

      const tracked = recordQuestionResultInData(previous, questionId, isCorrect, timestamp);
      return {
        ...tracked,
        dailyStats: recordDailyStudyResult(previous.dailyStats, isCorrect, timestamp),
        practices: {
          ...previous.practices,
          [currentPracticeStorageKey]: {
            ...nextPractice,
            results: {
              ...previousResults,
              [questionId]: isCorrect
            },
            updatedAt: timestamp
          }
        }
      };
    });
    if (shouldShowMistakeClear) {
      showMistakeClearAnimation(questionId);
    }
    if (shouldShowHardQuestionClear) {
      showHardQuestionClearAnimation(questionId);
    }
    if (shouldAdvance) schedulePracticeAutoAdvance(currentPracticeStorageKey, questionId, activePractice.currentIndex, activePractice.currentIndex + 1);
  }

  function confirmPracticeQuestion() {
    if (!activePracticeDeck || !activePractice || !currentPracticeStorageKey || activePractice.submittedAt) return;
    if (activePractice.scope !== "mistakes" && !isHardQuestionDeck(activePracticeDeck) && getPracticeMode(activePractice) === "review") return;
    const questionId = activePractice.questionIds[activePractice.currentIndex];
    const question = questionById.get(questionId);
    const selectedKeys = activePractice.answers[questionId] ?? [];
    const results = activePractice.results ?? {};
    if (!question || selectedKeys.length === 0 || results[questionId] !== undefined) return;

    const timestamp = new Date().toISOString();
    const isCorrect = isAnswerCorrect(question, selectedKeys);
    const shouldAdvance = isCorrect && activePractice.autoAdvanceCorrect !== false && activePractice.currentIndex < activePractice.questionIds.length - 1;
    const shouldShowMistakeClear = shouldTriggerMistakeClearAnimation(data.stats[questionId], isCorrect);
    const shouldShowHardQuestionClear = shouldTriggerHardQuestionClearAnimation(data, questionId, isCorrect);

    setData((previous) => {
      const practice = previous.practices[currentPracticeStorageKey];
      if (!practice || practice.submittedAt) return previous;
      const previousResults = practice.results ?? {};
      if (previousResults[questionId] !== undefined) return previous;
      const tracked = recordQuestionResultInData(previous, questionId, isCorrect, timestamp);
      return {
        ...tracked,
        dailyStats: recordDailyStudyResult(previous.dailyStats, isCorrect, timestamp),
        practices: {
          ...previous.practices,
          [currentPracticeStorageKey]: {
            ...practice,
            results: {
              ...previousResults,
              [questionId]: isCorrect
            },
            updatedAt: timestamp
          }
        }
      };
    });
    if (shouldShowMistakeClear) {
      showMistakeClearAnimation(questionId);
    }
    if (shouldShowHardQuestionClear) {
      showHardQuestionClearAnimation(questionId);
    }
    if (shouldAdvance) schedulePracticeAutoAdvance(currentPracticeStorageKey, questionId, activePractice.currentIndex, activePractice.currentIndex + 1);
  }

  async function submitPractice() {
    if (!activePractice || !currentPracticeStorageKey) return;
    const practiceDeck = activeDeck ?? dataRef.current.decks.find((deck) => deck.id === activePractice.deckId) ?? null;
    if (activePractice.questionIds.length === 0) {
      setStatus("本轮刷题没有可提交的题目");
      setView(practiceDeck ? "dashboard" : "home");
      return;
    }
    clearPracticeAutoAdvance();
    const pendingIndices = getPracticePendingIndices(activePractice);
    const unansweredIndices = getPracticeUnansweredIndices(activePractice);
    if (pendingIndices.length > 0) {
      const unansweredText = unansweredIndices.length > 0
        ? `\n未作答：第 ${formatQuestionIndexList(unansweredIndices)} 题`
        : "";
      const unconfirmedIndices = pendingIndices.filter((index) => !unansweredIndices.includes(index));
      const unconfirmedText = unconfirmedIndices.length > 0
        ? `\n已选择但未确认：第 ${formatQuestionIndexList(unconfirmedIndices)} 题`
        : "";
      const shouldSubmit = await confirmAction("仍要交卷吗", `还有 ${pendingIndices.length} 道题未完成判定。${unansweredText}${unconfirmedText}\n\n这些题交卷后会按未完成计入本次成绩，仍要交卷吗？`, "交卷");
      if (!shouldSubmit) {
        setStatus(`还有 ${pendingIndices.length} 道题未完成：第 ${formatQuestionIndexList(pendingIndices)} 题`);
        return;
      }
    }
    const submittedAt = new Date().toISOString();
    const results = activePractice.results ?? {};
    const correct = Object.values(results).filter(Boolean).length;
    const total = activePractice.questionIds.length;
    const slashedForRequeue = new Set(dataRef.current.slashedQuestionIds ?? []);
    const wrongQuestionIds = activePractice.questionIds.filter((questionId) => results[questionId] === false && !slashedForRequeue.has(questionId));
    const score = Math.round((correct / Math.max(1, total)) * 1000) / 10;
    setData((previous) => ({
      ...previous,
      practices: {
        ...previous.practices,
        [currentPracticeStorageKey]: {
          ...activePractice,
          submittedAt,
          score,
          updatedAt: submittedAt
        }
      }
    }));
    const isHardPractice = isHardQuestionDeck(practiceDeck);
    const practiceLabel = activePractice.scope === "favorites" ? "收藏刷题" : activePractice.scope === "mistakes" ? "错题刷题" : isHardPractice ? "重难题刷题" : "顺序刷题";
    setStatus(`${practiceLabel}交卷完成：${score}%${pendingIndices.length > 0 ? `；未完成 ${pendingIndices.length} 道：第 ${formatQuestionIndexList(pendingIndices)} 题` : ""}`);
    if (document.documentElement.classList.contains("native-android")) {
      void import("./lib/androidSubmitSummary").then(({ showAndroidSubmitSummary }) => showAndroidSubmitSummary({
        title: `${practiceLabel}完成`,
        score,
        correct,
        total,
        pending: pendingIndices.length,
        detail: wrongQuestionIds.length > 0 ? `本次错了 ${wrongQuestionIds.length} 道，可继续生成一轮错题刷题。` : "本次刷题进度已保存。",
        primaryLabel: "直接退出",
        secondaryAction: wrongQuestionIds.length > 0 ? {
          label: "继续刷错题",
          onClick: () => {
            setAnswerProgressCollapsed(true);
            setMistakePracticeFinishDialogOpen(false);
            startMistakePractice(wrongQuestionIds);
          }
        } : undefined,
        onReturn: () => {
          if (isHardPractice && currentPracticeStorageKey) discardSubmittedPractice(currentPracticeStorageKey);
          setAnswerProgressCollapsed(true);
          setMistakePracticeFinishDialogOpen(false);
          setView(isHardPractice ? "practice" : practiceDeck ? "dashboard" : "home");
        }
      }));
      return;
    }
    if (activePractice.scope === "mistakes" || activePractice.scope === "favorites") {
      setMistakePracticeFinishDialogOpen(true);
      return;
    }
  }

  function continuePracticeFromWrong() {
    if (!activePractice || (activePractice.scope !== "mistakes" && activePractice.scope !== "favorites")) return;
    const scope = activePractice.scope, questionIds = getPracticeWrongQuestionIds(activePractice, new Set(dataRef.current.slashedQuestionIds ?? []));
    if (questionIds.length === 0) { setStatus("本轮没有需要继续刷的错题"); return; }
    if (scope === "favorites") startFavoritePractice(true, questionIds);
    else startMistakePractice(questionIds);
  }

  function exitPracticeFinish() {
    const scope = activePractice?.scope;
    setMistakePracticeFinishDialogOpen(false);
    setActivePracticeStorageKey(activeDeck?.id ?? activeDeckId);
    setAnswerProgressCollapsed(true);
    setView(scope === "favorites" ? "favorites" : "mistakes");
    setStatus(scope === "favorites" ? "已退出收藏刷题" : "已退出错题刷题");
  }

  function renderMain() {
    if (view === "home") {
      return (
        <DeckHome
          data={data}
          slashedQuestionSet={slashedQuestionSet}
          openDeck={openDeck}
          openDeckView={openDeckView}
          startQuickExam={startQuickExam}
          buildHardQuestionDeck={buildHardQuestionDeck}
          startAllDailyReview={startAllDailyReview}
          openQuestion={setDetailQuestionId}
          editQuestion={setEditingQuestionId}
          resetDeckProgress={resetDeckProgress}
          deleteDeck={deleteDeck}
          removeDeckFromStudyPlan={removeDeckFromStudyPlan}
          toggleStudyPlanDeck={toggleStudyPlanDeck}
        />
      );
    }
    if (view === "favorites") {
      return (
        <FavoriteQuestionsPage
          questions={scopedFavoriteQuestions}
          scopeLabel={activeDeck?.name ?? "全部题库"}
          stats={data.stats}
          favoriteQuestionSet={favoriteQuestionSet}
          slashedQuestionSet={slashedQuestionSet}
          openQuestion={setDetailQuestionId}
          editQuestion={setEditingQuestionId}
          toggleFavoriteQuestion={toggleFavoriteQuestion}
          favoritePractice={favoritePractice}
          startFavoritePractice={startFavoritePractice}
        />
      );
    }
    if (view === "slashedList") {
      return (
        <SlashedQuestionsPage
          questions={scopedSlashedQuestions}
          scopeLabel={activeDeck?.name ?? "全部题库"}
          stats={data.stats}
          slashedQuestionSet={slashedQuestionSet}
          openQuestion={setDetailQuestionId}
          editQuestion={setEditingQuestionId}
          toggleSlashedQuestion={toggleSlashedQuestion}
        />
      );
    }
    if (view === "dailySummary") {
      return (
        <DailyMistakeSummaryPage
          summary={dailyMistakeSummary}
          todayKey={dailySummaryDateKey}
          todayWrongQuestions={todayWrongQuestions}
          summaryQuestions={dailySummaryQuestions}
          generateSummary={generateDailyMistakeSummary}
          exportSummaryPdf={exportDailyMistakeSummaryPdf}
          openQuestion={setDetailQuestionId}
          editQuestion={setEditingQuestionId}
        />
      );
    }
    if (!activeDeck && view !== "practice" && view !== "import" && view !== "export" && view !== "settings") {
      return (
        <DeckHome
          data={data}
          slashedQuestionSet={slashedQuestionSet}
          openDeck={openDeck}
          openDeckView={openDeckView}
          startQuickExam={startQuickExam}
          buildHardQuestionDeck={buildHardQuestionDeck}
          startAllDailyReview={startAllDailyReview}
          openQuestion={setDetailQuestionId}
          editQuestion={setEditingQuestionId}
          resetDeckProgress={resetDeckProgress}
          deleteDeck={deleteDeck}
          removeDeckFromStudyPlan={removeDeckFromStudyPlan}
          toggleStudyPlanDeck={toggleStudyPlanDeck}
        />
      );
    }
    if (view === "dashboard") {
      return (
        <Dashboard
          deck={activeDeck}
          data={data}
          questions={activeQuestions}
          slashedQuestionSet={slashedQuestionSet}
          typeCounts={typeCounts}
          statSummary={statSummary}
          config={config}
          setConfig={setConfig}
          startExam={startExam}
          activeSession={activeSession && activeSession.deckId === activeDeck?.id && !activeSession.submittedAt ? activeSession : null}
          resumeExam={resumeActiveExam}
          startPractice={startPractice}
          practice={activePractice}
          mistakeCount={mistakeQuestions.length}
          reviewSummary={dailyReviewSummary}
          startDailyReview={startDailyReview}
          practiceShuffleOptions={practiceShuffleOptions}
          setPracticeShuffleOptions={updatePracticeShuffleOptions}
          practiceShuffleQuestions={practiceShuffleQuestions}
          setPracticeShuffleQuestions={updatePracticeShuffleQuestions}
          practiceAutoAdvanceCorrect={practiceAutoAdvanceCorrect}
          setPracticeAutoAdvanceCorrect={updatePracticeAutoAdvanceCorrect}
        />
      );
    }
    if (view === "review") {
      const storedDeckReviewSession = activeDeck ? getCurrentDailyReviewSession(data, activeDeck.id, dailySummaryDateKey) : null;
      const deckReviewSession = activeReviewSession?.deckId === activeDeck?.id ? activeReviewSession : storedDeckReviewSession;
      const deckReviewIndex = activeReviewSession?.deckId === activeDeck?.id ? reviewIndex : deckReviewSession?.reviewIndex ?? 0;
      return (
        <DailyReviewView
          deck={activeDeck}
          stats={data.stats}
          activeReviewSession={deckReviewSession}
          reviewIndex={deckReviewSession ? deckReviewIndex : 0}
          setReviewIndex={goToReviewIndex}
          questionById={questionById}
          toggleDailyReviewOption={toggleDailyReviewOption}
          confirmDailyReviewQuestion={confirmDailyReviewQuestion}
          finishDailyReview={requestFinishDailyReview}
          leaveDailyReview={leaveDailyReview}
          notes={data.notes}
          updateQuestionNote={updateQuestionNote}
          editQuestion={setEditingQuestionId}
          favoriteQuestionSet={favoriteQuestionSet}
          toggleFavoriteQuestion={toggleFavoriteQuestion}
          slashedQuestionSet={slashedQuestionSet}
          toggleSlashedQuestion={toggleSlashedQuestion}
          hardQuestionSet={hardQuestionSet}
          toggleHardQuestion={toggleHardQuestion}
          progressCollapsed={answerProgressCollapsed}
          setProgressCollapsed={setAnswerProgressCollapsed}
          showSidebarToggle={sidebarCollapsed}
          openSidebar={() => setSidebarCollapsed(false)}
        />
      );
    }
    if (view === "practice") {
      return (
        <PracticeView
          deck={activePracticeDeck}
          practice={activePractice}
          stats={data.stats}
          questionById={questionById}
          startPractice={startPractice}
          restartMistakePractice={() => startMistakePractice(undefined, true)}
          practiceShuffleOptions={practiceShuffleOptions}
          setPracticeShuffleOptions={updatePracticeShuffleOptions}
          practiceShuffleQuestions={practiceShuffleQuestions}
          setPracticeShuffleQuestions={updatePracticeShuffleQuestions}
          practiceAutoAdvanceCorrect={practiceAutoAdvanceCorrect}
          setPracticeAutoAdvanceCorrect={updatePracticeAutoAdvanceCorrect}
          setPracticeIndex={setPracticeIndex}
          setPracticeMode={setPracticeMode}
          togglePracticeOption={togglePracticeOption}
          confirmPracticeQuestion={confirmPracticeQuestion}
          submitPractice={submitPractice}
          notes={data.notes}
          updateQuestionNote={updateQuestionNote}
          editQuestion={setEditingQuestionId}
          favoriteQuestionSet={favoriteQuestionSet}
          toggleFavoriteQuestion={toggleFavoriteQuestion}
          slashedQuestionSet={slashedQuestionSet}
          toggleSlashedQuestion={toggleSlashedQuestion}
          hardQuestionSet={hardQuestionSet}
          toggleHardQuestion={toggleHardQuestion}
          allQuestions={data.questions}
          allDecks={data.decks}
          openQuestion={setDetailQuestionId}
          progressCollapsed={answerProgressCollapsed}
          setProgressCollapsed={setAnswerProgressCollapsed}
          showSidebarToggle={sidebarCollapsed}
          openSidebar={() => setSidebarCollapsed(false)}
        />
      );
    }
    if (view === "exam") {
      return (
        <ExamView
          activeSession={activeSession}
          config={config}
          setConfig={setConfig}
          startExam={startExam}
          currentIndex={currentIndex}
          setCurrentIndex={goToExamIndex}
          questionById={questionById}
          stats={data.stats}
          toggleOption={toggleOption}
          confirmExamQuestion={confirmExamQuestion}
          submitExam={submitExam}
          leaveExam={leaveExam}
          notes={data.notes}
          updateQuestionNote={updateQuestionNote}
          editQuestion={setEditingQuestionId}
          favoriteQuestionSet={favoriteQuestionSet}
          toggleFavoriteQuestion={toggleFavoriteQuestion}
          slashedQuestionSet={slashedQuestionSet}
          toggleSlashedQuestion={toggleSlashedQuestion}
          hardQuestionSet={hardQuestionSet}
          toggleHardQuestion={toggleHardQuestion}
          progressCollapsed={answerProgressCollapsed}
          setProgressCollapsed={setAnswerProgressCollapsed}
          showSidebarToggle={sidebarCollapsed}
          openSidebar={() => setSidebarCollapsed(false)}
        />
      );
    }
    if (view === "bank") {
      return (
        <QuestionBank
          questions={filteredQuestions}
          stats={data.stats}
          slashedQuestionSet={slashedQuestionSet}
          total={activeQuestions.length}
          focus={bankFocus}
          clearFocus={() => setBankFocus(null)}
          query={query}
          setQuery={setQuery}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          openQuestion={setDetailQuestionId}
          editQuestion={setEditingQuestionId}
        />
      );
    }
    if (view === "mistakes") {
      return (
        <Mistakes
          questions={mistakeQuestions}
          stats={data.stats}
          slashedQuestionSet={slashedQuestionSet}
          openQuestion={setDetailQuestionId}
          editQuestion={setEditingQuestionId}
          mistakeShuffleOptions={mistakeShuffleOptions}
          setMistakeShuffleOptions={setMistakeShuffleOptions}
          mistakePractice={mistakePractice}
          startMistakePractice={() => startMistakePractice()}
        />
      );
    }
    if (view === "stats") {
      return (
        <Stats
          data={data}
          sessions={deckSessions}
          questions={activeQuestions}
          typeCounts={typeCounts}
          statSummary={statSummary}
          excludedSlashedCount={activeQuestions.filter((question) => slashedQuestionSet.has(question.id)).length}
          openQuestionSet={openQuestionSet}
        />
      );
    }
    if (view === "import") {
      return <ImportPanel handleExcelImport={handleExcelImport} report={report} />;
    }
    if (view === "export") {
      return (
        <ExportPanel
          data={data}
          selectedDeckId={exportDeckId || activeDeckId || data.decks[0]?.id || ""}
          setSelectedDeckId={setExportDeckId}
          exportSelectedDeckExcel={exportDeckExcelById}
          exportAllDecksExcel={exportAllDecksExcel}
        />
      );
    }
      return (
        <SettingsPanel
          data={data}
          exportProgress={exportProgressBackup}
          importProgressBackup={importProgressBackup}
          resetStats={resetStats}
          resetAll={resetAll}
        />
      );
  }

  const sidebarNavItems = activeDeck && !isActiveAllDailyReviewDeck
    ? navItems.filter((item) => (
      isActiveHardDeck
        ? HARD_DECK_NAV_KEYS.has(item.key)
        : !DECK_HIDDEN_NAV_KEYS.has(item.key)
    ))
    : navItems.filter((item) => HOME_NAV_KEYS.has(item.key));
  const deckActionDeck = deckActionDialog ? data.decks.find((deck) => deck.id === deckActionDialog.deckId) ?? null : null;
  const brandSequenceClass = brandAnimationKey % 2 === 0 ? "brand-sequence-a" : "brand-sequence-b";

  return (
    <div className={["app-shell", IS_WINDOWS ? "windows-app" : "", sidebarCollapsed ? "sidebar-collapsed" : ""].filter(Boolean).join(" ")}>
      <aside className={navOpen ? "sidebar nav-open" : "sidebar"}>
        <button
          key={brandAnimationKey}
          className={["brand", "brand-button", brandSequenceClass].join(" ")}
          type="button"
          onClick={() => setShowCopyright(true)}
          aria-label="打开版权介绍"
        >
          <div className="brand-mark">
            <span className="brand-mark-glyph">塔</span>
          </div>
          <div className="brand-copy">
            <strong>里木刷题王</strong>
            <span className="brand-subtitle">
              {sidebarSubtitleLines.map((line) => (
                <span className="brand-subtitle-line" key={line}>{renderBrandSubtitleLine(line)}</span>
              ))}
            </span>
          </div>
        </button>
        {isAnsweringView && (
          <button className="sidebar-pin-toggle" type="button" onClick={() => setSidebarCollapsed(true)} aria-label="收起左侧导航">
            <Menu size={18} />
            <span>收起导航</span>
          </button>
        )}
        <button className="nav-toggle" type="button" aria-label={navOpen ? "收起导航" : "展开导航"} aria-expanded={navOpen} onClick={() => setNavOpen((open) => !open)}>
          {navOpen ? <XCircle size={20} /> : <Menu size={20} />}
          <span>导航</span>
        </button>
        <nav className="nav-list" aria-label="主导航">
          <button aria-label="题库首页" className={view === "home" ? "nav-item active" : "nav-item"} onClick={navigateHomeFromSidebar}>
            <ArrowLeft size={18} />
            <span>题库首页</span>
          </button>
          {sidebarNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                aria-label={item.label}
                className={view === item.key ? "nav-item active" : "nav-item"}
                onClick={() => navigateSidebarItem(item.key)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-status">
          <span>{status}</span>
        </div>
      </aside>
      {(navOpen || (isAnsweringView && !sidebarCollapsed)) && <MobileNavDismissLayer onDismiss={() => { setNavOpen(false); if (isAnsweringView) setSidebarCollapsed(true); }} />}
      <main ref={mainAreaRef} className="main-area">{renderMain()}</main>
      {slashAnimation && (
        <SlashBurst question={questionById.get(slashAnimation.questionId)} reason={slashAnimation.reason} />
      )}
      {hardQuestionAnimation && (
        <HardQuestionBurst question={questionById.get(hardQuestionAnimation.questionId)} reason={hardQuestionAnimation.reason} />
      )}
      {(mistakeClearAnimationQuestionId || hardQuestionClearAnimationQuestionId || hardQuestionBlockedToast || slashBlockedToastId) && (
        <div className="feedback-toast-stack">
          {mistakeClearAnimationQuestionId && (
            <MistakeClearToast />
          )}
          {hardQuestionClearAnimationQuestionId && (
            <HardQuestionClearToast />
          )}
          {hardQuestionBlockedToast && (
            <HardQuestionBlockedToast
              question={questionById.get(hardQuestionBlockedToast.questionId)}
              reason={hardQuestionBlockedToast.reason}
            />
          )}
          {slashBlockedToastId && <SlashBlockedToast />}
        </div>
      )}
      {dailyReviewFinishDialogOpen && activeReviewSession && (
        <DailyReviewFinishDialog
          session={activeReviewSession}
          slashedQuestionSet={slashedQuestionSet}
          onFinish={finishDailyReview}
          onRequeueMistakes={requeueDailyReviewMistakes}
          onClose={() => setDailyReviewFinishDialogOpen(false)}
        />
      )}
      {mistakePracticeFinishDialogOpen && activePractice && (activePractice.scope === "mistakes" || activePractice.scope === "favorites") && (
        <MistakePracticeFinishDialog
          practice={activePractice}
          label={activePractice.scope === "favorites" ? "收藏刷题" : "错题刷题"}
          excludedQuestionIds={slashedQuestionSet}
          onContinueWrong={continuePracticeFromWrong}
          onExit={exitPracticeFinish}
          onClose={() => setMistakePracticeFinishDialogOpen(false)}
        />
      )}
      {deckActionDialog && deckActionDeck && (
        <DeckActionConfirmDialog
          action={deckActionDialog.kind}
          deck={deckActionDeck}
          onConfirm={confirmDeckAction}
          onClose={() => setDeckActionDialog(null)}
        />
      )}
      {detailQuestion && (
        <QuestionDetailDialog
          question={detailQuestion}
          stat={data.stats[detailQuestion.id]}
          isSlashed={slashedQuestionSet.has(detailQuestion.id)}
          isHard={hardQuestionSet.has(detailQuestion.id)}
          deckNames={getQuestionDeckNames(detailQuestion.id, data.decks)}
          note={data.notes[detailQuestion.id] ?? ""}
          updateQuestionNote={updateQuestionNote}
          toggleHardQuestion={() => toggleHardQuestion(detailQuestion.id)}
          onEdit={() => setEditingQuestionId(detailQuestion.id)}
          onClose={() => setDetailQuestionId(null)}
        />
      )}
      {editingQuestion && (
        <QuestionEditDialog
          question={editingQuestion}
          onSave={saveQuestionEdit}
          onClose={() => setEditingQuestionId(null)}
        />
      )}
      {showCopyright && (
        <CopyrightDialog
          onClose={() => setShowCopyright(false)}
          backShortcutLabel={BACK_SHORTCUT_LABEL}
          shortcutModifierLabel={SHORTCUT_MODIFIER_LABEL}
        />
      )}
      {desktopCloseGuard.open && <DesktopCloseConfirmDialog onSaveAndQuit={desktopCloseGuard.saveAndQuit} onCancel={desktopCloseGuard.cancelClose} />}
    </div>
  );
}

function DeckActionConfirmDialog({
  action,
  deck,
  onConfirm,
  onClose
}: {
  action: DeckActionDialogState["kind"];
  deck: Deck;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const isDelete = action === "delete";
  const isRemovePlan = action === "removePlan";
  const title = isDelete ? "删除这个题库？" : isRemovePlan ? "移除学习计划？" : "重置这个题库的进度？";
  const actionLabel = isDelete ? "删除题库" : isRemovePlan ? "移除并重置" : "重置进度";
  const icon = isDelete
    ? <Trash2 size={24} strokeWidth={2.4} />
    : isRemovePlan
      ? <XCircle size={24} strokeWidth={2.4} />
      : <RotateCcw size={24} strokeWidth={2.4} />;
  const actionIcon = isDelete
    ? <Trash2 size={18} />
    : isRemovePlan
      ? <XCircle size={18} />
      : <RotateCcw size={18} />;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <article className="deck-action-dialog" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header className="deck-action-dialog-header">
          <span className={isDelete ? "deck-action-icon danger" : "deck-action-icon"}>
            {icon}
          </span>
          <div>
            <span className="eyebrow">题库操作</span>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" type="button" aria-label="关闭" onClick={onClose}>
            <XCircle size={20} />
          </button>
        </header>
        <div className="deck-action-copy">
          <strong>{deck.name}</strong>
          {isDelete ? (
            <p>删除后，该题库入口会消失；只属于这个题库的题目和学习记录也会一并删除。被其它题库共用的题目不会删除。</p>
          ) : isRemovePlan ? (
            <p>移除学习计划后，该题库不会继续显示在首页；同时会重置该题库进度，包括答题统计、已斩状态、考试/复习/顺序刷题进度。题目、收藏和笔记会保留。</p>
          ) : (
            <p>会清空这个题库的答题统计、已斩状态、考试/复习/顺序刷题进度；题目、收藏和笔记会保留。</p>
          )}
        </div>
        <div className="deck-action-dialog-actions">
          <button className="secondary-button" type="button" onClick={onClose}>取消</button>
          <button className={isDelete ? "danger-button" : "primary-button"} type="button" onClick={onConfirm}>
            {actionIcon}
            {actionLabel}
          </button>
        </div>
      </article>
    </div>
  );
}

function SlashBurst({ question, reason }: { question?: Question; reason: SlashAnimationReason }) {
  const isManual = reason === "manual", androidCompact = document.documentElement.classList.contains("native-android");
  return (
    <div className="slash-burst" aria-hidden="true">
      <div className="slash-burst-ring" />
      <div className="slash-burst-blade">
        <Sword size={70} strokeWidth={2.4} />
      </div>
      <div className="slash-burst-cut cut-a" />
      <div className="slash-burst-cut cut-b" />
      <div className="slash-burst-card">
        <strong className={isManual ? "manual-slash-title" : undefined}>{androidCompact ? "斩" : isManual ? "斩" : "已自动斩题"}</strong>
        <span>{isManual ? `${question?.uid ?? "这道题"} 已加入已斩题目` : `${question?.uid ?? "这道题"} 连续答对 5 次`}</span>
      </div>
    </div>
  );
}

function HardQuestionBurst({ question, reason }: { question?: Question; reason: HardQuestionAnimationReason }) {
  const isManual = reason === "manual", androidCompact = document.documentElement.classList.contains("native-android");
  return (
    <div className="slash-burst hard-question-burst" aria-hidden="true">
      <div className="slash-burst-ring" />
      <div className="slash-burst-blade hard-question-burst-icon">
        <AlertTriangle size={74} strokeWidth={2.35} />
      </div>
      <div className="slash-burst-cut cut-a" />
      <div className="slash-burst-cut cut-b" />
      <div className="slash-burst-card hard-question-burst-card">
        <strong className={isManual ? "manual-hard-title" : undefined}>{androidCompact ? "重难" : isManual ? "重难" : "已加入重难题"}</strong>
        <span>{isManual ? `${question?.uid ?? "这道题"} 已手动加入重难题库` : `${question?.uid ?? "这道题"} 正确率低于 50%`}</span>
      </div>
    </div>
  );
}

function MistakeClearToast() {
  return (
    <div className="mistake-clear-toast" role="status" aria-live="polite">
      <span className="mistake-clear-icon">
        <CheckCircle2 size={22} strokeWidth={2.4} />
      </span>
      <span className="mistake-clear-copy">
        <strong>该题目已从错题中移出</strong>
        <em>连续答对 3 次</em>
      </span>
    </div>
  );
}

function HardQuestionClearToast() {
  return (
    <div className="mistake-clear-toast hard-clear-toast" role="status" aria-live="polite">
      <span className="mistake-clear-icon hard-clear-icon">
        <CheckCircle2 size={22} strokeWidth={2.4} />
      </span>
      <span className="mistake-clear-copy">
        <strong>该题目已从重难题中移出</strong>
        <em>正确率达 50%，连续答对 2 次</em>
      </span>
    </div>
  );
}

function HardQuestionBlockedToast({ reason }: { question?: Question; reason: HardQuestionBlockReason }) {
  const isHighAccuracy = reason === "highAccuracy";
  const isAutoRule = reason === "autoRule";
  return (
    <div className="mistake-clear-toast hard-block-toast" role="status" aria-live="polite">
      <span className="mistake-clear-icon hard-block-icon">
        <AlertTriangle size={22} strokeWidth={2.4} />
      </span>
      <span className="mistake-clear-copy hard-block-copy">
        <strong>{isAutoRule ? "自动重难题不能主动移出" : isHighAccuracy ? "正确率超过 75%，不能加入重难题" : "已斩题目不能加入重难题"}</strong>
        {isAutoRule && <em>正确率恢复到 50% 且连续答对 2 次后自动移出</em>}
      </span>
    </div>
  );
}

function SlashBlockedToast() {
  return (
    <div className="mistake-clear-toast slash-block-toast" role="status" aria-live="polite">
      <span className="mistake-clear-icon slash-block-icon">
        <Sword size={22} strokeWidth={2.4} />
      </span>
      <span className="mistake-clear-copy hard-block-copy">
        <strong>重难题不允许主动斩题</strong>
      </span>
    </div>
  );
}

function DeckHome({
  data,
  slashedQuestionSet,
  openDeck,
  openDeckView,
  startQuickExam,
  buildHardQuestionDeck,
  startAllDailyReview,
  openQuestion,
  editQuestion,
  resetDeckProgress,
  deleteDeck,
  removeDeckFromStudyPlan,
  toggleStudyPlanDeck,
}: {
  data: AppData;
  slashedQuestionSet: Set<string>;
  openDeck: (deckId: string) => void;
  openDeckView: (deckId: string, view: View) => void;
  startQuickExam: (deckId: string) => void;
  buildHardQuestionDeck: () => void;
  startAllDailyReview: () => void;
  openQuestion: (questionId: string) => void;
  editQuestion: (questionId: string) => void;
  resetDeckProgress: (deckId: string) => void;
  deleteDeck: (deckId: string) => void;
  removeDeckFromStudyPlan: (deckId: string) => void;
  toggleStudyPlanDeck: (deckId: string) => void;
}) {
  const hardDecks = data.decks.filter((deck) => isHardQuestionDeck(deck));
  const normalDecks = data.decks.filter((deck) => !isHardQuestionDeck(deck));
  const studyPlanDeckIds = new Set(data.studyPlanDeckIds ?? []);
  const plannedDecks = normalDecks.filter((deck) => studyPlanDeckIds.has(deck.id));
  const orderedDecks = [...hardDecks, ...plannedDecks];
  const dailyReviewPanel = <HomeTaskPanel data={data} slashedQuestionSet={slashedQuestionSet} startAllDailyReview={startAllDailyReview} />;
  const studyStatsPanel = <HomeStudyStats dailyStats={data.dailyStats} />;

  return (
    <section className="page">
      <QuestionSearchPanel
        questions={data.questions}
        decks={data.decks}
        stats={data.stats}
        slashedQuestionSet={slashedQuestionSet}
        openQuestion={openQuestion}
        editQuestion={editQuestion}
      />
      {dailyReviewPanel}
      <div className="deck-grid">
        {orderedDecks.map((deck) => (
          <DeckCard
            key={deck.id}
            deck={deck}
            data={data}
            slashedQuestionSet={slashedQuestionSet}
            openDeck={openDeck}
            resetDeckProgress={resetDeckProgress}
            deleteDeck={deleteDeck}
            removeDeckFromStudyPlan={removeDeckFromStudyPlan}
          />
        ))}
        {data.decks.length === 0 && (
          <section className="empty-deck-panel">
            <FileSpreadsheet size={36} />
            <p>正在准备题库，或导入一个 Excel 题库开始。</p>
          </section>
        )}
        {data.decks.length > 0 && orderedDecks.length === 0 && (
          <section className="empty-deck-panel">
            <BookOpen size={36} />
            <p>还没有加入学习计划的题库。可在下方选择想学的题库。</p>
          </section>
        )}
      </div>
      {studyStatsPanel}
      <StudyPlanPanel decks={normalDecks} selectedDeckIds={studyPlanDeckIds} toggleStudyPlanDeck={toggleStudyPlanDeck} />
    </section>
  );
}

function StudyPlanPanel({
  decks,
  selectedDeckIds,
  toggleStudyPlanDeck
}: {
  decks: Deck[];
  selectedDeckIds: Set<string>;
  toggleStudyPlanDeck: (deckId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const searchText = normalizeSearchText(query);
  const filteredDecks = decks.filter((deck) => !searchText || normalizeSearchText(deck.name).includes(searchText));

  return (
    <section className="study-plan-panel" aria-label="选择首页显示的题库">
      {decks.length > 6 && (
        <label className="study-plan-search">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索题库" />
        </label>
      )}
      {decks.length > 0 ? (
        <div className="study-plan-list">
          {filteredDecks.map((deck) => {
            const selected = selectedDeckIds.has(deck.id);
            return (
              <button
                key={deck.id}
                className={selected ? "study-plan-item selected" : "study-plan-item"}
                type="button"
                aria-pressed={selected}
                disabled={selected}
                onClick={() => toggleStudyPlanDeck(deck.id)}
              >
                <span className="study-plan-item-icon">
                  {selected ? <CheckCircle2 size={17} /> : <BookOpen size={17} />}
                </span>
                <span className="study-plan-item-name">{deck.name}</span>
                <em>{selected ? "已加入" : "加入"}</em>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="empty-text">暂无可加入学习计划的普通题库。</p>
      )}
      {decks.length > 0 && filteredDecks.length === 0 && (
        <p className="empty-text">没有匹配的题库。</p>
      )}
    </section>
  );
}

function HomeTaskPanel({
  data,
  slashedQuestionSet,
  startAllDailyReview
}: {
  data: AppData;
  slashedQuestionSet: Set<string>;
  startAllDailyReview: () => void;
}) {
  const todayKey = getDailySummaryDateKey(new Date());
  const allReviewDeck = useMemo(() => buildAllDailyReviewDeck(data.decks), [data.decks]);
  const reviewQuestions = useMemo(
    () => getDeckQuestions(data.questions, allReviewDeck).filter((question) => !slashedQuestionSet.has(question.id)),
    [data.questions, allReviewDeck, slashedQuestionSet]
  );
  const reviewSummary = useMemo(() => buildDailyReviewSummary(reviewQuestions, data.stats), [reviewQuestions, data.stats]);
  const activeDailySession = getCurrentDailyReviewSession(data, ALL_DAILY_REVIEW_DECK_ID, todayKey);
  const finished = activeDailySession?.items.filter((item) => item.isCorrect !== undefined).length ?? 0;
  const dueDisplay = activeDailySession?.items.length ?? reviewSummary.due;
  const overdueDisplay = activeDailySession?.items.filter((item) => item.overdueDays > 0).length ?? reviewSummary.overdue;
  const deckByQuestionId = useMemo(() => new Map(data.decks.filter((deck) => !isHardQuestionDeck(deck)).flatMap((deck) => deck.questionIds.map((questionId) => [questionId, deck] as const))), [data.decks]);
  const deckReviewSummaries = useMemo(() => data.decks.filter((deck) => !isHardQuestionDeck(deck)).map((deck) => {
    const questions = getDeckQuestions(data.questions, deck);
    const reviewQuestions = questions.filter((question) => !slashedQuestionSet.has(question.id));
    const reviewSummary = buildDailyReviewSummary(reviewQuestions, data.stats);
    return { deck, reviewSummary };
  }), [data, slashedQuestionSet]);
  const topDueDecks = activeDailySession ? [...activeDailySession.items.reduce((map, item) => {
      const deck = deckByQuestionId.get(item.questionId);
      if (!deck) return map;
      const current = map.get(deck.id) ?? { id: deck.id, name: deck.name, count: 0, overdue: 0 };
      current.count += 1;
      if (item.overdueDays > 0) current.overdue += 1;
      map.set(deck.id, current);
      return map;
    }, new Map<string, { id: string; name: string; count: number; overdue: number }>()).values()].sort((a, b) => b.count - a.count || b.overdue - a.overdue).slice(0, 3)
    : deckReviewSummaries.filter((item) => item.reviewSummary.totalDue > 0).sort((a, b) => b.reviewSummary.totalDue - a.reviewSummary.totalDue || b.reviewSummary.totalOverdue - a.reviewSummary.totalOverdue).slice(0, 3).map((item) => ({ id: item.deck.id, name: item.deck.name, count: item.reviewSummary.totalDue, overdue: item.reviewSummary.totalOverdue }));
  const canStartReview = Boolean(activeDailySession) || reviewSummary.due > 0;
  const reviewDayActivity = useMemo(() => buildReviewDayActivitySummary(data.stats, todayKey), [data.stats, todayKey]);
  const completion = data.dailyReviewCompletion;
  const hasCompletionRecord = completion?.date === todayKey && completion.deckId === ALL_DAILY_REVIEW_DECK_ID;
  const hasInferredCompletion = reviewSummary.due === 0 && reviewDayActivity.answered > 0;
  const isReviewCompleteToday = !activeDailySession && reviewSummary.due === 0 && (hasCompletionRecord || hasInferredCompletion);

  if (isReviewCompleteToday) {
    return (
      <section className="home-task-panel daily-review-complete-panel">
        <div className="daily-review-complete-hero">
          <div className="daily-review-complete-orb" aria-hidden="true">
            <CheckCircle2 size={48} strokeWidth={2.5} />
            <span>DONE</span>
          </div>
          <div className="daily-review-complete-copy">
            <h3>复习完成！您是当之无愧的塔里木刷题王！</h3>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="home-task-panel">
      <div className="section-title">
        <div>
          <h2>每日复习</h2>
        </div>
        <strong>{todayKey}</strong>
      </div>
      <div className="task-metric-grid">
        <div>
          <span>今日应复习</span>
          <strong>{dueDisplay}</strong>
        </div>
        <div>
          <span>逾期顺延</span>
          <strong>{overdueDisplay}</strong>
        </div>
        <div>
          <span>已学习</span>
          <strong>{reviewSummary.learned}</strong>
        </div>
        <div>
          <span>今日进度</span>
          <strong>{activeDailySession ? `${finished}/${activeDailySession.items.length}` : `0/${dueDisplay}`}</strong>
        </div>
      </div>
      <div className="daily-review-home-copy">
        <CalendarCheck size={18} />
        <span>
          全题库统一生成每日复习队列；每天最多 {DAILY_REVIEW_LIMIT} 道。超过上限时，会按逾期天数、错误次数、连对情况和久未复习程度，选出最需要复习的 {DAILY_REVIEW_LIMIT} 道。
        </span>
      </div>
      {topDueDecks.length > 0 && (
        <div className="daily-review-breakdown" aria-label="到期题库预览">
          {topDueDecks.map((item) => (
            <span key={item.id}>{item.name}：{item.count} 道</span>
          ))}
        </div>
      )}
      <div className="task-action-grid daily-review-action-grid">
        <button className="primary-button" type="button" disabled={!canStartReview} onClick={startAllDailyReview}>
          <CalendarCheck size={18} />
          {activeDailySession ? "继续全题库每日复习" : "开始全题库每日复习"}
        </button>
      </div>
    </section>
  );
}

function HomeStudyStats({ dailyStats }: { dailyStats: Record<string, DailyStudyStat> }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const year = new Date().getFullYear();
  const heatmap = buildStudyHeatmap(dailyStats, year);
  const yearlyAnswered = heatmap.days.reduce((sum, day) => sum + day.stat.answered, 0);
  useLayoutEffect(() => {
    const timer = window.setTimeout(() => {
      const scroller = scrollRef.current;
      const today = scroller?.querySelector<HTMLElement>(".activity-cell.today");
      if (!scroller || !today) return;
      const targetLeft = today.offsetLeft - Math.max(0, (scroller.clientWidth - today.offsetWidth) / 2);
      scroller.scrollLeft = Math.max(0, targetLeft);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [year, heatmap.weekCount]);

  return (
    <section className="study-calendar-panel">
      <div className="heatmap-head">
        <span>年度刷题热力图</span>
        <em>今年累计 {yearlyAnswered.toLocaleString("zh-CN")} 题</em>
      </div>
      <div className="activity-calendar" aria-label={`${year} 年每日刷题量`}>
        <div className="weekday-labels" aria-hidden="true">
          {WEEKDAY_LABELS.map((label) => <span key={label}>{label}</span>)}
        </div>
        <div className="activity-scroll" ref={scrollRef}>
          <div className="activity-grid" style={{ gridTemplateColumns: `repeat(${heatmap.weekCount}, 13px)` }}>
            {heatmap.days.map((day) => (
              <button
                key={day.date}
                type="button"
                className={`activity-cell level-${day.level}${day.isToday ? " today" : ""}`}
                style={{ gridColumn: day.weekIndex + 1, gridRow: day.weekday + 1 }}
                title={`${formatStudyDate(day.date)}：刷题 ${day.stat.answered}，正确 ${day.stat.correct}，错误 ${day.stat.wrong}`}
                aria-label={`${formatStudyDate(day.date)}刷题 ${day.stat.answered} 题`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FavoriteQuestionsPage({
  questions,
  scopeLabel,
  stats,
  favoriteQuestionSet,
  slashedQuestionSet,
  openQuestion,
  editQuestion,
  toggleFavoriteQuestion,
  favoritePractice,
  startFavoritePractice
}: {
  questions: Question[];
  scopeLabel: string;
  stats: Record<string, QuestionStat>;
  favoriteQuestionSet: Set<string>;
  slashedQuestionSet: Set<string>;
  openQuestion: (questionId: string) => void;
  editQuestion: (questionId: string) => void;
  toggleFavoriteQuestion: (questionId: string) => void;
  favoritePractice?: PracticeState;
  startFavoritePractice?: () => void;
}) {
  const completedCount = Object.keys(favoritePractice?.results ?? {}).length;
  return (
    <section className="page">
      <Header title="收藏题目" subtitle={`${scopeLabel} · ${questions.length} 道`} />
      <FeatureGuide title="收藏有什么用">
        收藏是你主动保存的题目清单，适合标记重要题、易混题或稍后再看的题；可直接刷当前范围内的收藏题，位置和答题结果会自动保存。取消收藏不会删除原有答题记录。
      </FeatureGuide>
      {startFavoritePractice && (
        <div className="toolbar favorite-practice-toolbar">
          <span className="panel-copy">
            {favoritePractice && !favoritePractice.submittedAt
              ? `收藏刷题进度：${completedCount} / ${questions.length} 已判定，进入后从上次位置继续。`
              : `全量刷当前范围内的 ${questions.length} 道收藏题，答题进度会自动保存。`}
          </span>
          <button className="primary-button" onClick={startFavoritePractice} disabled={questions.length === 0}>
            <Play size={18} />
            {favoritePractice && !favoritePractice.submittedAt ? "继续刷收藏题" : "开始刷收藏题"}
          </button>
        </div>
      )}
      <FavoriteQuestionsPanel
        questions={questions}
        stats={stats}
        favoriteQuestionSet={favoriteQuestionSet}
        slashedQuestionSet={slashedQuestionSet}
        openQuestion={openQuestion}
        editQuestion={editQuestion}
        toggleFavoriteQuestion={toggleFavoriteQuestion}
      />
    </section>
  );
}

function SlashedQuestionsPage({
  questions,
  scopeLabel,
  stats,
  slashedQuestionSet,
  openQuestion,
  editQuestion,
  toggleSlashedQuestion
}: {
  questions: Question[];
  scopeLabel: string;
  stats: Record<string, QuestionStat>;
  slashedQuestionSet: Set<string>;
  openQuestion: (questionId: string) => void;
  editQuestion: (questionId: string) => void;
  toggleSlashedQuestion: (questionId: string) => void;
}) {
  return (
    <section className="page">
      <Header title="已斩题目" subtitle={`${scopeLabel} · ${questions.length} 道`} />
      <FeatureGuide title="已斩代表什么">
        已斩题按“已经掌握”处理：不再进入每日复习和新建的顺序刷题，并会计入顺序刷题的“已作答”数量。连续答对 5 次会自动斩题，也可手动斩题或在此恢复。
      </FeatureGuide>
      <SlashedQuestionsPanel
        questions={questions}
        stats={stats}
        slashedQuestionSet={slashedQuestionSet}
        openQuestion={openQuestion}
        editQuestion={editQuestion}
        toggleSlashedQuestion={toggleSlashedQuestion}
      />
    </section>
  );
}

function DailyMistakeSummaryPage({
  summary,
  todayKey,
  todayWrongQuestions,
  summaryQuestions,
  generateSummary,
  exportSummaryPdf,
  openQuestion,
  editQuestion
}: {
  summary: DailyMistakeSummary | null;
  todayKey: string;
  todayWrongQuestions: Question[];
  summaryQuestions: Question[];
  generateSummary: () => void;
  exportSummaryPdf: () => void;
  openQuestion: (questionId: string) => void;
  editQuestion: (questionId: string) => void;
}) {
  const hasSummary = Boolean(summary && summary.date === todayKey);
  const generatedAtText = summary?.generatedAt
    ? new Date(summary.generatedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <section className="page daily-summary-page">
      <div className="daily-summary-print-area">
        <Header title="今日刷题总结" subtitle="" />
        <FeatureGuide title="今日总结有什么用" className="no-print">
          汇总本学习日内答错过的题，方便当天集中回顾；继续刷题后可重新生成。它是当天快照，不会替代长期错题库，也不会改变题目状态。
        </FeatureGuide>
        <section className="daily-summary-notice">
          <AlertTriangle size={18} />
          <p>今日总结会保留到次日凌晨 4 点，并在 4 点后自动删除。需要长期保存请及时导出并保存 PDF。</p>
        </section>
        <section className="daily-summary-toolbar no-print">
          <div>
            <strong>{hasSummary ? "已生成今日错题总结" : "尚未生成今日总结"}</strong>
            <span>
              {hasSummary
                ? `本次总结 ${summaryQuestions.length} 道，生成时间 ${generatedAtText}`
                : `当前可总结今日错题 ${todayWrongQuestions.length} 道`}
            </span>
          </div>
          <div className="daily-summary-actions">
            <button className="primary-button" type="button" onClick={generateSummary}>
              <NotebookPen size={18} />
              {hasSummary ? "重新生成" : "生成今日总结"}
            </button>
            <button className="secondary-button" type="button" onClick={exportSummaryPdf} disabled={!hasSummary}>
              <Download size={18} />
              导出并保存 PDF
            </button>
          </div>
        </section>
        {!hasSummary ? (
          <section className="setup-panel daily-summary-empty-panel">
            <div className="section-title">
              <h2>生成前说明</h2>
              <NotebookPen size={18} />
            </div>
            <p className="panel-copy">点击“生成今日总结”后，会抓取今天答错过的题目，整理成适合复习和打印的错题摘要。</p>
            <p className="panel-copy">如果今天后面继续刷题并出现新错题，可以回到这里重新生成。</p>
          </section>
        ) : (
          <section className="daily-summary-doc">
            <div className="daily-summary-cover">
              <h2>{formatStudyDate(todayKey)} 错题总结</h2>
              <p>共 {summaryQuestions.length} 道 · 生成时间 {generatedAtText}</p>
            </div>
            {summaryQuestions.length > 0 ? (
              <div className="daily-summary-text-list">
                {summaryQuestions.map((question, index) => (
                  <DailySummaryQuestionCard
                    key={question.id}
                    question={question}
                    index={index}
                    openQuestion={openQuestion}
                    editQuestion={editQuestion}
                  />
                ))}
              </div>
            ) : (
              <p className="empty-text">今天还没有错题，漂亮。</p>
            )}
          </section>
        )}
      </div>
    </section>
  );
}

function DailySummaryQuestionCard({
  question,
  index,
  openQuestion,
  editQuestion
}: {
  question: Question;
  index: number;
  openQuestion: (questionId: string) => void;
  editQuestion: (questionId: string) => void;
}) {
  const answerText = buildQuestionAnswerSummary(question);
  const wrongOptionText = buildQuestionWrongOptionSummary(question);

  return (
    <article className="daily-summary-text-item">
      <p>
        <span className="daily-summary-index">{index + 1}.</span>
        <RichText text={question.stemText} />
        <span className="daily-summary-inline-answer">
          答案：<mark><RichText text={answerText} /></mark>
        </span>
        {wrongOptionText && (
          <span className="daily-summary-inline-answer daily-summary-inline-wrong-answer">
            错项：<mark><RichText text={wrongOptionText} /></mark>
          </span>
        )}
      </p>
      <div className="daily-summary-card-actions no-print">
        <button className="secondary-button small-button" type="button" onClick={() => openQuestion(question.id)}>查看题目</button>
        <button className="secondary-button small-button" type="button" onClick={() => editQuestion(question.id)}>编辑</button>
      </div>
    </article>
  );
}

function buildQuestionAnswerSummary(question: Question) {
  const correctOptions = question.options.filter((option) => question.answerKeys.includes(option.key));
  if (correctOptions.length > 0) {
    return correctOptions.map((option) => stripLeadingOptionLabel(option.text)).join("；");
  }

  const answerKeysText = question.answerKeys.join("");
  const extraAnswerText = question.answerText.trim();
  if (extraAnswerText && normalizeSearchText(extraAnswerText) !== normalizeSearchText(answerKeysText)) {
    return stripLeadingOptionLabel(extraAnswerText);
  }

  return answerKeysText || "见解析";
}

function buildQuestionWrongOptionSummary(question: Question) {
  if (question.type !== "多选题" || question.answerKeys.length === 0) return "";
  const answerKeys = new Set(question.answerKeys);
  return question.options
    .filter((option) => !answerKeys.has(option.key))
    .map((option) => stripLeadingOptionLabel(option.text))
    .join("；");
}

function stripLeadingOptionLabel(value: string) {
  return value.trim().replace(/^[A-Z][.．、\s]+/i, "");
}

function FavoriteQuestionsPanel({
  questions,
  stats,
  favoriteQuestionSet,
  slashedQuestionSet,
  openQuestion,
  editQuestion,
  toggleFavoriteQuestion
}: {
  questions: Question[];
  stats: Record<string, QuestionStat>;
  favoriteQuestionSet: Set<string>;
  slashedQuestionSet: Set<string>;
  openQuestion: (questionId: string) => void;
  editQuestion: (questionId: string) => void;
  toggleFavoriteQuestion: (questionId: string) => void;
}) {
  return (
    <section className="favorite-panel">
      <div className="section-title">
        <div>
          <h2>收藏题目</h2>
        </div>
        <Star size={18} />
      </div>
      {questions.length > 0 ? (
        <div className="question-list favorite-question-list">
          {questions.map((question) => (
            <QuestionRow
              key={question.id}
              question={question}
              stat={stats[question.id]}
              statLabel=""
              onOpen={() => openQuestion(question.id)}
              onEdit={() => editQuestion(question.id)}
              isFavorite={favoriteQuestionSet.has(question.id)}
              isSlashed={slashedQuestionSet.has(question.id)}
              onFavorite={() => toggleFavoriteQuestion(question.id)}
            />
          ))}
        </div>
      ) : (
        <p className="empty-text">{IS_ANDROID_USER_AGENT ? "暂无收藏题。答题时点击题目卡右上角星标收藏。" : `暂无收藏题。答题时按 ${SHORTCUT_MODIFIER_LABEL}+1，或点击题目卡右上角星标收藏。`}</p>
      )}
    </section>
  );
}

function SlashedQuestionsPanel({
  questions,
  stats,
  slashedQuestionSet,
  openQuestion,
  editQuestion,
  toggleSlashedQuestion
}: {
  questions: Question[];
  stats: Record<string, QuestionStat>;
  slashedQuestionSet: Set<string>;
  openQuestion: (questionId: string) => void;
  editQuestion: (questionId: string) => void;
  toggleSlashedQuestion: (questionId: string) => void;
}) {
  return (
    <section className="slashed-panel">
      <div className="section-title">
        <div>
          <h2>已斩题目</h2>
        </div>
        <Sword size={18} />
      </div>
      {questions.length > 0 ? (
        <div className="question-list slashed-question-list">
          {questions.map((question) => (
            <QuestionRow
              key={question.id}
              question={question}
              stat={stats[question.id]}
              statLabel=""
              onOpen={() => openQuestion(question.id)}
              onEdit={() => editQuestion(question.id)}
              isSlashed={slashedQuestionSet.has(question.id)}
              onSlash={() => toggleSlashedQuestion(question.id)}
            />
          ))}
        </div>
      ) : (
        <p className="empty-text">{IS_ANDROID_USER_AGENT ? "暂无已斩题。答题时点击题目卡右上角小刀标记。" : `暂无已斩题。答题时按 ${SHORTCUT_MODIFIER_LABEL}+4，或点击题目卡右上角小刀标记。`}</p>
      )}
    </section>
  );
}

function DeckCard({
  deck,
  data,
  slashedQuestionSet,
  openDeck,
  resetDeckProgress,
  deleteDeck,
  removeDeckFromStudyPlan
}: {
  deck: Deck;
  data: AppData;
  slashedQuestionSet: Set<string>;
  openDeck: (deckId: string) => void;
  resetDeckProgress: (deckId: string) => void;
  deleteDeck: (deckId: string) => void;
  removeDeckFromStudyPlan: (deckId: string) => void;
}) {
  const questions = getDeckQuestions(data.questions, deck);
  const isHardDeck = isHardQuestionDeck(deck);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function closeOnPointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  if (isHardDeck) {
    return (
      <article className="deck-card hard-deck-card">
        <div className="hard-deck-label">
          <AlertTriangle size={16} />
          <span>特殊题库</span>
        </div>
        <div>
          <h2>{deck.name}</h2>
          <p className="hard-deck-copy">错误率过半的题目会收录至此</p>
        </div>
        <div className="hard-deck-stats">
          <strong>{questions.length}</strong>
          <span>道重难题</span>
        </div>
        <button className="primary-button wide hard-deck-action" onClick={() => openDeck(deck.id)} disabled={questions.length === 0}>
          <CheckCircle2 size={18} />
          顺序刷题
        </button>
      </article>
    );
  }

  const reviewQuestions = questions.filter((question) => !slashedQuestionSet.has(question.id));
  const counts = countByType(questions);
  const summary = buildStatSummary(data, questions);
  const reviewSummary = buildDailyReviewSummary(reviewQuestions, data.stats);
  const masteredCount = countProficiency(questions, data.stats, slashedQuestionSet)["已熟练"];
  const masteredRate = formatPercent(masteredCount, questions.length);
  const masteredPercent = questions.length > 0 ? Math.round((masteredCount / questions.length) * 100) : 0;
  const masteryStatus = getDeckMasteryStatus(masteredPercent);

  return (
    <article className="deck-card">
      <div className="deck-card-head">
        <h2>{deck.name}</h2>
        <div className="deck-card-menu" ref={menuRef}>
          <button
            className="deck-card-menu-button"
            type="button"
            aria-label={`${deck.name} 更多操作`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MoreHorizontal size={21} strokeWidth={2.4} />
          </button>
          {menuOpen && (
            <div className="deck-card-menu-popover" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  resetDeckProgress(deck.id);
                }}
              >
                <RotateCcw size={16} />
                重置该题库进度
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  removeDeckFromStudyPlan(deck.id);
                }}
              >
                <XCircle size={16} />
                移除学习计划
              </button>
              <button
                className="danger"
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  deleteDeck(deck.id);
                }}
              >
                <Trash2 size={16} />
                删除该题库
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="deck-stat-grid">
        <span>{questions.length} 题</span>
        <span>判断 {counts["判断题"]}</span>
        <span>单选 {counts["单选题"]}</span>
        <span>多选 {counts["多选题"]}</span>
        <span className="accent-stat">正确率 {summary.rate}%</span>
        <span>今日复习 {reviewSummary.due}</span>
      </div>
      <div
        className="deck-mastery-module"
        title={`已熟练占比 ${masteredRate}`}
        style={{ background: buildMasteryModuleBackground(masteredPercent) }}
      >
        <strong>已熟练 {masteredCount} / {questions.length}</strong>
        <span>掌握进度 {masteredPercent}%</span>
        <em>{masteryStatus}</em>
      </div>
      <button className="primary-button wide" onClick={() => openDeck(deck.id)}>进入题库</button>
    </article>
  );
}

function buildMasteryModuleBackground(percent: number) {
  const boundedPercent = Math.max(0, Math.min(100, percent));
  const stageColor = getDeckMasteryStageColor(boundedPercent);
  return `linear-gradient(90deg, ${stageColor} 0%, ${stageColor} ${boundedPercent}%, rgba(255, 253, 248, 0.94) ${boundedPercent}%, rgba(255, 253, 248, 0.94) 100%)`;
}

function getDeckMasteryStageColor(percent: number) {
  if (percent >= 95) return "#2F7D4F";
  if (percent >= 80) return "#4F9462";
  if (percent >= 55) return "#7FAE6B";
  if (percent >= 25) return "#D6A73E";
  if (percent > 0) return "#E8B45A";
  return "#F3E8D2";
}

function getDeckMasteryStatus(percent: number) {
  if (percent >= 95) return "几近通关";
  if (percent >= 80) return "基本掌握";
  if (percent >= 55) return "进度良好";
  if (percent >= 25) return "稳步推进";
  if (percent > 0) return "刚刚起步";
  return "尚未开始";
}

function Dashboard({
  deck,
  questions,
  slashedQuestionSet,
  data,
  typeCounts,
  statSummary,
  config,
  setConfig,
  startExam,
  activeSession,
  resumeExam,
  startPractice,
  practice,
  mistakeCount,
  reviewSummary,
  startDailyReview,
  practiceShuffleOptions,
  setPracticeShuffleOptions,
  practiceShuffleQuestions,
  setPracticeShuffleQuestions,
  practiceAutoAdvanceCorrect,
  setPracticeAutoAdvanceCorrect
}: {
  deck: Deck | null;
  questions: Question[];
  slashedQuestionSet: Set<string>;
  data: AppData;
  typeCounts: Record<QuestionType, number>;
  statSummary: ReturnType<typeof buildStatSummary>;
  config: ExamConfig;
  setConfig: (config: ExamConfig) => void;
  startExam: () => void;
  activeSession: ExamSession | null;
  resumeExam: (session?: ExamSession | null) => void;
  startPractice: (reset?: boolean, shuffleOptions?: boolean, shuffleQuestions?: boolean) => void;
  practice?: PracticeState;
  mistakeCount: number;
  reviewSummary: DailyReviewSummary;
  startDailyReview: () => void;
  practiceShuffleOptions: boolean;
  setPracticeShuffleOptions: (value: boolean) => void;
  practiceShuffleQuestions: boolean;
  setPracticeShuffleQuestions: (value: boolean) => void;
  practiceAutoAdvanceCorrect: boolean;
  setPracticeAutoAdvanceCorrect: (value: boolean) => void;
}) {
  const practiceAnswered = practice ? Object.keys(practice.answers).length : 0;
  const practiceTotal = practice?.questionIds.length ?? questions.length;
  const practiceSlashedCount = practice
    ? practice.questionIds.filter((questionId) => slashedQuestionSet.has(questionId) && Boolean(practice.answers[questionId]?.length)).length
    : 0;
  const practiceText = practice?.submittedAt
    ? `上次交卷 ${practice.score ?? 0}%`
    : practice
      ? `${practiceAnswered} / ${practiceTotal} 已作答`
      : "尚未开始";
  const activeExamAnswered = activeSession?.items.filter((item) => item.selectedKeys.length > 0).length ?? 0;

  return (
    <section className="page deck-dashboard-page">
      <Header title="工作台" subtitle={deck?.name ?? "未选择题库"} />
      <div className="metric-grid">
        <Metric label="客观题" value={questions.length} detail={`判断 ${typeCounts["判断题"]} / 单选 ${typeCounts["单选题"]} / 多选 ${typeCounts["多选题"]}`} />
        <Metric label="今日复习" value={reviewSummary.due} detail={`${reviewSummary.overdue} 道逾期 / ${reviewSummary.learned} 道已学习`} />
        <Metric label="正确率" value={`${statSummary.rate}%`} detail={`${statSummary.correct} 对 / ${statSummary.wrong} 错`} />
        <Metric label="错题数" value={mistakeCount} detail="错题优先会提高抽中概率" />
      </div>
      <div className="two-column">
        <section className="setup-panel compact">
          <div className="section-title">
            <h2>每日复习</h2>
            <CalendarCheck size={18} />
          </div>
          <p className="panel-copy">{reviewSummary.due > 0 ? `${reviewSummary.due} 道到期，${reviewSummary.overdue} 道已逾期` : "今日暂无到期题"}</p>
          <div className="button-row">
            <button className="primary-button" onClick={startDailyReview} disabled={reviewSummary.due === 0}>
              开始复习
            </button>
          </div>
        </section>
        <section className="setup-panel compact">
          <div className="section-title">
            <h2>顺序刷题</h2>
            <CheckCircle2 size={18} />
          </div>
          <p className="panel-copy">{practiceText}</p>
          {practiceSlashedCount > 0 && (
            <p className="practice-count-note">其中 {practiceSlashedCount} 道为已斩题。</p>
          )}
          <div className="practice-option-grid">
            <label className="compact-check">
              <input type="checkbox" checked={practiceShuffleOptions} onChange={(event) => setPracticeShuffleOptions(event.target.checked)} />
              选项乱序
            </label>
            <label className="compact-check">
              <input type="checkbox" checked={practiceShuffleQuestions} onChange={(event) => setPracticeShuffleQuestions(event.target.checked)} />
              题目乱序
            </label>
            <label className="compact-check">
              <input type="checkbox" checked={practiceAutoAdvanceCorrect} onChange={(event) => setPracticeAutoAdvanceCorrect(event.target.checked)} />
              答对后自动进入下一题
            </label>
          </div>
          <div className="button-row">
            <button className="primary-button" onClick={() => startPractice(false, practiceShuffleOptions, practiceShuffleQuestions)}>
              继续刷题
            </button>
            <button className="secondary-button" onClick={() => startPractice(true, practiceShuffleOptions, practiceShuffleQuestions)}>
              重新开始
            </button>
          </div>
        </section>
      </div>
      <RecentSessions sessions={deck ? data.sessions.filter((session) => session.deckId === deck.id) : []} />
      {activeSession && (
        <section className="setup-panel compact">
          <div className="section-title">
            <h2>未交卷考试</h2>
            <Play size={18} />
          </div>
          <p className="panel-copy">已作答 {activeExamAnswered} / {activeSession.items.length} 题，当前考试已暂存。</p>
          <button className="primary-button wide" onClick={() => resumeExam(activeSession)}>
            继续考试
          </button>
        </section>
      )}
      <ExamSetup config={config} setConfig={setConfig} startExam={startExam} compact />
    </section>
  );
}

function ExamView({
  activeSession,
  config,
  setConfig,
  startExam,
  currentIndex,
  setCurrentIndex,
  questionById,
  stats,
  toggleOption,
  confirmExamQuestion,
  submitExam,
  leaveExam,
  notes,
  updateQuestionNote,
  editQuestion,
  favoriteQuestionSet,
  toggleFavoriteQuestion,
  slashedQuestionSet,
  toggleSlashedQuestion,
  hardQuestionSet,
  toggleHardQuestion,
  progressCollapsed,
  setProgressCollapsed,
  showSidebarToggle,
  openSidebar
}: {
  activeSession: ExamSession | null;
  config: ExamConfig;
  setConfig: (config: ExamConfig) => void;
  startExam: () => void;
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  questionById: Map<string, Question>;
  stats: Record<string, QuestionStat>;
  toggleOption: (key: string) => void;
  confirmExamQuestion: () => void;
  submitExam: () => void;
  leaveExam: () => void;
  notes: Record<string, string>;
  updateQuestionNote: (questionId: string, note: string) => void;
  editQuestion: (questionId: string) => void;
  favoriteQuestionSet: Set<string>;
  toggleFavoriteQuestion: (questionId: string) => void;
  slashedQuestionSet: Set<string>;
  toggleSlashedQuestion: (questionId: string) => void;
  hardQuestionSet: Set<string>;
  toggleHardQuestion: (questionId: string) => void;
  progressCollapsed: boolean;
  setProgressCollapsed: (value: boolean) => void;
  showSidebarToggle: boolean;
  openSidebar: () => void;
}) {
  if (!activeSession) {
    return (
      <section className="page">
        <Header title="模拟考试" subtitle="按题型组卷" />
        <ExamSetup config={config} setConfig={setConfig} startExam={startExam} />
      </section>
    );
  }

  const item = activeSession.items[currentIndex];
  const question = questionById.get(item.questionId);
  if (!question) return null;
  const orderedOptions = getOrderedOptions(question, item);
  const proficiency = getProficiency(stats[question.id], slashedQuestionSet.has(question.id));
  const submitted = Boolean(activeSession.submittedAt);
  const reveal = submitted;
  const canConfirm = false;
  const correctDisplay = orderedOptions
    .map((option, index) => (question.answerKeys.includes(option.key) ? optionDisplayKey(index) : ""))
    .filter(Boolean)
    .join("");
  const selectedDisplay = orderedOptions
    .map((option, index) => (item.selectedKeys.includes(option.key) ? optionDisplayKey(index) : ""))
    .filter(Boolean)
    .join("") || "未作答";

  return (
    <section className={progressCollapsed ? "exam-layout progress-collapsed" : "exam-layout"}>
      <div className="exam-main">
        {showSidebarToggle && <AnswerNavToggle openSidebar={openSidebar} />}
        <div className="exam-topbar">
          <div>
            <span className="eyebrow">{question.uid}</span>
            <h1>{question.type}</h1>
            <ProficiencyBadge level={proficiency} />
          </div>
          <div className="exam-meta">
            <span className="question-index-pill">{currentIndex + 1} / {activeSession.items.length}</span>
            <AnswerProgressToggle collapsed={progressCollapsed} setCollapsed={setProgressCollapsed} />
          </div>
        </div>
        <AndroidQuestionSwipeStage previous={currentIndex > 0 ? questionById.get(activeSession.items[currentIndex - 1].questionId) : null} next={currentIndex < activeSession.items.length - 1 ? questionById.get(activeSession.items[currentIndex + 1].questionId) : null} favoriteQuestionSet={favoriteQuestionSet} slashedQuestionSet={slashedQuestionSet} hardQuestionSet={hardQuestionSet} answerItems={activeSession.items} revealAll={submitted} stats={stats} notes={notes}>
        <article key={question.id} className="question-panel">
          <div className="question-panel-tools">
            <span className="type-pill">{question.type}</span>
            <div className="question-panel-actions">
              <FavoriteButton isFavorite={favoriteQuestionSet.has(question.id)} onToggle={() => toggleFavoriteQuestion(question.id)} />
              <SlashedButton isSlashed={slashedQuestionSet.has(question.id)} onToggle={() => toggleSlashedQuestion(question.id)} />
              <HardQuestionButton isHard={hardQuestionSet.has(question.id)} onToggle={() => toggleHardQuestion(question.id)} />
              <button className="mini-edit-button" type="button" onClick={() => editQuestion(question.id)}>
                <Pencil size={16} />
                Edit
              </button>
            </div>
          </div>
          <div className="question-text"><RichText text={question.stemText} /></div>
          <QuestionImages question={question} />
          <div className="option-list">
            {orderedOptions.map((option, index) => {
              const selected = item.selectedKeys.includes(option.key);
              const correct = question.answerKeys.includes(option.key);
              const className = [
                "option-button",
                selected ? "selected" : "",
                reveal && correct ? "correct" : "",
                reveal && selected && !correct ? "wrong" : ""
              ].filter(Boolean).join(" ");
              return (
                <button key={`${question.id}-${option.key}`} className={className} onClick={() => toggleOption(option.key)} disabled={submitted}>
                  <span className="option-key">{optionDisplayKey(index)}</span>
                  <RichText text={option.text} />
                </button>
              );
            })}
          </div>
          {reveal && (
            <div className={item.isCorrect ? "answer-box correct" : "answer-box wrong"}>
              <strong>正确答案：{correctDisplay}</strong>
              <span>你的答案：{selectedDisplay}</span>
              <AnswerAttemptStats
                stat={stats[question.id]}
                pendingResult={undefined}
              />
            </div>
          )}
          {reveal && <QuestionNotePanel questionId={question.id} note={notes[question.id] ?? ""} onChange={updateQuestionNote} />}
        </article>
        </AndroidQuestionSwipeStage>
        <div className="exam-actions">
          <button className="secondary-button" onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0}>
            上一题
          </button>
          {canConfirm ? (
            <button className="primary-button mobile-answer-action" onClick={confirmExamQuestion}>
              确认答案
            </button>
          ) : submitted && IS_WINDOWS ? (
            <button className="primary-button" onClick={leaveExam}>返回上一级</button>
          ) : currentIndex < activeSession.items.length - 1 ? (
            <button className="primary-button" onClick={() => setCurrentIndex(Math.min(activeSession.items.length - 1, currentIndex + 1))}>
              下一题
            </button>
          ) : (
            <button className="primary-button mobile-answer-action" onClick={submitExam} disabled={submitted}>
              交卷
            </button>
          )}
        </div>
      </div>
      {!progressCollapsed && <AnswerProgressDismissLayer onDismiss={() => setProgressCollapsed(true)} />}
      {!progressCollapsed && (
        <aside className="question-nav" onClickCapture={(event) => { if (isAnswerProgressBlankTap(event)) setProgressCollapsed(true); }}>
          <ScrollableQuestionNav
            currentIndex={currentIndex}
            onSelect={(index) => { setCurrentIndex(index); if (document.documentElement.classList.contains("native-android")) setProgressCollapsed(true); }}
            items={activeSession.items.map((navItem, index) => ({
              key: `${navItem.questionId}-${index}`,
              className: [
                "nav-dot",
                index === currentIndex ? "current" : "",
                navItem.selectedKeys.length > 0 ? "answered" : "",
                submitted && navItem.isCorrect === true ? "correct" : "",
                submitted && navItem.isCorrect === false ? "wrong" : ""
              ].filter(Boolean).join(" ")
            }))}
          />
          {submitted && <ResultSummary session={activeSession} questionById={questionById} />}
        </aside>
      )}
    </section>
  );
}

function DailyReviewView({
  deck,
  stats,
  activeReviewSession,
  reviewIndex,
  setReviewIndex,
  questionById,
  toggleDailyReviewOption,
  confirmDailyReviewQuestion,
  finishDailyReview,
  leaveDailyReview,
  notes,
  updateQuestionNote,
  editQuestion,
  favoriteQuestionSet,
  toggleFavoriteQuestion,
  slashedQuestionSet,
  toggleSlashedQuestion,
  hardQuestionSet,
  toggleHardQuestion,
  progressCollapsed,
  setProgressCollapsed,
  showSidebarToggle,
  openSidebar
}: {
  deck: Deck | null;
  stats: Record<string, QuestionStat>;
  activeReviewSession: DailyReviewSession | null;
  reviewIndex: number;
  setReviewIndex: (index: number) => void;
  questionById: Map<string, Question>;
  toggleDailyReviewOption: (key: string) => void;
  confirmDailyReviewQuestion: () => void;
  finishDailyReview: () => void;
  leaveDailyReview: () => void;
  notes: Record<string, string>;
  updateQuestionNote: (questionId: string, note: string) => void;
  editQuestion: (questionId: string) => void;
  favoriteQuestionSet: Set<string>;
  toggleFavoriteQuestion: (questionId: string) => void;
  slashedQuestionSet: Set<string>;
  toggleSlashedQuestion: (questionId: string) => void;
  hardQuestionSet: Set<string>;
  toggleHardQuestion: (questionId: string) => void;
  progressCollapsed: boolean;
  setProgressCollapsed: (value: boolean) => void;
  showSidebarToggle: boolean;
  openSidebar: () => void;
}) {
  if (!deck || !activeReviewSession) return null;

  const currentIndex = Math.max(0, Math.min(reviewIndex, activeReviewSession.items.length - 1));
  const item = activeReviewSession.items[currentIndex];
  const question = questionById.get(item.questionId);
  if (!question) return null;
  const orderedOptions = getOrderedOptions(question, item);
  const proficiency = getProficiency(stats[question.id], slashedQuestionSet.has(question.id));
  const reveal = item.isCorrect !== undefined;
  const canConfirm = question.type === "多选题" && item.selectedKeys.length > 0 && item.isCorrect === undefined;
  const correctDisplay = orderedOptions
    .map((option, index) => (question.answerKeys.includes(option.key) ? optionDisplayKey(index) : ""))
    .filter(Boolean)
    .join("");
  const selectedDisplay = orderedOptions
    .map((option, index) => (item.selectedKeys.includes(option.key) ? optionDisplayKey(index) : ""))
    .filter(Boolean)
    .join("") || "未作答";
  const finishedCount = activeReviewSession.items.filter((reviewItem) => reviewItem.isCorrect !== undefined).length;
  const wrongCount = activeReviewSession.items.filter((reviewItem) => reviewItem.isCorrect === false).length;

  return (
    <section className={progressCollapsed ? "exam-layout progress-collapsed" : "exam-layout"}>
      <div className="exam-main">
        {showSidebarToggle && <AnswerNavToggle openSidebar={openSidebar} />}
        <div className="exam-topbar">
          <div>
            <span className="eyebrow">{deck.name} · {question.uid}</span>
            <h1>每日复习</h1>
            <ProficiencyBadge level={proficiency} />
          </div>
          <div className="exam-meta">
            <span className="question-index-pill">{currentIndex + 1} / {activeReviewSession.items.length}</span>
            <AnswerProgressToggle collapsed={progressCollapsed} setCollapsed={setProgressCollapsed} />
          </div>
        </div>
        <AndroidQuestionSwipeStage previous={currentIndex > 0 ? questionById.get(activeReviewSession.items[currentIndex - 1].questionId) : null} next={currentIndex < activeReviewSession.items.length - 1 ? questionById.get(activeReviewSession.items[currentIndex + 1].questionId) : null} favoriteQuestionSet={favoriteQuestionSet} slashedQuestionSet={slashedQuestionSet} hardQuestionSet={hardQuestionSet} answerItems={activeReviewSession.items} stats={stats} notes={notes}>
        <article key={question.id} className="question-panel">
          <div className="question-panel-tools">
            <span className="type-pill">{question.type}</span>
            <div className="question-panel-actions">
              <FavoriteButton isFavorite={favoriteQuestionSet.has(question.id)} onToggle={() => toggleFavoriteQuestion(question.id)} />
              <SlashedButton isSlashed={slashedQuestionSet.has(question.id)} onToggle={() => toggleSlashedQuestion(question.id)} />
              <HardQuestionButton isHard={hardQuestionSet.has(question.id)} onToggle={() => toggleHardQuestion(question.id)} />
              <button className="mini-edit-button" type="button" onClick={() => editQuestion(question.id)}>
                <Pencil size={16} />
                Edit
              </button>
            </div>
          </div>
          <div className="question-text"><RichText text={question.stemText} /></div>
          <QuestionImages question={question} />
          <div className="option-list">
            {orderedOptions.map((option, index) => {
              const selected = item.selectedKeys.includes(option.key);
              const correct = question.answerKeys.includes(option.key);
              const className = [
                "option-button",
                selected ? "selected" : "",
                reveal && correct ? "correct" : "",
                reveal && selected && !correct ? "wrong" : ""
              ].filter(Boolean).join(" ");
              return (
                <button key={`${question.id}-${option.key}`} className={className} onClick={() => toggleDailyReviewOption(option.key)} disabled={!document.documentElement.classList.contains("native-android") && reveal} aria-disabled={reveal}>
                  <span className="option-key">{optionDisplayKey(index)}</span>
                  <RichText text={option.text} />
                </button>
              );
            })}
          </div>
          {reveal && (
            <div className={item.isCorrect ? "answer-box correct" : "answer-box wrong"}>
              <strong>正确答案：{correctDisplay}</strong>
              <span>你的答案：{selectedDisplay}</span>
              <AnswerAttemptStats stat={stats[question.id]} />
            </div>
          )}
          {reveal && <QuestionNotePanel questionId={question.id} note={notes[question.id] ?? ""} onChange={updateQuestionNote} />}
        </article>
        </AndroidQuestionSwipeStage>
        <div className="exam-actions">
          <button className="secondary-button" onClick={() => setReviewIndex(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0}>
            上一题
          </button>
          {canConfirm ? (
            <button className="primary-button mobile-answer-action" onClick={confirmDailyReviewQuestion}>
              确认答案
            </button>
          ) : currentIndex < activeReviewSession.items.length - 1 ? (
            <button className="primary-button" onClick={() => setReviewIndex(currentIndex + 1)}>
              下一题
            </button>
          ) : (
            <button className="primary-button mobile-answer-action" onClick={finishDailyReview} disabled={!reveal}>
              完成复习
            </button>
          )}
        </div>
      </div>
      {!progressCollapsed && <AnswerProgressDismissLayer onDismiss={() => setProgressCollapsed(true)} />}
      {!progressCollapsed && (
        <aside className="question-nav" onClickCapture={(event) => { if (isAnswerProgressBlankTap(event)) setProgressCollapsed(true); }}>
          <section className="result-panel">
            <h2>复习进度</h2>
            <p>{finishedCount} / {activeReviewSession.items.length} 已判定</p>
            <p>错 {wrongCount} 道</p>
            <button className="secondary-button wide" type="button" onClick={leaveDailyReview}>
              <ArrowLeft size={17} />
              暂存并返回
            </button>
          </section>
          <ScrollableQuestionNav
            currentIndex={currentIndex}
            onSelect={(index) => { setReviewIndex(index); if (document.documentElement.classList.contains("native-android")) setProgressCollapsed(true); }}
            items={activeReviewSession.items.map((navItem, index) => ({
              key: `${navItem.questionId}-${index}`,
              className: [
                "nav-dot",
                index === currentIndex ? "current" : "",
                navItem.selectedKeys.length > 0 ? "answered" : "",
                navItem.isCorrect === true ? "correct" : "",
                navItem.isCorrect === false ? "wrong" : ""
              ].filter(Boolean).join(" ")
            }))}
          />
        </aside>
      )}
    </section>
  );
}

function PracticeView({
  deck,
  practice,
  stats,
  questionById,
  startPractice,
  restartMistakePractice,
  practiceShuffleOptions,
  setPracticeShuffleOptions,
  practiceShuffleQuestions,
  setPracticeShuffleQuestions,
  practiceAutoAdvanceCorrect,
  setPracticeAutoAdvanceCorrect,
  setPracticeIndex,
  setPracticeMode,
  togglePracticeOption,
  confirmPracticeQuestion,
  submitPractice,
  notes,
  updateQuestionNote,
  editQuestion,
  favoriteQuestionSet,
  toggleFavoriteQuestion,
  slashedQuestionSet,
  toggleSlashedQuestion,
  hardQuestionSet,
  toggleHardQuestion,
  allQuestions,
  allDecks,
  openQuestion,
  progressCollapsed,
  setProgressCollapsed,
  showSidebarToggle,
  openSidebar
}: {
  deck: Deck | null;
  practice?: PracticeState;
  stats: Record<string, QuestionStat>;
  questionById: Map<string, Question>;
  startPractice: (reset?: boolean, shuffleOptions?: boolean, shuffleQuestions?: boolean) => void;
  restartMistakePractice: () => void;
  practiceShuffleOptions: boolean;
  setPracticeShuffleOptions: (value: boolean) => void;
  practiceShuffleQuestions: boolean;
  setPracticeShuffleQuestions: (value: boolean) => void;
  practiceAutoAdvanceCorrect: boolean;
  setPracticeAutoAdvanceCorrect: (value: boolean) => void;
  setPracticeIndex: (index: number) => void;
  setPracticeMode: (mode: PracticeMode) => void;
  togglePracticeOption: (key: string) => void;
  confirmPracticeQuestion: () => void;
  submitPractice: () => void;
  notes: Record<string, string>;
  updateQuestionNote: (questionId: string, note: string) => void;
  editQuestion: (questionId: string) => void;
  favoriteQuestionSet: Set<string>;
  toggleFavoriteQuestion: (questionId: string) => void;
  slashedQuestionSet: Set<string>;
  toggleSlashedQuestion: (questionId: string) => void;
  hardQuestionSet: Set<string>;
  toggleHardQuestion: (questionId: string) => void;
  allQuestions: Question[];
  allDecks: Deck[];
  openQuestion: (questionId: string) => void;
  progressCollapsed: boolean;
  setProgressCollapsed: (value: boolean) => void;
  showSidebarToggle: boolean;
  openSidebar: () => void;
}) {
  if (!deck) {
    return (
      <section className="page">
        <Header title="顺序刷题" subtitle="未选择题库" />
      </section>
    );
  }

  const isHardDeck = isHardQuestionDeck(deck);
  const isFavoritePractice = practice?.scope === "favorites";
  const isMistakePractice = practice?.scope === "mistakes";
  const practiceTitle = isFavoritePractice ? "收藏刷题" : isMistakePractice ? "错题刷题" : "顺序刷题";

  if (!practice) {
    return (
      <section className="page">
        <Header title={isHardDeck ? "重难题顺序刷题" : "顺序刷题"} subtitle={deck.name} />
        <section className={isHardDeck ? "setup-panel hard-practice-setup" : "setup-panel"}>
          <div className="section-title">
            <h2>{isHardDeck ? "只刷重难题" : "全量顺序刷题"}</h2>
            {isHardDeck ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          </div>
          {isHardDeck ? (
            <>
              <FeatureGuide title="重难题是什么">
                正确率低于 50% 且至少作答 2 次的题会自动进入，也可手动加入；正确率恢复到 50% 且连续答对 2 次后自动移出。重难题不能斩题。
              </FeatureGuide>
              <label className="compact-check">
                <input type="checkbox" checked={practiceAutoAdvanceCorrect} onChange={(event) => setPracticeAutoAdvanceCorrect(event.target.checked)} />
                答对后自动进入下一题
              </label>
            </>
          ) : (
            <div className="practice-option-grid">
              <label className="compact-check">
                <input type="checkbox" checked={practiceShuffleOptions} onChange={(event) => setPracticeShuffleOptions(event.target.checked)} />
                选项乱序
              </label>
              <label className="compact-check">
                <input type="checkbox" checked={practiceShuffleQuestions} onChange={(event) => setPracticeShuffleQuestions(event.target.checked)} />
                题目乱序
              </label>
              <label className="compact-check">
                <input type="checkbox" checked={practiceAutoAdvanceCorrect} onChange={(event) => setPracticeAutoAdvanceCorrect(event.target.checked)} />
                答对后自动进入下一题
              </label>
            </div>
          )}
          <button className="primary-button wide" onClick={() => startPractice(false, isHardDeck ? false : practiceShuffleOptions, isHardDeck ? false : practiceShuffleQuestions)}>开始刷题</button>
        </section>
      </section>
    );
  }

  if (practice.questionIds.length === 0) {
    return (
      <section className="page">
        <Header title={practiceTitle} subtitle={deck.name} />
        <section className="setup-panel">
          <p className="panel-copy">本题库已没有可继续刷的题，{practiceTitle}进度已同步清空。</p>
        </section>
      </section>
    );
  }

  const mode = isHardDeck || isMistakePractice ? "answer" : getPracticeMode(practice);
  const isReviewMode = mode === "review";
  const currentIndex = getPracticeActiveIndex(practice);
  const questionId = practice.questionIds[currentIndex];
  const question = questionById.get(questionId);
  if (!question) {
    return (
      <section className="page">
        <Header title={practiceTitle} subtitle={deck.name} />
        <section className="setup-panel">
          <p className="panel-copy">题库已更新，请重新开始{practiceTitle}。</p>
          {!isHardDeck && !isMistakePractice && (
            <>
              <label className="compact-check">
                <input type="checkbox" checked={practiceShuffleOptions} onChange={(event) => setPracticeShuffleOptions(event.target.checked)} />
                选项乱序
              </label>
              <label className="compact-check">
                <input type="checkbox" checked={practiceShuffleQuestions} onChange={(event) => setPracticeShuffleQuestions(event.target.checked)} />
                题目乱序
              </label>
            </>
          )}
          <button className="primary-button" onClick={() => isMistakePractice ? restartMistakePractice() : startPractice(true, isHardDeck ? false : practiceShuffleOptions, isHardDeck ? false : practiceShuffleQuestions)}>重新开始</button>
        </section>
      </section>
    );
  }

  const selectedKeys = practice.answers[questionId] ?? [];
  const proficiency = getProficiency(stats[question.id], slashedQuestionSet.has(question.id));
  const submitted = Boolean(practice.submittedAt);
  const isFinalized = (practice.results ?? {})[questionId] !== undefined;
  const reveal = isReviewMode || submitted || isFinalized;
  const canConfirm = !isReviewMode && !submitted && !isFinalized && selectedKeys.length > 0;
  const orderedOptions = getPracticeOrderedOptions(question, practice);
  const correctDisplay = orderedOptions
    .map((option, index) => (question.answerKeys.includes(option.key) ? optionDisplayKey(index) : ""))
    .filter(Boolean)
    .join("");
  const selectedDisplay = orderedOptions
    .map((option, index) => (selectedKeys.includes(option.key) ? optionDisplayKey(index) : ""))
    .filter(Boolean)
    .join("") || "未作答";
  const answeredCount = Object.keys(practice.answers).filter((id) => (practice.answers[id] ?? []).length > 0).length;
  const finalizedCount = Object.keys(practice.results ?? {}).length;
  const slashedAnsweredCount = practice.questionIds.filter((id) => slashedQuestionSet.has(id) && Boolean(practice.answers[id]?.length)).length;
  const reviewProgress = getPracticeReviewProgress(practice);
  const pendingIndices = getPracticePendingIndices(practice);
  const unansweredIndices = getPracticeUnansweredIndices(practice);
  const unconfirmedIndices = pendingIndices.filter((index) => !unansweredIndices.includes(index));
  const shouldShowAttemptStats = isReviewMode || isFinalized || (submitted && (stats[question.id]?.seen ?? 0) > 0);

  return (
    <section className={progressCollapsed ? "exam-layout practice-layout progress-collapsed" : "exam-layout practice-layout"}>
      <div className="exam-main">
        {showSidebarToggle && <AnswerNavToggle openSidebar={openSidebar} />}
        <div className="practice-answer-search">
          <QuestionSearchPanel
            questions={allQuestions}
            decks={allDecks}
            stats={stats}
            slashedQuestionSet={slashedQuestionSet}
            openQuestion={openQuestion}
            editQuestion={editQuestion}
          />
        </div>
        <div className="exam-topbar">
          <div>
            <span className="eyebrow">{deck.name} · {question.uid}</span>
            <h1>{isMistakePractice ? "错题刷题" : isFavoritePractice ? (isReviewMode ? "收藏背题" : "收藏刷题") : (isReviewMode ? "顺序背题" : "顺序刷题")}</h1>
            <ProficiencyBadge level={proficiency} />
          </div>
          <div className="exam-meta">
            {!isHardDeck && !isMistakePractice && <PracticeModeSwitch mode={mode} setMode={setPracticeMode} />}
            <span className="question-index-pill">{currentIndex + 1} / {practice.questionIds.length}</span>
            <AnswerProgressToggle collapsed={progressCollapsed} setCollapsed={setProgressCollapsed} />
          </div>
        </div>
        <AndroidQuestionSwipeStage previous={currentIndex > 0 ? questionById.get(practice.questionIds[currentIndex - 1]) : null} next={currentIndex < practice.questionIds.length - 1 ? questionById.get(practice.questionIds[currentIndex + 1]) : null} favoriteQuestionSet={favoriteQuestionSet} slashedQuestionSet={slashedQuestionSet} hardQuestionSet={hardQuestionSet} practice={practice} practiceReviewMode={isReviewMode} stats={stats} notes={notes}>
        <article key={question.id} className="question-panel">
          <div className="question-panel-tools">
            <span className="type-pill">{question.type}</span>
            <div className="question-panel-actions">
              <FavoriteButton isFavorite={favoriteQuestionSet.has(question.id)} onToggle={() => toggleFavoriteQuestion(question.id)} />
              <SlashedButton isSlashed={slashedQuestionSet.has(question.id)} onToggle={() => toggleSlashedQuestion(question.id)} />
              <HardQuestionButton isHard={hardQuestionSet.has(question.id)} onToggle={() => toggleHardQuestion(question.id)} />
              <button className="mini-edit-button" type="button" onClick={() => editQuestion(question.id)}>
                <Pencil size={16} />
                Edit
              </button>
            </div>
          </div>
          <div className="question-text"><RichText text={question.stemText} /></div>
          <QuestionImages question={question} />
          <div className="option-list">
            {orderedOptions.map((option, index) => {
              const selected = !isReviewMode && selectedKeys.includes(option.key);
              const correct = question.answerKeys.includes(option.key);
              const className = [
                "option-button",
                selected ? "selected" : "",
                reveal && correct ? "correct" : "",
                reveal && selected && !correct ? "wrong" : ""
              ].filter(Boolean).join(" ");
              return (
                <button key={`${question.id}-${option.key}`} className={className} onClick={() => togglePracticeOption(option.key)} disabled={!document.documentElement.classList.contains("native-android") && (isReviewMode || submitted || isFinalized)} aria-disabled={isReviewMode || submitted || isFinalized}>
                  <span className="option-key">{optionDisplayKey(index)}</span>
                  <RichText text={option.text} />
                </button>
              );
            })}
          </div>
          {reveal && (
            <div className={isReviewMode || isAnswerCorrect(question, selectedKeys) ? "answer-box correct" : "answer-box wrong"}>
              <strong>正确答案：{correctDisplay}</strong>
              {!isReviewMode && <span>你的答案：{selectedDisplay}</span>}
              {shouldShowAttemptStats && <AnswerAttemptStats stat={stats[question.id]} />}
            </div>
          )}
          {reveal && <QuestionNotePanel questionId={question.id} note={notes[question.id] ?? ""} onChange={updateQuestionNote} />}
        </article>
        </AndroidQuestionSwipeStage>
        <div className="exam-actions">
          <button className="secondary-button" onClick={() => setPracticeIndex(currentIndex - 1)} disabled={currentIndex === 0}>
            上一题
          </button>
          {isReviewMode ? (
            <button className="primary-button" onClick={() => setPracticeIndex(currentIndex + 1)} disabled={currentIndex >= practice.questionIds.length - 1}>
              下一题
            </button>
          ) : canConfirm ? (
            <button className="primary-button mobile-answer-action" onClick={confirmPracticeQuestion}>
              确认答案
            </button>
          ) : currentIndex < practice.questionIds.length - 1 ? (
            <button className="primary-button" onClick={() => setPracticeIndex(currentIndex + 1)}>
              下一题
            </button>
          ) : (
            <button
              className="primary-button mobile-answer-action"
              onClick={submitPractice}
              disabled={submitted}
            >
              交卷
            </button>
          )}
        </div>
      </div>
      {!progressCollapsed && <AnswerProgressDismissLayer onDismiss={() => setProgressCollapsed(true)} />}
      {!progressCollapsed && (
        <aside className="question-nav" onClickCapture={(event) => { if (isAnswerProgressBlankTap(event)) setProgressCollapsed(true); }}>
          <section className={`result-panel practice-progress-panel${submitted ? " submitted" : ""}${isFavoritePractice ? " favorite" : ""}`}>
            <div className="practice-progress-head">
              <h2>{submitted ? `成绩 ${practice.score}%` : isFavoritePractice ? "收藏进度" : isMistakePractice ? "错题进度" : "顺序进度"}</h2>
              {!submitted && <span>{finalizedCount} 已判定</span>}
            </div>
            <div className="practice-progress-metric" aria-label={`已作答 ${answeredCount} / ${practice.questionIds.length}`}>
              <strong>{answeredCount}</strong>
              <span>/ {practice.questionIds.length} 已作答</span>
            </div>
            {!isFavoritePractice && !isMistakePractice && slashedAnsweredCount > 0 && (
              <p className="practice-count-note">“已作答”含 {slashedAnsweredCount} 道已斩题。</p>
            )}
            {isHardDeck && (
              <p className="practice-count-note">重难题：低正确率题自动进入，恢复到 50% 且连续答对 2 次后移出；不允许斩题。</p>
            )}
            {submitted && pendingIndices.length > 0 && (
              <div className="practice-missing-list">
                <strong>未完成 {pendingIndices.length} 道</strong>
                {unansweredIndices.length > 0 && <span>未作答：第 {formatQuestionIndexList(unansweredIndices)} 题</span>}
                {unconfirmedIndices.length > 0 && <span>已选未确认：第 {formatQuestionIndexList(unconfirmedIndices)} 题</span>}
              </div>
            )}
            {!submitted && !isHardDeck && !isMistakePractice && (
              <div className="practice-progress-options">
                <label className="compact-check">
                  <input type="checkbox" checked={practiceShuffleOptions} onChange={(event) => setPracticeShuffleOptions(event.target.checked)} />
                  选项乱序
                </label>
                <label className="compact-check">
                  <input type="checkbox" checked={practiceShuffleQuestions} onChange={(event) => setPracticeShuffleQuestions(event.target.checked)} />
                  题目乱序
                </label>
              </div>
            )}
            {!submitted && (
              <div className="practice-progress-options single">
                <label className="compact-check">
                  <input type="checkbox" checked={practiceAutoAdvanceCorrect} onChange={(event) => setPracticeAutoAdvanceCorrect(event.target.checked)} />
                  答对后自动进入下一题
                </label>
              </div>
            )}
            {!submitted && (
              <button className="secondary-button wide" onClick={() => isMistakePractice ? restartMistakePractice() : startPractice(true, isHardDeck ? false : practiceShuffleOptions, isHardDeck ? false : practiceShuffleQuestions)}>重新开始</button>
            )}
          </section>
          <ScrollableQuestionNav
            className="practice-grid"
            currentIndex={currentIndex}
            onSelect={(index) => { setPracticeIndex(index); if (document.documentElement.classList.contains("native-android")) setProgressCollapsed(true); }}
            items={practice.questionIds.map((id, index) => {
              const navSelected = practice.answers[id] ?? [];
              const navResult = (practice.results ?? {})[id];
              return {
                key: `${id}-${index}`,
                className: [
                  "nav-dot",
                  index === currentIndex ? "current" : "",
                  isReviewMode && index < reviewProgress ? "reviewed" : "",
                  navSelected.length > 0 ? "answered" : "",
                  navResult === true ? "correct" : "",
                  navResult === false ? "wrong" : ""
                ].filter(Boolean).join(" ")
              };
            })}
          />
        </aside>
      )}
    </section>
  );
}

function ExamSetup({
  config,
  setConfig,
  startExam,
  compact = false
}: {
  config: ExamConfig;
  setConfig: (config: ExamConfig) => void;
  startExam: () => void;
  compact?: boolean;
}) {
  return (
    <section className={compact ? "setup-panel compact" : "setup-panel"}>
      <div className="section-title">
        <h2>组卷</h2>
        <Shuffle size={18} />
      </div>
      <div className="count-grid exam-count-grid">
        <NumberField label="判断" value={config.judgeCount} onChange={(value) => setConfig({ ...config, judgeCount: value })} />
        <NumberField label="单选" value={config.singleCount} onChange={(value) => setConfig({ ...config, singleCount: value })} />
        <NumberField label="多选" value={config.multipleCount} onChange={(value) => setConfig({ ...config, multipleCount: value })} />
      </div>
      <div className="toggle-row exam-toggle-row">
        <label>
          <input type="checkbox" checked={config.wrongFirst} onChange={(event) => setConfig({ ...config, wrongFirst: event.target.checked })} />
          错题优先
        </label>
        <label>
          <input type="checkbox" checked={config.shuffleOptions} onChange={(event) => setConfig({ ...config, shuffleOptions: event.target.checked })} />
          单选/多选选项乱序
        </label>
        <label>
          <input type="checkbox" checked={config.excludeRecent} onChange={(event) => setConfig({ ...config, excludeRecent: event.target.checked })} />
          跳过近 12 小时
        </label>
      </div>
      <button className="primary-button wide" onClick={() => startExam()}>
        <Play size={18} />
        开始考试
      </button>
    </section>
  );
}

function QuestionBank({
  questions,
  stats,
  slashedQuestionSet,
  total,
  focus,
  clearFocus,
  query,
  setQuery,
  typeFilter,
  setTypeFilter,
  openQuestion,
  editQuestion
}: {
  questions: Question[];
  stats: Record<string, QuestionStat>;
  slashedQuestionSet: Set<string>;
  total: number;
  focus: QuestionSetFocus | null;
  clearFocus: () => void;
  query: string;
  setQuery: (value: string) => void;
  typeFilter: QuestionType | "全部";
  setTypeFilter: (value: QuestionType | "全部") => void;
  openQuestion: (questionId: string) => void;
  editQuestion: (questionId: string) => void;
}) {
  const searchTerms = useMemo(() => getSearchTerms(query), [query]);

  return (
    <section className="page">
      <Header title="题库" subtitle={focus ? `${focus.title} · ${focus.questionIds.length} 道` : `${total} 道客观题`} />
      {focus && (
        <div className="bank-focus-banner">
          <div>
            <span>当前列表</span>
            <strong>{focus.title}</strong>
          </div>
          <button type="button" className="secondary-button" onClick={clearFocus}>显示全部</button>
        </div>
      )}
      <div className="toolbar">
        <div className="search-box">
          <Search size={18} />
          <SearchTextInput value={query} onChange={setQuery} placeholder="搜索题干或选项" />
        </div>
        <div className="segmented">
          {(["全部", ...TYPE_ORDER] as const).map((type) => (
            <button key={type} className={typeFilter === type ? "active" : ""} onClick={() => setTypeFilter(type)}>
              {type}
            </button>
          ))}
        </div>
      </div>
      <div className="question-list">
        {questions.map((question) => (
          <QuestionRow
            key={question.id}
            question={question}
            stat={stats[question.id]}
            statLabel=""
            onOpen={() => openQuestion(question.id)}
            onEdit={() => editQuestion(question.id)}
            isSlashed={slashedQuestionSet.has(question.id)}
            highlightTerms={searchTerms}
          />
        ))}
      </div>
    </section>
  );
}

function Mistakes({
  questions,
  stats,
  slashedQuestionSet,
  openQuestion,
  editQuestion,
  mistakeShuffleOptions,
  setMistakeShuffleOptions,
  mistakePractice,
  startMistakePractice
}: {
  questions: Question[];
  stats: AppData["stats"];
  slashedQuestionSet: Set<string>;
  openQuestion: (questionId: string) => void;
  editQuestion: (questionId: string) => void;
  mistakeShuffleOptions: boolean;
  setMistakeShuffleOptions: (value: boolean) => void;
  mistakePractice?: PracticeState;
  startMistakePractice: () => void;
}) {
  const activeMistakePractice = mistakePractice?.scope === "mistakes" && !mistakePractice.submittedAt ? mistakePractice : null;
  const mistakePracticeDoneCount = activeMistakePractice ? Object.keys(activeMistakePractice.results ?? {}).length : 0;
  return (
    <section className="page">
      <Header title="错题" subtitle={`${questions.length} 道`} />
      <FeatureGuide title="错题如何清除">
        题目只要答错过就会进入错题库；之后连续答对 {MISTAKE_CLEAR_CORRECT_STREAK} 次会自动移出。错题刷题会包含点击时当前题库的全部错题，答题后即时保存记录。
      </FeatureGuide>
      <div className="toolbar">
        <label className="compact-check">
          <input type="checkbox" checked={mistakeShuffleOptions} onChange={(event) => setMistakeShuffleOptions(event.target.checked)} />
          选项乱序
        </label>
        {activeMistakePractice && (
          <span className="toolbar-status">
            错题刷题进度：{mistakePracticeDoneCount} / {activeMistakePractice.questionIds.length} 已判定，进入后从上次位置继续。
          </span>
        )}
        <button className="primary-button" onClick={startMistakePractice} disabled={questions.length === 0}>
          <RotateCcw size={18} />
          {activeMistakePractice ? "继续错题刷题" : "开始错题刷题"}
        </button>
      </div>
      <div className="question-list">
        {questions.map((question) => (
          <QuestionRow key={question.id} question={question} stat={stats[question.id]} statLabel={`错 ${stats[question.id]?.wrong ?? 0} 次`} onOpen={() => openQuestion(question.id)} onEdit={() => editQuestion(question.id)} isSlashed={slashedQuestionSet.has(question.id)} />
        ))}
        {questions.length === 0 && <p className="empty-text">暂无错题</p>}
      </div>
    </section>
  );
}

function QuestionSearchPanel({
  title,
  subtitle,
  questions,
  decks,
  stats,
  slashedQuestionSet,
  openQuestion,
  editQuestion
}: {
  title?: string;
  subtitle?: string;
  questions: Question[];
  decks: Deck[];
  stats: Record<string, QuestionStat>;
  slashedQuestionSet: Set<string>;
  openQuestion: (questionId: string) => void;
  editQuestion: (questionId: string) => void;
}) {
  const [searchText, setSearchText] = useState("");
  const [mode, setMode] = useState<"list" | "compare">("list");
  const results = useMemo(() => searchQuestions(questions, searchText, 80), [questions, searchText]);
  const deckNamesByQuestionId = useMemo(() => buildDeckNamesByQuestionId(decks), [decks]);
  const hasQuery = searchText.trim().length > 0;
  const searchTerms = useMemo(() => getSearchTerms(searchText), [searchText]);
  const groupedResults = useMemo(() => groupQuestionsByType(results), [results]);
  const handleOpenQuestion = (questionId: string) => {
    openQuestion(questionId);
  };
  const handleEditQuestion = (questionId: string) => {
    editQuestion(questionId);
  };

  return (
    <section className="search-panel">
      {title && (
        <div className="section-title search-panel-title">
          <div>
            {subtitle && <span className="eyebrow">{subtitle}</span>}
            <h2>{title}</h2>
          </div>
        </div>
      )}
      <div className="search-box search-box-wide">
        <Search size={18} />
        <SearchTextInput value={searchText} onChange={setSearchText} placeholder="题干或选项关键词" />
      </div>
      {hasQuery ? (
        <>
          <div className="search-tools">
            <span>{results.length} 道匹配</span>
            <div className="segmented search-mode-switch">
              <button type="button" className={mode === "list" ? "active" : ""} onClick={() => setMode("list")}>列表</button>
              <button type="button" className={mode === "compare" ? "active" : ""} onClick={() => setMode("compare")}>对比</button>
            </div>
          </div>
          {mode === "compare" ? (
            <div className="search-compare-grid">
              {results.slice(0, 18).map((question) => {
                const deckNames = deckNamesByQuestionId.get(question.id) ?? [];
                return (
                  <article key={question.id} className="search-compare-card">
                    <div className="search-result-meta">
                      <span>{question.type}</span>
                      <strong>{question.uid}</strong>
                      <ProficiencyBadge level={getProficiency(stats[question.id], slashedQuestionSet.has(question.id))} compact />
                    </div>
                    <button className="search-compare-main" type="button" onClick={() => handleOpenQuestion(question.id)}>
                      <HighlightedRichText text={question.stemText} terms={searchTerms} />
                    </button>
                    <div className="search-compare-foot">
                      <span>{deckNames.join(" / ") || "未归档"}</span>
                      <strong>答案 {question.answerKeys.join("")}</strong>
                    </div>
                    <button className="row-edit-button" type="button" onClick={() => handleEditQuestion(question.id)}>
                      <Pencil size={15} />
                      Edit
                    </button>
                  </article>
                );
              })}
              {results.length === 0 && <p className="empty-text">没有匹配题目</p>}
            </div>
          ) : (
            <div className="search-result-list">
              {groupedResults.map((group) => (
                <div key={group.type} className="search-result-group">
                  <div className="search-result-group-title">
                    <strong>{group.type}</strong>
                    <span>{group.questions.length} 题</span>
                  </div>
                  {group.questions.map((question) => {
                    const deckNames = deckNamesByQuestionId.get(question.id) ?? [];
                    return (
                      <div key={question.id} className="search-result-row">
                        <button className="search-result-main" type="button" onClick={() => handleOpenQuestion(question.id)}>
                          <div className="search-result-meta">
                            <span>{question.type}</span>
                            <strong>{question.uid}</strong>
                            <ProficiencyBadge level={getProficiency(stats[question.id], slashedQuestionSet.has(question.id))} compact />
                          </div>
                          <div className="search-result-body">
                            <p><HighlightedRichText text={question.stemText} terms={searchTerms} /></p>
                            <span>
                              {deckNames.join(" / ") || "未归档"} · 答案 {question.answerKeys.join("")}
                              {getQuestionImageUrls(question).length > 0 ? " · 含图片" : ""}
                            </span>
                          </div>
                        </button>
                        <button className="row-edit-button" type="button" onClick={() => handleEditQuestion(question.id)}>
                          <Pencil size={15} />
                          Edit
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
              {results.length === 0 && <p className="empty-text">没有匹配题目</p>}
            </div>
          )}
        </>
      ) : title ? (
        <p className="empty-text">输入关键词后显示匹配题目</p>
      ) : null}
    </section>
  );
}

function InteractiveProficiencyPie({
  counts,
  total,
  questionsByLevel,
  onSelect
}: {
  counts: Record<ProficiencyLevel, number>;
  total: number;
  questionsByLevel: Record<ProficiencyLevel, Question[]>;
  onSelect: (level: ProficiencyLevel) => void;
}) {
  const segments = buildPieSegments(counts, total, PROFICIENCY_CHART_LEVELS);
  const firstLevel = segments[0]?.level ?? null;
  const [hoveredLevel, setHoveredLevel] = useState<ProficiencyLevel | null>(firstLevel);
  const activeLevel = hoveredLevel ?? firstLevel;
  const activeCount = activeLevel ? counts[activeLevel] : 0;
  const activePercent = activeLevel ? formatPercent(activeCount, total) : "0%";

  return (
    <div className="pie-chart" onMouseLeave={() => setHoveredLevel(firstLevel)}>
      <svg className="pie-svg" viewBox="0 0 100 100" role="img" aria-label="熟练度分布饼图">
        {segments.length === 0 && <circle cx="50" cy="50" r="45" fill="#e9eef2" />}
        {segments.map((segment) => {
          const disabled = questionsByLevel[segment.level].length === 0;
          if (segment.full) {
            return (
              <circle
                key={segment.level}
                className="pie-slice"
                cx="50"
                cy="50"
                r="45"
                fill={segment.color}
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-label={`${segment.level} ${segment.count} 题`}
                onMouseEnter={() => setHoveredLevel(segment.level)}
                onFocus={() => setHoveredLevel(segment.level)}
                onClick={() => !disabled && onSelect(segment.level)}
                onKeyDown={(event) => {
                  if (!disabled && (event.key === "Enter" || event.key === " ")) onSelect(segment.level);
                }}
              />
            );
          }
          return (
            <path
              key={segment.level}
              className="pie-slice"
              d={segment.path}
              fill={segment.color}
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-label={`${segment.level} ${segment.count} 题`}
              onMouseEnter={() => setHoveredLevel(segment.level)}
              onFocus={() => setHoveredLevel(segment.level)}
              onClick={() => !disabled && onSelect(segment.level)}
              onKeyDown={(event) => {
                if (!disabled && (event.key === "Enter" || event.key === " ")) onSelect(segment.level);
              }}
            />
          );
        })}
      </svg>
      <div className="pie-hover-label">
        {activeLevel ? (
          <>
            <strong>{activeLevel}</strong>
            <span>{activeCount.toLocaleString("zh-CN")} 题</span>
            <em>{activePercent}</em>
          </>
        ) : (
          <>
            <strong>暂无数据</strong>
            <span>0 题</span>
            <em>0%</em>
          </>
        )}
      </div>
    </div>
  );
}

function Stats({
  data,
  sessions,
  questions,
  typeCounts,
  statSummary,
  excludedSlashedCount,
  openQuestionSet
}: {
  data: AppData;
  sessions: ExamSession[];
  questions: Question[];
  typeCounts: Record<QuestionType, number>;
  statSummary: ReturnType<typeof buildStatSummary>;
  excludedSlashedCount: number;
  openQuestionSet: (title: string, questions: Question[]) => void;
}) {
  const typeRates = TYPE_ORDER.map((type) => {
    const typeQuestions = questions.filter((question) => question.type === type);
    const stats = typeQuestions.map((question) => data.stats[question.id]).filter(Boolean);
    const correct = stats.reduce((sum, stat) => sum + stat.correct, 0);
    const wrong = stats.reduce((sum, stat) => sum + stat.wrong, 0);
    const total = correct + wrong;
    return { type, questions: typeQuestions, total: typeCounts[type], rate: total ? Math.round((correct / total) * 100) : 0 };
  });
  const slashedIds = new Set(data.slashedQuestionIds ?? []);
  const proficiencyCounts = countProficiency(questions, data.stats, slashedIds);
  const proficiencyQuestions = PROFICIENCY_CHART_LEVELS.reduce((map, level) => {
    map[level] = questions.filter((question) => getProficiency(data.stats[question.id], slashedIds.has(question.id)) === level);
    return map;
  }, {} as Record<ProficiencyLevel, Question[]>);
  const proficiencyTotal = questions.length;
  const forecastQuestions = questions.filter((question) => !slashedIds.has(question.id));
  const forecast = buildReviewForecast(forecastQuestions, data.stats, 31);
  const forecastQuestionGroups = buildReviewForecastQuestionGroups(forecastQuestions, data.stats, 31);
  const forecastPeak = Math.max(0, ...forecast.map((day) => day.count));
  const forecastScaleMax = Math.max(1, forecastPeak);
  const cumulativeTotal = forecast[forecast.length - 1]?.cumulative ?? 0;
  const cumulativeScaleMax = Math.max(1, cumulativeTotal);
  const cumulativePoints = buildForecastCumulativePoints(forecast, cumulativeScaleMax);

  return (
    <section className="page">
      <Header title="统计" subtitle="学习记录" />
      <div className="metric-grid">
        <Metric label="已见题目" value={statSummary.touched} detail={`题次 ${statSummary.seen}`} />
        <Metric label="正确率" value={`${statSummary.rate}%`} detail={`${statSummary.correct} 对 / ${statSummary.wrong} 错`} />
        <Metric label="考试场次" value={sessions.length} detail={`最近成绩 ${sessions[0]?.score ?? 0}%`} />
        <Metric label="连对题目" value={statSummary.streaking} detail="连续答对大于 0" />
      </div>
      <section className="chart-panel">
        <h2>题型正确率</h2>
        <div className="bar-list">
          {typeRates.map((item) => (
            <button
              className="bar-row chart-action-row"
              key={item.type}
              type="button"
              disabled={item.questions.length === 0}
              onClick={() => openQuestionSet(item.type, item.questions)}
            >
              <span>{item.type}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${item.rate}%` }} />
              </div>
              <strong>{item.rate}%</strong>
            </button>
          ))}
        </div>
      </section>
      <section className="chart-panel">
        <h2>熟练度分布</h2>
        <div className="proficiency-chart anki-proficiency-chart">
          <InteractiveProficiencyPie
            counts={proficiencyCounts}
            total={proficiencyTotal}
            questionsByLevel={proficiencyQuestions}
            onSelect={(level) => openQuestionSet(level, proficiencyQuestions[level])}
          />
          <div className="proficiency-legend">
            {PROFICIENCY_CHART_LEVELS.map((level) => {
              const levelQuestions = proficiencyQuestions[level];
              return (
              <button
                className="legend-row chart-action-row"
                key={level}
                type="button"
                disabled={levelQuestions.length === 0}
                onClick={() => openQuestionSet(level, levelQuestions)}
              >
                <span className="legend-dot" style={{ background: getProficiencyChartColor(level) }} />
                <strong>{level}</strong>
                <em>{proficiencyCounts[level].toLocaleString("zh-CN")}</em>
                <small>{formatPercent(proficiencyCounts[level], proficiencyTotal)}</small>
              </button>
              );
            })}
            <div className="legend-row total-row">
              <span />
              <strong>总计</strong>
              <em>{proficiencyTotal.toLocaleString("zh-CN")}</em>
              <small />
            </div>
          </div>
        </div>
      </section>
      <section className="chart-panel">
        <div className="forecast-header">
          <div>
            <h2>预测</h2>
            <p>将来到期的复习题数目</p>
          </div>
          <span>1 个月</span>
        </div>
        {excludedSlashedCount > 0 && (
          <p className="forecast-scope-note">复习预测已排除 {excludedSlashedCount} 道已斩题。</p>
        )}
        <div className="forecast-chart" aria-label="将来到期的复习题数目">
          <div className="forecast-y-axis">
            <span>{forecastPeak.toLocaleString("zh-CN")}</span>
            <span>{Math.round(forecastPeak / 2).toLocaleString("zh-CN")}</span>
            <span>0</span>
          </div>
          <div className="forecast-plot">
            <svg className="forecast-cumulative-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polyline points={cumulativePoints} />
            </svg>
            <div className="forecast-bars">
              {forecast.map((day) => {
                const dueQuestions = forecastQuestionGroups.get(day.dayOffset) ?? [];
                return (
                <button
                  className="forecast-day"
                  key={day.dayOffset}
                  type="button"
                  disabled={!document.documentElement.classList.contains("native-android") && dueQuestions.length === 0}
                  onClick={(event) => document.documentElement.classList.contains("native-android") ? event.currentTarget.focus() : openQuestionSet(`${day.label}到期复习题`, dueQuestions)}
                >
                  <div
                    className="forecast-bar"
                    style={{ height: day.count ? `${Math.max(2, (day.count / forecastScaleMax) * 100)}%` : "0%" }}
                  >
                    <span className="forecast-bar-fill" />
                    <span className="forecast-tooltip">
                      <strong>{day.label}：</strong>
                      {day.count.toLocaleString("zh-CN")} 道题到期
                      <em>累计：{day.cumulative.toLocaleString("zh-CN")}</em>
                    </span>
                  </div>
                </button>
                );
              })}
            </div>
            <div className="forecast-x-axis">
              {[0, 5, 10, 15, 20, 25, 30].map((day) => (
                <span key={day} style={{ left: `${(day / 30) * 100}%` }}>{day}</span>
              ))}
            </div>
          </div>
          <div className="forecast-y-axis forecast-y-axis-right">
            <span>{cumulativeTotal.toLocaleString("zh-CN")}</span>
            <span>{Math.round(cumulativeTotal / 2).toLocaleString("zh-CN")}</span>
            <span>0</span>
          </div>
        </div>
      </section>
      <RecentSessions sessions={sessions} />
    </section>
  );
}

function formatImportSkippedSummary(report: ImportReport) {
  if (report.skipped === 0) return "";
  const rowSummaries = (report.skippedRows ?? []).slice(0, 3).map(formatSkippedRowSummary);
  const fallbackSummaries = report.errors.slice(0, 3);
  const summaries = rowSummaries.length > 0 ? rowSummaries : fallbackSummaries;
  if (summaries.length === 0) return "";
  const remaining = report.skipped - summaries.length;
  return `；跳过明细：${summaries.join("；")}${remaining > 0 ? `；另有 ${remaining} 行` : ""}`;
}

function formatSkippedRowSummary(row: NonNullable<ImportReport["skippedRows"]>[number]) {
  const sourceText = row.source ? `${row.source} ` : "";
  const serialText = row.serial ? `（序号 ${row.serial}）` : "";
  return `${sourceText}第 ${row.rowNumber} 行${serialText}：${row.detail ? `${row.reason}，${row.detail}` : row.reason}`;
}

function ImportPanel({
  handleExcelImport,
  report
}: {
  handleExcelImport: (file?: File) => void;
  report: ImportReport | null;
}) {
  return (
    <section className="page">
      <Header title="导入" subtitle="Excel 题库" />
      <section className="import-guide">
        <div>
          <strong>仅支持 Excel 文件</strong>
          <span>文件后缀为 .xlsx；旧 .xls 请先另存为 .xlsx，暂不支持 TSV、CSV、Word、PDF。</span>
        </div>
        <div className="import-format-grid">
          <span>工作表</span>
          <p>优先读取名为「题库」的工作表；没有则读取第一个工作表。</p>
          <span>表头</span>
          <p>第一行必须包含：序号、题型、题目、选项、正确答案；可选列：图片。</p>
          <span>题型</span>
          <p>只导入判断题、单选题、多选题；简答题和计算题会跳过。</p>
          <span>选项</span>
          <p>写在「选项」列，推荐格式：A. 选项内容，B. 选项内容；也可以每个选项换一行。</p>
          <span>答案</span>
          <p>判断题填 A/B，单选题填 A/B/C/D，多选题填 ABC 这类连续字母。</p>
          <span>图片</span>
          <p>可以直接把图片插入 Excel 的「图片」列；也可在「图片」列填 /question-images/...、https://... 或 data:image/...。</p>
        </div>
        <figure className="import-example">
          <figcaption>
            <strong>Excel 填写示例</strong>
            <span>照着下图设置表头并逐行填写题目；窗口较窄时可左右滑动查看完整内容。</span>
          </figcaption>
          <div className="import-example-scroll">
            <img
              src={`${import.meta.env.BASE_URL}import-excel-example.png`}
              alt="Excel 题库导入填写示例，表头依次为序号、题型、题目、选项、正确答案、笔记和图片"
            />
          </div>
        </figure>
      </section>
      <section className="import-panel">
        <div className="import-panel-icon">
          <FileSpreadsheet size={30} />
        </div>
        <div className="import-panel-copy">
          <h2>导入自定义题库</h2>
          <p>选择本机 Excel 文件，解析完成后会作为独立题库添加到首页。</p>
        </div>
        <label className="primary-button import-file-button">
          <Upload size={18} />
          选择 Excel 文件
          <input
            type="file"
            accept=".xlsx"
            onChange={(event) => {
              handleExcelImport(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <p className="import-panel-note">内置题库为固定内容，此处仅用于添加或更新你自己的题库文件。</p>
      </section>
      {report && (
        <section className="report-panel">
          <h2>导入结果</h2>
          <div className="report-grid">
            <Metric label="总行数" value={report.totalRows} detail="" />
            <Metric label="导入" value={report.imported} detail="" />
            <Metric label="图片" value={report.images ?? 0} detail="" />
            <Metric label="跳过" value={report.skipped} detail="" />
          </div>
          {report.errors.length > 0 && (
            <div className="error-list">
              {report.errors.slice(0, 8).map((error) => <span key={error}>{error}</span>)}
            </div>
          )}
        </section>
      )}
    </section>
  );
}

function ExportPanel({
  data,
  selectedDeckId,
  setSelectedDeckId,
  exportSelectedDeckExcel,
  exportAllDecksExcel
}: {
  data: AppData;
  selectedDeckId: string;
  setSelectedDeckId: (deckId: string) => void;
  exportSelectedDeckExcel: (deckId: string) => void;
  exportAllDecksExcel: () => void;
}) {
  const exportableDecks = data.decks.filter((deck) => !isHardQuestionDeck(deck));
  const selectedDeck = exportableDecks.find((deck) => deck.id === selectedDeckId) ?? exportableDecks[0] ?? null;
  const exportableQuestionIds = new Set(exportableDecks.flatMap((deck) => deck.questionIds));
  const totalQuestions = exportableDecks.reduce((sum, deck) => sum + deck.questionIds.length, 0);
  const imageQuestionCount = data.questions.filter((question) => exportableQuestionIds.has(question.id) && (question.imageUrls?.length ?? 0) > 0).length;

  return (
    <section className="page">
      <Header title="导出" subtitle="Excel 题库" />
      <section className="export-panel">
        <div className="export-summary-grid">
          <Metric label="题库数量" value={exportableDecks.length} detail="不含个人重难题" />
          <Metric label="题目总数" value={totalQuestions} detail="可导出题库合计" />
          <Metric label="含图片题" value={imageQuestionCount} detail="导出为内嵌图片" />
        </div>

        <div className="export-deck-picker">
          <label className="edit-field">
            <span>选择题库</span>
            <select value={selectedDeck?.id ?? ""} onChange={(event) => setSelectedDeckId(event.target.value)} disabled={exportableDecks.length === 0}>
              {exportableDecks.map((deck) => (
                <option key={deck.id} value={deck.id}>{deck.name}（{deck.questionIds.length} 题）</option>
              ))}
            </select>
          </label>
          <div className="export-actions">
            <button className="secondary-button" type="button" onClick={() => selectedDeck && exportSelectedDeckExcel(selectedDeck.id)} disabled={!selectedDeck}>
              <Download size={18} />
              导出所选题库 Excel
            </button>
            <button className="primary-button" type="button" onClick={exportAllDecksExcel} disabled={exportableDecks.length === 0}>
              <Download size={18} />
              全部导出
            </button>
          </div>
        </div>
      </section>
    </section>
  );
}

function SettingsPanel({
  data,
  exportProgress,
  importProgressBackup,
  resetStats,
  resetAll
}: {
  data: AppData;
  exportProgress: () => void;
  importProgressBackup: (file?: File) => void;
  resetStats: () => void;
  resetAll: () => void;
}) {
  const progressImportInputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="page">
      <Header title="设置" subtitle="本地数据" />
      <section className="settings-panel">
        <div className="section-title">
          <h2>备份学习进度</h2>
          <Download size={18} />
        </div>
        <div className="settings-grid">
          <button className="secondary-button" type="button" onClick={exportProgress} disabled={data.questions.length === 0}>
            <Download size={18} />
            导出学习进度
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => progressImportInputRef.current?.click()}
          >
            <Upload size={18} />
            导入学习进度
          </button>
          <input
            ref={progressImportInputRef}
            className="hidden-file-input"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              importProgressBackup(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </div>
      </section>
      <section className="settings-panel">
        <div className="section-title">
          <div>
            <span className="eyebrow">危险操作</span>
            <h2>清理数据</h2>
          </div>
          <Trash2 size={18} />
        </div>
        <div className="settings-grid">
          <button className="secondary-button" onClick={resetStats}>
            <RotateCcw size={18} />
            软件初始化
          </button>
          <button className="danger-button" onClick={resetAll}>
            <Trash2 size={18} />
            清空全部
          </button>
        </div>
      </section>
    </section>
  );
}

function QuestionRow({
  question,
  stat,
  statLabel,
  onOpen,
  onEdit,
  isFavorite = false,
  onFavorite,
  isSlashed = false,
  onSlash,
  highlightTerms = []
}: {
  question: Question;
  stat?: QuestionStat;
  statLabel: string;
  onOpen?: () => void;
  onEdit?: () => void;
  isFavorite?: boolean;
  onFavorite?: () => void;
  isSlashed?: boolean;
  onSlash?: () => void;
  highlightTerms?: string[];
}) {
  const hasHighlights = highlightTerms.length > 0;
  const matchedOptions = hasHighlights
    ? question.options.filter((option) => highlightTerms.some((term) => scoreSearchField(option.text, term, 1) > 0)).slice(0, 2)
    : [];
  const content = (
    <>
      <div className="row-meta">
        <span>{question.type}</span>
        <strong>{question.uid}</strong>
        <ProficiencyBadge level={getProficiency(stat, isSlashed)} compact />
      </div>
      <p>{hasHighlights ? <HighlightedRichText text={question.stemText} terms={highlightTerms} /> : <RichText text={question.stemText} />}</p>
      {matchedOptions.length > 0 && (
        <div className="row-option-matches">
          {matchedOptions.map((option) => (
            <span key={option.key}>
              {option.key}. <HighlightedRichText text={option.text} terms={highlightTerms} />
            </span>
          ))}
        </div>
      )}
      <div className="row-answer">
        <CheckCircle2 size={16} />
        {question.answerKeys.join("")}
        {getQuestionImageUrls(question).length > 0 && <em>含图片</em>}
        {statLabel && <em>{statLabel}</em>}
      </div>
    </>
  );

  if (onOpen) {
    return (
      <article className="question-row question-row-with-edit">
        <button className="question-row-main" type="button" onClick={onOpen}>
          {content}
        </button>
        <div className="question-row-actions">
          {onFavorite && <FavoriteButton isFavorite={isFavorite} onToggle={onFavorite} />}
          {onSlash && <SlashedButton isSlashed={isSlashed} onToggle={onSlash} />}
          {onEdit && (
            <button className="row-edit-button" type="button" onClick={onEdit}>
              <Pencil size={15} />
              Edit
            </button>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className="question-row">
      {content}
      <div className="question-row-actions">
        {onFavorite && <FavoriteButton isFavorite={isFavorite} onToggle={onFavorite} />}
        {onSlash && <SlashedButton isSlashed={isSlashed} onToggle={onSlash} />}
        {onEdit && (
          <button className="row-edit-button" type="button" onClick={onEdit}>
            <Pencil size={15} />
            Edit
          </button>
        )}
      </div>
    </article>
  );
}

function QuestionDetailDialog({
  question,
  stat,
  isSlashed,
  isHard,
  deckNames,
  note,
  updateQuestionNote,
  toggleHardQuestion,
  onEdit,
  onClose
}: {
  question: Question;
  stat?: QuestionStat;
  isSlashed: boolean;
  isHard: boolean;
  deckNames: string[];
  note: string;
  updateQuestionNote: (questionId: string, note: string) => void;
  toggleHardQuestion: () => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const correctRate = stat?.seen ? Math.round((stat.correct / stat.seen) * 1000) / 10 : 0;
  const answerKeysText = question.answerKeys.join("");
  const extraAnswerText = question.answerText.trim();
  const shouldShowAnswerText = extraAnswerText && normalizeSearchText(extraAnswerText) !== normalizeSearchText(answerKeysText);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <article className="question-detail-dialog" role="dialog" aria-modal="true" aria-label="题目详情" onMouseDown={(event) => event.stopPropagation()}>
        <header className="detail-header">
          <div>
            <span className="eyebrow">{deckNames.join(" / ") || "题库"}</span>
            <h2>{question.uid}</h2>
          </div>
          <div className="detail-header-actions">
            <span className="type-pill">{question.type}</span>
            <ProficiencyBadge level={getProficiency(stat, isSlashed)} />
            <HardQuestionButton isHard={isHard} onToggle={toggleHardQuestion} />
            <button className="icon-text-button" type="button" onClick={onEdit}>
              <Pencil size={16} />
              Edit
            </button>
            <button className="icon-button" type="button" aria-label="关闭" onClick={onClose}>
              <XCircle size={20} />
            </button>
          </div>
        </header>
        <div className="detail-stem"><RichText text={question.stemText} /></div>
        <QuestionImages question={question} variant="detail" />
        <div className="detail-options">
          {question.options.map((option, index) => {
            const correct = question.answerKeys.includes(option.key);
            return (
              <div className={correct ? "detail-option correct" : "detail-option"} key={option.key}>
                <span className="option-key">{optionDisplayKey(index)}</span>
                <RichText text={option.text} />
              </div>
            );
          })}
        </div>
        <section className="detail-answer">
          <strong>正确答案：{answerKeysText}</strong>
          {shouldShowAnswerText && <RichText text={extraAnswerText} />}
        </section>
        <QuestionNotePanel questionId={question.id} note={note} onChange={updateQuestionNote} variant="detail" />
        <div className="detail-stat-grid">
          <span>已做 {stat?.seen ?? 0}</span>
          <span>正确 {stat?.correct ?? 0}</span>
          <span>错误 {stat?.wrong ?? 0}</span>
          <span>正确率 {correctRate}%</span>
        </div>
      </article>
    </div>
  );
}

function QuestionEditDialog({
  question,
  onSave,
  onClose
}: {
  question: Question;
  onSave: (question: Question) => void;
  onClose: () => void;
}) {
  const [uid, setUid] = useState(question.uid);
  const [type, setType] = useState<QuestionType>(TYPE_ORDER.includes(question.type) ? question.type : "单选题");
  const [stemText, setStemText] = useState(question.stemText);
  const [optionTexts, setOptionTexts] = useState(question.options.map((option) => option.text));
  const [answerKeysText, setAnswerKeysText] = useState(question.answerKeys.join(""));
  const [answerText, setAnswerText] = useState(question.answerText || question.answerKeys.join(""));
  const [imageUrlsText, setImageUrlsText] = useState((question.imageUrls ?? []).join("\n"));
  const [imagePasteStatus, setImagePasteStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setUid(question.uid);
    setType(TYPE_ORDER.includes(question.type) ? question.type : "单选题");
    setStemText(question.stemText);
    setOptionTexts(question.options.map((option) => option.text));
    setAnswerKeysText(question.answerKeys.join(""));
    setAnswerText(question.answerText || question.answerKeys.join(""));
    setImageUrlsText((question.imageUrls ?? []).join("\n"));
    setImagePasteStatus("");
    setError("");
  }, [question]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function updateOptionText(index: number, value: string) {
    setOptionTexts((previous) => previous.map((option, optionIndex) => optionIndex === index ? value : option));
  }

  function addOption() {
    setOptionTexts((previous) => [...previous, ""]);
  }

  function removeOption(index: number) {
    setOptionTexts((previous) => previous.filter((_, optionIndex) => optionIndex !== index));
  }

  async function handleImageUrlsPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const imageFiles = getClipboardImageFiles(event.clipboardData);
    if (imageFiles.length === 0) return;

    event.preventDefault();
    setError("");
    setImagePasteStatus(`正在读取 ${imageFiles.length} 张图片...`);

    try {
      const dataUrls = await Promise.all(imageFiles.map(readImageFileAsDataUrl));
      setImageUrlsText((previous) => appendImageUrlsText(previous, dataUrls));
      setImagePasteStatus(`已粘贴 ${dataUrls.length} 张图片，保存后写入题目`);
    } catch {
      setImagePasteStatus("");
      setError("图片读取失败，请重新粘贴");
    }
  }

  function resetJudgementOptions() {
    setType("判断题");
    setOptionTexts(["对", "错"]);
    setAnswerKeysText("A");
    setAnswerText("A");
  }

  function handleSave() {
    const nextStem = stemText.trim();
    const cleanedOptionTexts = optionTexts.map((option) => option.trim()).filter(Boolean);
    const options = cleanedOptionTexts.map((option, index) => ({
      key: optionDisplayKey(index),
      html: escapeEditableHtml(option).replace(/\n/g, "<br>"),
      text: option
    }));
    const answerKeys = parseEditableAnswerKeys(answerKeysText, options);
    const optionKeys = new Set(options.map((option) => option.key));
    const nextAnswerText = answerText.trim() || answerKeys.join("");
    const imageUrls = imageUrlsText
      .split(/\n/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (!uid.trim()) {
      setError("题号不能为空");
      return;
    }
    if (!nextStem) {
      setError("题干不能为空");
      return;
    }
    if (options.length === 0) {
      setError("至少需要一个选项");
      return;
    }
    if (answerKeys.length === 0 || answerKeys.some((key) => !optionKeys.has(key))) {
      setError("答案必须是现有选项字母，例如 A 或 ABC");
      return;
    }
    if ((type === "判断题" || type === "单选题") && answerKeys.length !== 1) {
      setError("判断题和单选题只能设置一个正确答案");
      return;
    }

    onSave({
      ...question,
      uid: uid.trim(),
      type,
      stemText: nextStem,
      stemHtml: escapeEditableHtml(nextStem).replace(/\n/g, "<br>"),
      options,
      answerKeys,
      answerText: nextAnswerText,
      explanationHtml: escapeEditableHtml(nextAnswerText).replace(/\n/g, "<br>"),
      imageUrls,
      tags: buildEditedQuestionTags(question.tags, type)
    });
  }

  return (
    <div className="modal-backdrop edit-backdrop" onMouseDown={onClose}>
      <article className="question-edit-dialog" role="dialog" aria-modal="true" aria-label="编辑题目" onMouseDown={(event) => {
        if (document.documentElement.classList.contains("native-android") && (event.target === event.currentTarget || event.target instanceof HTMLElement && event.target.classList.contains("detail-header"))) onClose();
        else event.stopPropagation();
      }}>
        <header className="detail-header">
          <div>
            <span className="eyebrow">编辑题目</span>
            <h2>{question.uid}</h2>
          </div>
        </header>
        <div className="edit-sticky-actions">
          <div className="edit-actions">
            <button className="secondary-button" type="button" onClick={onClose}>取消</button>
            <button className="primary-button" type="button" onClick={handleSave}>保存修改</button>
          </div>
          {error && <p className="edit-error">{error}</p>}
        </div>
        <section className="edit-formula-guide">
          <strong>公式写法</strong>
          <span>行内公式输入 <code>$a^2+b^2=c^2$</code>，单独成行的大公式输入 <code>{String.raw`$$\frac{a}{b}$$`}</code>。</span>
        </section>
        <div className="edit-form-grid">
          <label className="edit-field">
            <span>题号</span>
            <input value={uid} onChange={(event) => setUid(event.target.value)} />
          </label>
          <label className="edit-field">
            <span>题型</span>
            <select value={type} onChange={(event) => setType(event.target.value as QuestionType)}>
              {TYPE_ORDER.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
        <label className="edit-field">
          <span>题干</span>
          <textarea value={stemText} onChange={(event) => setStemText(event.target.value)} rows={5} />
        </label>
        <section className="edit-preview-panel">
          <strong>题干预览</strong>
          <RichText text={stemText || "暂无题干"} />
        </section>
        <section className="edit-options-panel">
          <div className="edit-section-header">
            <strong>选项</strong>
            <div>
              <button className="secondary-button small-button" type="button" onClick={resetJudgementOptions}>判断模板</button>
              <button className="secondary-button small-button" type="button" onClick={addOption}>添加选项</button>
            </div>
          </div>
          <div className="edit-option-list">
            {optionTexts.map((option, index) => (
              <div className="edit-option-row" key={`${index}-${optionDisplayKey(index)}`}>
                <span className="option-key">{optionDisplayKey(index)}</span>
                <input value={option} onChange={(event) => updateOptionText(index, event.target.value)} />
                <button className="icon-button" type="button" aria-label={`删除选项 ${optionDisplayKey(index)}`} onClick={() => removeOption(index)} disabled={optionTexts.length <= 1}>
                  <XCircle size={18} />
                </button>
              </div>
            ))}
          </div>
        </section>
        <div className="edit-form-grid">
          <label className="edit-field">
            <span>正确答案</span>
            <input value={answerKeysText} onChange={(event) => setAnswerKeysText(event.target.value.toUpperCase())} placeholder="例如 A 或 ABC" />
          </label>
          <label className="edit-field">
            <span>答案/解析文本</span>
            <input value={answerText} onChange={(event) => setAnswerText(event.target.value)} />
          </label>
        </div>
        <section className="edit-preview-panel">
          <strong>答案/解析预览</strong>
          <RichText text={answerText || answerKeysText || "暂无答案"} />
        </section>
        <label className="edit-field">
          <span>图片地址（可选，每行一个，支持粘贴图片）</span>
          <textarea value={imageUrlsText} onChange={(event) => {
            setImageUrlsText(event.target.value);
            if (imagePasteStatus) setImagePasteStatus("");
          }} onPaste={handleImageUrlsPaste} rows={3} />
          <small className="edit-field-hint">{imagePasteStatus || "可粘贴截图或复制的图片；保存后会作为题目配图同步。"}</small>
        </label>
      </article>
    </div>
  );
}

function getClipboardImageFiles(clipboardData: DataTransfer) {
  const imageFiles = new Map<string, File>();
  Array.from(clipboardData.items ?? []).forEach((item) => {
    if (item.kind !== "file" || !item.type.startsWith("image/")) return;
    const file = item.getAsFile();
    if (file) imageFiles.set(buildClipboardFileKey(file), file);
  });
  Array.from(clipboardData.files ?? []).forEach((file) => {
    if (file.type.startsWith("image/")) imageFiles.set(buildClipboardFileKey(file), file);
  });
  return [...imageFiles.values()];
}

function buildClipboardFileKey(file: File) {
  return `${file.name}|${file.type}|${file.size}|${file.lastModified}`;
}

function readImageFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (result.startsWith("data:image/")) resolve(result);
      else reject(new Error("剪贴板内容不是图片"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

function appendImageUrlsText(previous: string, imageUrls: string[]) {
  const lines = previous.split(/\n/).map((item) => item.trim()).filter(Boolean);
  return [...lines, ...imageUrls].join("\n");
}

function ScrollableQuestionNav({
  items,
  currentIndex,
  onSelect,
  className = ""
}: {
  items: Array<{ key: string; className: string }>;
  currentIndex: number;
  onSelect: (index: number) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const container = containerRef.current;
      const current = container?.querySelector<HTMLElement>(`[data-question-index="${currentIndex}"]`);
      if (!container || !current) return;
      const padding = 12;
      const currentTop = current.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
      const currentBottom = currentTop + current.offsetHeight;
      const visibleTop = container.scrollTop + padding;
      const visibleBottom = container.scrollTop + container.clientHeight - padding;
      if (currentTop < visibleTop) {
        container.scrollTo({ top: Math.max(0, currentTop - padding), behavior: "smooth" });
      } else if (currentBottom > visibleBottom) {
        container.scrollTo({ top: currentBottom - container.clientHeight + padding, behavior: "smooth" });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentIndex, items.length]);

  return (
    <div ref={containerRef} className={`nav-grid scrollable-nav-grid ${className}`.trim()} aria-label="可滚动题号导航">
      {items.map((item, index) => (
        <button
          key={item.key}
          className={item.className}
          data-question-index={index}
          onClick={() => onSelect(index)}
        >
          {index + 1}
        </button>
      ))}
    </div>
  );
}

function NumberField({ label, value, suffix, onChange }: { label: string; value: number; suffix?: string; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [editing, value]);

  function updateDraft(rawValue: string) {
    const digits = rawValue.replace(/\D/g, "");
    const normalized = digits.replace(/^0+(?=\d)/, "").slice(0, 3);
    const nextValue = normalized === "" ? 0 : Math.min(999, Number(normalized));
    setDraft(normalized === "" ? "" : String(nextValue));
    onChange(nextValue);
  }

  return (
    <label className="number-field">
      <span>{label}</span>
      <div>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={draft}
          onFocus={() => setEditing(true)}
          onBlur={() => {
            setEditing(false);
            setDraft(String(value));
          }}
          onChange={(event) => updateDraft(event.target.value)}
        />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="page-header">
      <div>
        {subtitle && <span className="eyebrow">{subtitle}</span>}
        <h1>{title}</h1>
      </div>
    </header>
  );
}

function FavoriteButton({
  isFavorite,
  onToggle,
  compact = true
}: {
  isFavorite: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
    <button
      className={`favorite-button ${isFavorite ? "active" : ""} ${compact ? "compact" : ""}`}
      type="button"
      title={isFavorite ? "取消收藏" : "收藏题目"}
      aria-label={isFavorite ? "取消收藏" : "收藏题目"}
      onClick={onToggle}
    >
      <Star size={compact ? 18 : 16} />
      {!compact && <span>{isFavorite ? "已收藏" : "收藏"}</span>}
    </button>
  );
}

function SlashedButton({
  isSlashed,
  onToggle,
  compact = true
}: {
  isSlashed: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
    <button
      className={`slashed-button ${isSlashed ? "active" : ""} ${compact ? "compact" : ""}`}
      type="button"
      title={isSlashed ? "取消斩题" : "斩题"}
      aria-label={isSlashed ? "取消斩题" : "斩题"}
      onClick={onToggle}
    >
      <Sword size={compact ? 18 : 16} />
      {!compact && <span>{isSlashed ? "已斩" : "斩题"}</span>}
    </button>
  );
}

function HardQuestionButton({
  isHard,
  onToggle,
  compact = true
}: {
  isHard: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
    <button
      className={`hard-question-button ${isHard ? "active" : ""} ${compact ? "compact" : ""}`}
      type="button"
      title={isHard ? "移出重难题库" : "加入重难题库"}
      aria-label={isHard ? "移出重难题库" : "加入重难题库"}
      onClick={onToggle}
    >
      <AlertTriangle size={compact ? 18 : 16} />
      {!compact && <span>{isHard ? "已加入重难题库" : "加入重难题库"}</span>}
    </button>
  );
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <em>{detail}</em>}
    </div>
  );
}

function AnswerAttemptStats({ stat, pendingResult }: { stat?: QuestionStat; pendingResult?: boolean }) {
  const pendingSeen = pendingResult === undefined ? 0 : 1;
  const seen = (stat?.seen ?? 0) + pendingSeen;
  const correct = (stat?.correct ?? 0) + (pendingResult ? 1 : 0);
  const correctStreak = pendingResult === undefined
    ? stat?.correctStreak ?? 0
    : pendingResult
      ? (stat?.correctStreak ?? 0) + 1
      : 0;
  const rateText = seen > 0 ? `${Math.round((correct / seen) * 1000) / 10}%` : "暂无";

  return (
    <span className="answer-stat-line">
      <span className="answer-stat-item">本题已刷 <strong>{seen}</strong> 次</span>
      <span className="answer-stat-item">平均正确率 <strong>{rateText}</strong></span>
      <span className="answer-stat-item">连续正确 <strong>{correctStreak}</strong> 次</span>
    </span>
  );
}

function PracticeModeSwitch({ mode, setMode }: { mode: PracticeMode; setMode: (mode: PracticeMode) => void }) {
  return (
    <div className="mode-switch" data-mode={mode} role="group" aria-label="顺序刷题模式">
      <button type="button" className={mode === "answer" ? "active" : ""} onClick={() => setMode("answer")}>
        答题
      </button>
      <button type="button" className={mode === "review" ? "active" : ""} onClick={() => setMode("review")}>
        背题
      </button>
    </div>
  );
}

function QuestionNotePanel({
  questionId,
  note,
  onChange,
  variant = "question"
}: {
  questionId: string;
  note: string;
  onChange: (questionId: string, note: string) => void;
  variant?: "question" | "detail";
}) {
  const noteId = useId();
  const isAndroidNative = document.documentElement.classList.contains("native-android");
  const [draft, setDraft] = useState(note);
  const [isEditing, setIsEditing] = useState(!isAndroidNative && !note.trim());
  const previousQuestionId = useRef(questionId);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const shouldFocusEditor = useRef(false);

  useEffect(() => {
    setDraft(note);
    if (previousQuestionId.current !== questionId) {
      previousQuestionId.current = questionId;
      setIsEditing(!isAndroidNative && !note.trim());
      return;
    }
    if (!isAndroidNative && !note.trim()) {
      setIsEditing(true);
    }
  }, [note, questionId, isAndroidNative]);

  useEffect(() => {
    if (isEditing && shouldFocusEditor.current) {
      textareaRef.current?.focus();
      shouldFocusEditor.current = false;
    }
  }, [isEditing, questionId]);

  function updateDraft(value: string) {
    setDraft(value);
    onChange(questionId, value);
  }

  function openEditor() {
    shouldFocusEditor.current = true;
    setIsEditing(true);
  }

  const trimmedDraft = draft.trim();
  const hasNote = trimmedDraft.length > 0;
  const showEditor = isEditing || (!isAndroidNative && !hasNote);

  return (
    <section className={variant === "detail" ? "question-note-panel detail-note-panel" : "question-note-panel"}>
      <div className="note-panel-header">
        <label htmlFor={showEditor ? noteId : undefined}>
          <NotebookPen size={17} />
          笔记
        </label>
        {hasNote && <span>已记录</span>}
      </div>
      {showEditor ? (
        <textarea
          ref={textareaRef}
          id={noteId}
          value={draft}
          rows={variant === "detail" ? 5 : 4}
          onChange={(event) => updateDraft(event.target.value)}
          onBlur={() => {
            if (hasNote || isAndroidNative) setIsEditing(false);
          }}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && hasNote) {
              setIsEditing(false);
            }
          }}
          placeholder="记录易错点、口诀、相似题差异或自己的理解；公式可写 $E=mc^2$"
        />
      ) : (
        <div
          className="note-preview note-preview-editable"
          role="button"
          tabIndex={0}
          title={isAndroidNative ? "双击编辑笔记" : "点击编辑笔记"}
          onClick={isAndroidNative ? undefined : openEditor}
          onDoubleClick={openEditor}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openEditor();
            }
          }}
        >
          {hasNote ? <RichText text={trimmedDraft} /> : <span className="note-empty-hint">双击添加笔记</span>}
        </div>
      )}
    </section>
  );
}

function QuestionImages({ question, variant = "question" }: { question: Question; variant?: "question" | "detail" }) {
  const imageUrls = getQuestionImageUrls(question);
  const [resolvedUrls, setResolvedUrls] = useState<string[]>([]);
  const [isResolvingImages, setIsResolvingImages] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (imageUrls.length === 0) {
      setResolvedUrls([]);
      setIsResolvingImages(false);
      return;
    }

    setIsResolvingImages(true);
    void Promise.all(imageUrls.map((url) => resolveQuestionImageUrl(url))).then((urls) => {
      if (!cancelled) {
        setResolvedUrls(urls.filter(Boolean));
        setIsResolvingImages(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setResolvedUrls([]);
        setIsResolvingImages(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [imageUrls.join("|")]);

  if (imageUrls.length === 0) return null;

  return (
    <div className={variant === "detail" ? "question-image-list detail-image-list" : "question-image-list"}>
      {resolvedUrls.length === 0 && <span className="question-image-loading">{isResolvingImages ? "图片加载中" : "图片加载失败"}</span>}
      {resolvedUrls.map((url, index) => (
        <img key={`${url}-${index}`} className="question-image" src={url} alt={`${question.uid} 配图 ${index + 1}`} loading="lazy" />
      ))}
    </div>
  );
}

export default App;
