import { useState, type ChangeEvent } from "react";
import { useProgress } from "../../app/progress";
import {
  NEW_PER_DAY_MAX,
  NEW_PER_DAY_MIN,
  exportFileName,
  exportProgress,
  importProgress,
} from "../../lib/storage";
import styles from "./SettingsPage.module.css";

const isValidNewPerDay = (text: string) => {
  const value = Number(text);
  return (
    text.trim() !== "" &&
    Number.isInteger(value) &&
    value >= NEW_PER_DAY_MIN &&
    value <= NEW_PER_DAY_MAX
  );
};

export function SettingsPage() {
  const { progress, today, cannotSave, updateSettings, replace, reset } = useProgress();
  const [newPerDay, setNewPerDay] = useState(String(progress.settings.newPerDay));
  const [message, setMessage] = useState<string | null>(null);

  function changeNewPerDay(event: ChangeEvent<HTMLInputElement>) {
    const text = event.target.value;
    setNewPerDay(text);
    if (isValidNewPerDay(text)) updateSettings({ newPerDay: Number(text) });
  }

  function exportFile() {
    const url = URL.createObjectURL(
      new Blob([exportProgress(progress)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = exportFileName(today);
    link.click();
    // Revoking right after the click can cancel the download in some browsers (Safari).
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const result = importProgress(await file.text());
    input.value = "";
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    if (!window.confirm("Replace your current progress with the imported file?")) return;
    replace(result.progress);
    setNewPerDay(String(result.progress.settings.newPerDay));
    setMessage("Progress imported.");
  }

  function resetAll() {
    if (!window.confirm("Reset all study progress? This can't be undone.")) return;
    reset();
    setNewPerDay("10");
    setMessage("Progress reset.");
  }

  const invalid = !isValidNewPerDay(newPerDay);

  return (
    <section className={styles.page}>
      <h1>Settings</h1>
      {cannotSave && (
        <p className={styles.warning}>
          This browser can't save progress, so your settings and study progress last only until you
          close the page.
        </p>
      )}

      <label className={styles.field}>
        New smokes per day
        <input
          type="number"
          inputMode="numeric"
          min={NEW_PER_DAY_MIN}
          max={NEW_PER_DAY_MAX}
          value={newPerDay}
          onChange={changeNewPerDay}
          aria-invalid={invalid}
        />
      </label>
      {invalid && <p className={styles.hint}>Enter a whole number from 1 to 30.</p>}

      <div className={styles.actions}>
        <button type="button" onClick={exportFile}>
          Export progress
        </button>
        <label className={styles.fileButton}>
          Import progress
          <input type="file" accept="application/json,.json" onChange={importFile} />
        </label>
        <button type="button" onClick={resetAll} className={styles.danger}>
          Reset progress
        </button>
      </div>

      {message && <p role="status">{message}</p>}
    </section>
  );
}
