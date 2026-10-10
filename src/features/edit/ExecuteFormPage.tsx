import { useId, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { NotFound } from "../../app/NotFound";
import { findExecute, getMapData, useDataVersion } from "../../data";
import { getMapInfo, hasLevels, type MapInfo } from "../../data/maps";
import {
  MAP_IDS,
  type Execute,
  type Level,
  type Lineup,
  type Position,
  type Side,
} from "../../data/schema";
import { filtersToSearch, parseFilters, searchWithTab, type Filters } from "../../lib/filters";
import { ExecuteMarkers } from "../executes/ExecuteMarkers";
import { LevelSwitch, Segmented } from "../map/FiltersBar";
import { MapFrame } from "../map/MapFrame";
import { Radar } from "../map/Radar";
import {
  draftFromExecute,
  emptyExecuteDraft,
  errorsForExecute,
  executeFromDraft,
  moved,
  type ExecuteDraft,
  type ExecuteErrors,
} from "./executeDraft";
import { FieldErrors, FormNotice, useLeaveWarning, type Notice } from "./formParts";
import { idsOnSide, newExecuteId, takenIds, upsertExecute } from "./mapEdits";
import { CHANGED_MESSAGE, saveMap } from "./saveClient";
import styles from "./Edit.module.css";

const SIDE_OPTIONS = [
  ["T", "T"],
  ["CT", "CT"],
] as const;
const MAX_SMOKES = 8;

/** #/maps/:mapId/executes/new and #/maps/:mapId/executes/:executeId/edit (dev only). */
export function ExecuteFormPage() {
  const { mapId = "", executeId } = useParams();
  const [params] = useSearchParams();
  useDataVersion();

  const map = getMapInfo(mapId);
  if (!map) return <NotFound />;
  const filters = parseFilters(params);
  const original = executeId ? findExecute(map.id, executeId) : undefined;
  if (executeId && !original) {
    const backTo = {
      href: `/maps/${map.id}${searchWithTab(filters, "executes")}`,
      label: `Back to ${map.name}`,
    };
    return <NotFound backTo={backTo} />;
  }
  return <ExecuteEditor key={executeId ?? "new"} map={map} original={original} filters={filters} />;
}

function ExecuteEditor({
  map,
  original,
  filters,
}: {
  map: MapInfo;
  original?: Execute;
  filters: Filters;
}) {
  const navigate = useNavigate();
  const fieldId = useId();
  const search = filtersToSearch(filters);
  const [draft, setDraft] = useState<ExecuteDraft>(() =>
    original
      ? draftFromExecute(original)
      : emptyExecuteDraft(filters.side === "all" ? "T" : filters.side),
  );
  const [initial] = useState(draft);
  const [openedAs] = useState(original);
  const [level, setLevel] = useState<Level>(filters.level);
  const [errors, setErrors] = useState<ExecuteErrors>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  useLeaveWarning(dirty);

  const data = getMapData(map.id);
  const withLevels = hasLevels(map);
  const id =
    original?.id ?? newExecuteId(map.id, draft.name, takenIds(MAP_IDS.map((m) => getMapData(m))));
  const byId = new Map(data.lineups.map((lineup) => [lineup.id, lineup]));
  const chosen = draft.lineupIds
    .map((lineupId) => byId.get(lineupId))
    .filter((lineup): lineup is Lineup => lineup !== undefined);
  const available = data.lineups.filter(
    (lineup) => lineup.side === draft.side && !draft.lineupIds.includes(lineup.id),
  );
  const isShown = (position: Position) => !withLevels || (position.level ?? "upper") === level;
  const viewHref = (executeId: string) => `/maps/${map.id}/executes/${executeId}${search}`;
  const backHref = original
    ? viewHref(original.id)
    : `/maps/${map.id}${searchWithTab(filters, "executes")}`;
  const set = (changes: Partial<ExecuteDraft>) =>
    setDraft((current) => ({ ...current, ...changes }));

  function changeSide(side: Side) {
    if (side === draft.side) return;
    const kept = idsOnSide(draft.lineupIds, side, data.lineups);
    const dropped = draft.lineupIds.length - kept.length;
    const question = `Changing the side removes ${dropped} ${dropped === 1 ? "smoke" : "smokes"} from the other side.`;
    if (dropped > 0 && !window.confirm(question)) return;
    set({ side, lineupIds: kept });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    if (original && JSON.stringify(original) !== JSON.stringify(openedAs)) {
      // A hand edit or git changed this item while the form was open (Fast Refresh keeps the form).
      setErrors({});
      setNotice({ message: CHANGED_MESSAGE, reload: true });
      return;
    }
    const next = upsertExecute(data, executeFromDraft(draft, id));
    inFlight.current = true;
    setSaving(true);
    try {
      const outcome = await saveMap(map.id, next);
      if (outcome.ok) {
        navigate(viewHref(id));
      } else if (outcome.kind === "invalid") {
        const index = next.executes.findIndex((execute) => execute.id === id);
        setErrors(errorsForExecute(outcome.errors, index));
        setNotice(null);
      } else {
        setErrors({});
        setNotice({ message: outcome.message, reload: outcome.kind === "changed" });
      }
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  function cancel() {
    if (dirty && !window.confirm("Discard changes?")) return;
    navigate(backHref);
  }

  return (
    <MapFrame
      map={map}
      controls={withLevels ? <LevelSwitch value={level} onSelect={setLevel} /> : undefined}
      radar={
        <Radar map={map} level={level} label={`${map.name} radar`}>
          <ExecuteMarkers lineups={chosen} isShown={isShown} />
        </Radar>
      }
      panel={
        <form
          className={styles.form}
          onSubmit={save}
          aria-label={original ? "Edit execute" : "Add execute"}
          noValidate
        >
          <h2>{original ? `Edit ${original.name}` : "Add execute"}</h2>
          <FormNotice notice={notice} errors={errors.form} />

          <div className={styles.field}>
            <label htmlFor={`${fieldId}-name`}>Name</label>
            <input
              id={`${fieldId}-name`}
              type="text"
              value={draft.name}
              autoFocus={!original}
              onChange={(event) => set({ name: event.target.value })}
            />
            <span className={styles.counter}>{draft.name.length}/40</span>
            <FieldErrors messages={errors.name} />
          </div>

          <div className={styles.field}>
            <Segmented
              label="Side"
              options={SIDE_OPTIONS}
              value={draft.side}
              onSelect={changeSide}
            />
            <FieldErrors messages={errors.side} />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Smokes, in throw order</span>
            <ol className={styles.steps} aria-label="Smokes in throw order">
              {draft.lineupIds.map((lineupId, index) => {
                const lineup = byId.get(lineupId);
                const name = lineup?.name ?? lineupId;
                return (
                  <li key={lineupId}>
                    <span className={styles.stepName}>
                      {index + 1}. {name}{" "}
                      {lineup && <span className={styles.hint}>· {lineup.from}</span>}
                    </span>
                    <button
                      type="button"
                      aria-label={`Move ${name} up`}
                      disabled={index === 0}
                      onClick={() => set({ lineupIds: moved(draft.lineupIds, index, -1) })}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${name} down`}
                      disabled={index === draft.lineupIds.length - 1}
                      onClick={() => set({ lineupIds: moved(draft.lineupIds, index, 1) })}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${name}`}
                      onClick={() =>
                        set({ lineupIds: draft.lineupIds.filter((other) => other !== lineupId) })
                      }
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ol>
            <select
              aria-label="Add smoke"
              value=""
              disabled={draft.lineupIds.length >= MAX_SMOKES || available.length === 0}
              onChange={(event) => {
                if (event.target.value)
                  set({ lineupIds: [...draft.lineupIds, event.target.value] });
              }}
            >
              <option value="">Add smoke…</option>
              {available.map((lineup) => (
                <option key={lineup.id} value={lineup.id}>
                  {lineup.name} · {lineup.from}
                </option>
              ))}
            </select>
            <FieldErrors messages={errors.lineupIds} />
          </div>

          <div className={styles.field}>
            <label htmlFor={`${fieldId}-notes`}>Notes</label>
            <textarea
              id={`${fieldId}-notes`}
              rows={3}
              value={draft.notes}
              onChange={(event) => set({ notes: event.target.value })}
            />
            <span className={styles.counter}>{draft.notes.length}/280</span>
            <FieldErrors messages={errors.notes} />
          </div>

          <p className={styles.hint}>
            Id: <code>{id}</code>
          </p>
          <div className={styles.buttons}>
            <button type="submit" className={styles.primary} disabled={saving}>
              Save
            </button>
            <button type="button" className={styles.secondary} onClick={cancel}>
              Cancel
            </button>
          </div>
        </form>
      }
    />
  );
}
