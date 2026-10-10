import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router";
import { useProgress } from "./progress";
import styles from "./Layout.module.css";

export const CREDITS =
  "Counter-Strike 2, map names and radar images © Valve Corporation. Videos © their creators. Not affiliated with Valve.";

export function Layout() {
  const { status, cannotSave } = useProgress();
  const [showResetNotice, setShowResetNotice] = useState(status === "reset");

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          CS Smokes
        </Link>
        <nav className={styles.nav} aria-label="Main">
          <NavLink to="/study">Study</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
      </header>
      {cannotSave && (
        <p className={styles.banner} role="status">
          Progress can't be saved in this browser.
        </p>
      )}
      {showResetNotice && (
        <p className={styles.banner} role="status">
          Your saved progress couldn't be read, so it was reset. A backup copy was kept in this
          browser.{" "}
          <button type="button" onClick={() => setShowResetNotice(false)}>
            Dismiss
          </button>
        </p>
      )}
      <main className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>{CREDITS}</footer>
    </div>
  );
}
