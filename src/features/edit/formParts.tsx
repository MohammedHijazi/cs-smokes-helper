import { useEffect } from "react";
import styles from "./Edit.module.css";

export function FieldErrors({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return <p className={styles.error}>{messages.join(" ")}</p>;
}

export interface Notice {
  message: string;
  /** Offer a Reload button (the map changed on disk). */
  reload: boolean;
}

/** Save problems that belong to no single field. */
export function FormNotice({ notice, errors }: { notice: Notice | null; errors?: string[] }) {
  if (!notice && (!errors || errors.length === 0)) return null;
  return (
    <div className={styles.notice} role="alert">
      {notice && <p>{notice.message}</p>}
      {errors?.map((message) => (
        <p key={message}>{message}</p>
      ))}
      {notice?.reload && (
        <button type="button" onClick={() => window.location.reload()}>
          Reload
        </button>
      )}
    </div>
  );
}

/** The browser's leave-page warning while a form has unsaved changes. */
export function useLeaveWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}
