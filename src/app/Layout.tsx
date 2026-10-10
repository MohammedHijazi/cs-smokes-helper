import { Link, Outlet } from "react-router";
import styles from "./Layout.module.css";

export const CREDITS =
  "Counter-Strike 2, map names and radar images © Valve Corporation. Videos © their creators. Not affiliated with Valve.";

export function Layout() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          CS Smokes
        </Link>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>{CREDITS}</footer>
    </div>
  );
}
