import { Link } from "react-router";
import styles from "./NotFound.module.css";

export interface BackLink {
  href: string;
  label: string;
}

export function NotFound({ backTo = { href: "/", label: "Back to maps" } }: { backTo?: BackLink }) {
  return (
    <section className={styles.page}>
      <h1>Not found</h1>
      <p>That page doesn't exist. It may have been renamed or removed.</p>
      <Link to={backTo.href}>{backTo.label}</Link>
    </section>
  );
}
