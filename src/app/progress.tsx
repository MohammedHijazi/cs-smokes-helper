import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toLocalDate } from "../lib/dates";
import type { Rating } from "../lib/scheduler";
import {
  STORAGE_KEY,
  defaultProgress,
  getBrowserStorage,
  loadProgress,
  parseProgress,
  readStoredText,
  recordAnswer,
  saveProgress,
  type LoadStatus,
  type Progress,
  type ProgressSettings,
  type StorageLike,
} from "../lib/storage";

export interface ProgressContextValue {
  progress: Progress;
  /** "reset" means stored progress was unreadable; it was backed up and started again. */
  status: LoadStatus;
  /** True when progress can't be stored: no storage, or the last write failed. */
  cannotSave: boolean;
  /** The device's local date, YYYY-MM-DD. */
  today: string;
  answer(lineupId: string, rating: Rating): void;
  updateSettings(changes: Partial<ProgressSettings>): void;
  replace(progress: Progress): void;
  reset(): void;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);
const systemNow = () => new Date();

function msUntilNextMidnight(now: Date): number {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return midnight.getTime() - now.getTime();
}

export function ProgressProvider({
  children,
  storage,
  now = systemNow,
}: {
  children: ReactNode;
  /** Leave out to use the browser's localStorage. */
  storage?: StorageLike | null;
  now?: () => Date;
}) {
  const [store] = useState<StorageLike | null>(() =>
    storage === undefined ? getBrowserStorage() : storage,
  );
  const [initial] = useState(() => ({
    ...loadProgress(store, now()),
    text: readStoredText(store),
  }));
  const [progress, setProgress] = useState<Progress>(initial.progress);
  const [writeFailed, setWriteFailed] = useState(false);
  const [today, setToday] = useState(() => toLocalDate(now()));
  // What storage holds, as far as this tab knows: its text, and the progress object that was
  // read from or saved as that text. Progress that came from storage is never written back.
  const synced = useRef({ text: initial.text, progress: initial.progress });

  useEffect(() => {
    if (progress === synced.current.progress) return;
    const saved = saveProgress(store, progress);
    if (saved) synced.current = { text: readStoredText(store), progress };
    setWriteFailed(!saved);
  }, [progress, store]);

  // Another tab may have saved newer progress, and the date may have changed while the page
  // stayed open (a phone keeps it in memory overnight); catch up with both.
  useEffect(() => {
    let midnightTimer: ReturnType<typeof setTimeout> | undefined;

    const readStorage = () => {
      const text = readStoredText(store);
      if (text === null || text === synced.current.text) return;
      const next = parseProgress(text);
      if (!next) return; // Unreadable (another version?): keep this tab's progress.
      synced.current = { text, progress: next };
      setProgress(next);
    };
    const updateToday = () => setToday(toLocalDate(now()));
    const scheduleMidnight = () => {
      clearTimeout(midnightTimer);
      midnightTimer = setTimeout(() => {
        updateToday();
        scheduleMidnight();
      }, msUntilNextMidnight(now()));
    };
    const catchUp = () => {
      updateToday();
      readStorage();
      scheduleMidnight(); // Timers can be paused while the device sleeps.
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") catchUp();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) readStorage();
    };

    scheduleMidnight();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", catchUp);
    window.addEventListener("pageshow", catchUp);
    window.addEventListener("storage", onStorage);
    return () => {
      clearTimeout(midnightTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", catchUp);
      window.removeEventListener("pageshow", catchUp);
      window.removeEventListener("storage", onStorage);
    };
  }, [now, store]);

  const answer = useCallback(
    (lineupId: string, rating: Rating) =>
      setProgress((current) => recordAnswer(current, lineupId, rating, toLocalDate(now()))),
    [now],
  );
  const updateSettings = useCallback(
    (changes: Partial<ProgressSettings>) =>
      setProgress((current) => ({ ...current, settings: { ...current.settings, ...changes } })),
    [],
  );
  const replace = useCallback((next: Progress) => setProgress(next), []);
  const reset = useCallback(() => setProgress(defaultProgress()), []);

  const value = useMemo<ProgressContextValue>(
    () => ({
      progress,
      status: initial.status,
      cannotSave: store === null || initial.status === "unavailable" || writeFailed,
      today,
      answer,
      updateSettings,
      replace,
      reset,
    }),
    [progress, initial.status, store, writeFailed, today, answer, updateSettings, replace, reset],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const value = useContext(ProgressContext);
  if (!value) throw new Error("useProgress must be used inside <ProgressProvider>");
  return value;
}
