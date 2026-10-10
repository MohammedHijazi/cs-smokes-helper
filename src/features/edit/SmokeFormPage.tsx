import { useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { NotFound } from "../../app/NotFound";
import { useProgress } from "../../app/progress";
import { findLineup, getMapData, useDataVersion } from "../../data";
import { getMapInfo, hasLevels, type MapInfo } from "../../data/maps";
import { MAP_IDS, type Level, type Lineup, type Position } from "../../data/schema";
import { filtersToSearch, parseFilters, type Filters } from "../../lib/filters";
import { LevelSwitch, Segmented } from "../map/FiltersBar";
import { MapFrame } from "../map/MapFrame";
import { FormNotice, useLeaveWarning, type Notice } from "./formParts";
import { newLineupId, takenIds, upsertLineup } from "./mapEdits";
import { PlacementRadar, type Spot } from "./PlacementRadar";
import { CHANGED_MESSAGE, saveMap } from "./saveClient";
import { SmokeFields } from "./SmokeFields";
import {
  draftFromLineup,
  emptyDraft,
  errorsForDraft,
  lineupFromDraft,
  type DraftErrors,
  type SmokeDraft,
} from "./smokeDraft";
import styles from "./Edit.module.css";

const PLACING_OPTIONS = [
  ["land", "Land"],
  ["stand", "Stand"],
] as const;

/** #/maps/:mapId/smokes/new and #/maps/:mapId/smokes/:lineupId/edit (dev only). */
export function SmokeFormPage() {
  const { mapId = "", lineupId } = useParams();
  const [params] = useSearchParams();
  useDataVersion();

  const map = getMapInfo(mapId);
  if (!map) return <NotFound />;
  const filters = parseFilters(params);
  const original = lineupId ? findLineup(map.id, lineupId) : undefined;
  if (lineupId && !original) {
    const backTo = {
      href: `/maps/${map.id}${filtersToSearch(filters)}`,
      label: `Back to ${map.name}`,
    };
    return <NotFound backTo={backTo} />;
  }
  return <SmokeEditor key={lineupId ?? "new"} map={map} original={original} filters={filters} />;
}

function SmokeEditor({
  map,
  original,
  filters,
}: {
  map: MapInfo;
  original?: Lineup;
  filters: Filters;
}) {
  const navigate = useNavigate();
  const { today } = useProgress();
  const search = filtersToSearch(filters);
  const [draft, setDraft] = useState<SmokeDraft>(() =>
    original
      ? draftFromLineup(original)
      : emptyDraft({
          side: filters.side === "all" ? undefined : filters.side,
          area: filters.area === "all" ? undefined : filters.area,
        }),
  );
  const [initial] = useState(draft);
  const [openedAs] = useState(original);
  const [active, setActive] = useState<Spot>("land");
  const [level, setLevel] = useState<Level>(original?.land.level ?? filters.level);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  useLeaveWarning(dirty);

  const data = getMapData(map.id);
  const id =
    original?.id ??
    newLineupId(map.id, draft.name, draft.from, takenIds(MAP_IDS.map((m) => getMapData(m))));
  const checkedOn = original && original.status === draft.status ? original.checkedOn : today;
  const cardHref = (lineupId: string) => `/maps/${map.id}/smokes/${lineupId}${search}`;
  const backHref = original ? cardHref(original.id) : `/maps/${map.id}${search}`;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    if (original && JSON.stringify(original) !== JSON.stringify(openedAs)) {
      // A hand edit or git changed this item while the form was open (Fast Refresh keeps the form).
      setErrors({});
      setNotice({ message: CHANGED_MESSAGE, reload: true });
      return;
    }
    const built = lineupFromDraft(draft, { id, original, today });
    if (!built.ok) {
      setErrors(built.errors);
      setNotice(null);
      return;
    }
    const next = upsertLineup(data, built.lineup);
    inFlight.current = true;
    setSaving(true);
    try {
      const outcome = await saveMap(map.id, next);
      if (outcome.ok) {
        navigate(cardHref(id));
      } else if (outcome.kind === "invalid") {
        const index = next.lineups.findIndex((lineup) => lineup.id === id);
        setErrors(errorsForDraft(outcome.errors, index, next));
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

  function place(spot: Spot, position: Position) {
    setDraft((current) =>
      spot === "land" ? { ...current, land: position } : { ...current, stand: position },
    );
  }

  return (
    <MapFrame
      map={map}
      controls={
        <div className={styles.controls}>
          <Segmented
            label="Placing"
            options={PLACING_OPTIONS}
            value={active}
            onSelect={setActive}
          />
          {hasLevels(map) && <LevelSwitch value={level} onSelect={setLevel} />}
        </div>
      }
      radar={
        <>
          <PlacementRadar
            map={map}
            level={level}
            side={draft.side ?? "T"}
            stand={draft.stand}
            land={draft.land}
            active={active}
            context={data.lineups.filter((lineup) => lineup.id !== original?.id)}
            onPlace={place}
            onRelease={(spot) => {
              // Spec §5: on Add, Stand becomes active once Land is placed.
              if (!original && spot === "land" && draft.stand === null) setActive("stand");
            }}
          />
          <p className={styles.coords}>
            Land {positionText(draft.land)} · Stand {positionText(draft.stand)}
          </p>
        </>
      }
      panel={
        <form
          className={styles.form}
          onSubmit={save}
          aria-label={original ? "Edit smoke" : "Add smoke"}
          noValidate
        >
          <h2>{original ? `Edit ${original.name}` : "Add smoke"}</h2>
          <FormNotice notice={notice} errors={errors.form} />
          <SmokeFields
            draft={draft}
            errors={errors}
            onChange={setDraft}
            idText={id}
            checkedOn={checkedOn}
            autoFocusLink={!original}
          />
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

function positionText(position: Position | null): string {
  if (!position) return "not placed";
  const text = `${position.x.toFixed(3)}, ${position.y.toFixed(3)}`;
  return position.level ? `${text} (${position.level})` : text;
}
