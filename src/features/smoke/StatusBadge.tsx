import type { Status } from "../../data/schema";
import styles from "./StatusBadge.module.css";

const LABELS: Record<Status, string> = {
  unreviewed: "Unreviewed",
  ok: "Checked",
  broken: "Broken",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={styles.badge} data-status={status}>
      {LABELS[status]}
    </span>
  );
}
