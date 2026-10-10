import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { getMapData } from "../../data";
import type { MapInfo } from "../../data/maps";
import type { Execute } from "../../data/schema";
import { deleteExecute } from "./mapEdits";
import { describeProblem, saveMap } from "./saveClient";
import styles from "./Edit.module.css";

export interface ExecuteActionsProps {
  map: MapInfo;
  execute: Execute;
  /** The map filters, as a query string. */
  search: string;
  /** The map view's Executes tab, where a deleted execute's page goes back to. */
  listHref: string;
}

/** Spec §6: Edit and Delete on the execute view (dev only). */
export function ExecuteActions({ map, execute, search, listHref }: ExecuteActionsProps) {
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!window.confirm(`Delete the execute '${execute.name}'? Its smokes are kept.`)) return;
    setBusy(true);
    setMessage(null);
    const outcome = await saveMap(map.id, deleteExecute(getMapData(map.id), execute.id));
    setBusy(false);
    if (outcome.ok) navigate(listHref);
    else setMessage(describeProblem(outcome));
  }

  return (
    <div className={styles.actions}>
      <Link to={`/maps/${map.id}/executes/${execute.id}/edit${search}`}>Edit</Link>
      <button type="button" disabled={busy} onClick={() => void remove()}>
        Delete
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
