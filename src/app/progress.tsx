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
  defaultProgress,
  getBrowserStorage,
  loadProgress,
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
  const [initial] = useState(() => loadProgress(store, now()));
  const [progress, setProgress] = useState<Progress>(initial.progress);
  const [writeFailed, setWriteFailed] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    // The first run is the value we just loaded; only save real changes.
    if (!loaded.current) {
      loaded.current = true;
      return;
    }
    setWriteFailed(!saveProgress(store, progress));
  }, [progress, store]);

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

  const today = toLocalDate(now());
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
