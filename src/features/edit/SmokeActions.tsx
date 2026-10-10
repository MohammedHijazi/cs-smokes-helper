import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useProgress } from "../../app/progress";
import { getMapData } from "../../data";
import type { MapInfo } from "../../data/maps";
import type { Lineup, MapFile } from "../../data/schema";
import {
  deleteConfirmText,
  deleteLineup,
  markReviewed,
  nextUnreviewed,
  upsertLineup,
} from "./mapEdits";
import { describeProblem, saveMap } from "./saveClient";
import styles from "./Edit.module.css";

export interface SmokeActionsProps {
  map: MapInfo;
  lineup: Lineup;
  /** The filtered list that ‹ › steps through. */
  list: readonly Lineup[];
  /** The map filters, as a query string. */
  search: string;
}

/** Spec §6: Mark reviewed, Edit and Delete on the smoke card (dev only). */
export function SmokeActions({ map, lineup, list, search }: SmokeActionsProps) {
  const navigate = useNavigate();
  const { today } = useProgress();
  const [message, setMessage] = useState<string | null>(null);
  const [reload, setReload] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save(next: MapFile, onSaved: () => void) {
    setBusy(true);
    setMessage(null);
    setReload(false);
    const outcome = await saveMap(map.id, next);
    setBusy(false);
    if (outcome.ok) onSaved();
    else {
      setMessage(describeProblem(outcome));
      setReload(outcome.kind === "changed");
    }
  }

  function markReviewedAndGoOn() {
    const target = nextUnreviewed(list, lineup.id);
    void save(upsertLineup(getMapData(map.id), markReviewed(lineup, today)), () => {
      if (target) navigate(`/maps/${map.id}/smokes/${target.id}${search}`);
      else setMessage("No unreviewed smokes left in this list.");
    });
  }

  function remove() {
    const deletion = deleteLineup(getMapData(map.id), lineup.id);
    if (!window.confirm(deleteConfirmText(lineup, deletion))) return;
    void save(deletion.file, () => navigate(`/maps/${map.id}${search}`));
  }

  return (
    <div className={styles.actions}>
      <button type="button" disabled={busy} onClick={markReviewedAndGoOn}>
        Mark reviewed
      </button>
      <Link to={`/maps/${map.id}/smokes/${lineup.id}/edit${search}`}>Edit</Link>
      <button type="button" disabled={busy} onClick={remove}>
        Delete
      </button>
      {message && <p role="status">{message}</p>}
      {reload && (
        <button type="button" onClick={() => window.location.reload()}>
          Reload
        </button>
      )}
    </div>
  );
}
