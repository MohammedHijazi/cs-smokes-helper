import { useId } from "react";
import { techniqueText } from "../../lib/technique";
import { parseYouTubeUrl } from "../../lib/youtube";
import { Segmented } from "../map/FiltersBar";
import { ClipTimer } from "./ClipTimer";
import { FieldErrors } from "./formParts";
import { clock, seconds, withUrl, type DraftErrors, type SmokeDraft } from "./smokeDraft";
import styles from "./Edit.module.css";

const SIDE_OPTIONS = [
  ["T", "T"],
  ["CT", "CT"],
] as const;
const AREA_OPTIONS = [
  ["A", "A"],
  ["B", "B"],
  ["Mid", "Mid"],
  ["Other", "Other"],
] as const;
const MOVEMENT_OPTIONS = [
  ["stand", "Stand"],
  ["crouch", "Crouch"],
  ["walk", "Walk"],
  ["run", "Run"],
] as const;
const CLICK_OPTIONS = [
  ["left", "Left"],
  ["right", "Right"],
  ["both", "Both"],
] as const;
const STATUS_OPTIONS = [
  ["unreviewed", "Unreviewed"],
  ["ok", "OK"],
  ["broken", "Broken"],
] as const;

export interface SmokeFieldsProps {
  draft: SmokeDraft;
  errors: DraftErrors;
  onChange: (next: SmokeDraft) => void;
  /** The id the smoke has, or will get when added. */
  idText: string;
  /** The last-checked date the save will write. */
  checkedOn: string;
  autoFocusLink: boolean;
}

/** The smoke form's fields, in the spec §5 order. Stand and land are placed on the radar. */
export function SmokeFields({
  draft,
  errors,
  onChange,
  idText,
  checkedOn,
  autoFocusLink,
}: SmokeFieldsProps) {
  const id = useId();
  const set = (changes: Partial<SmokeDraft>) => onChange({ ...draft, ...changes });
  const link = draft.url.trim();
  const youtube = parseYouTubeUrl(link);
  const start = seconds(draft.start);
  const end = seconds(draft.end);

  return (
    <>
      <div className={styles.field}>
        <label htmlFor={`${id}-url`}>Video link</label>
        <input
          id={`${id}-url`}
          type="url"
          value={draft.url}
          autoFocus={autoFocusLink}
          onChange={(event) => onChange(withUrl(draft, event.target.value))}
        />
        <FieldErrors messages={errors.url} />
      </div>

      {youtube ? (
        <>
          <ClipTimer
            key={youtube.id}
            videoId={youtube.id}
            initialStart={start ?? youtube.t ?? 0}
            start={start ?? youtube.t}
            end={end}
            onSetStart={(value) => set({ start: String(value) })}
            onSetEnd={(value) => set({ end: String(value) })}
          />
          <div className={styles.row}>
            <ClipField
              id={`${id}-start`}
              label="Start (s)"
              value={draft.start}
              errors={errors.start}
              onChange={(value) => set({ start: value })}
            />
            <ClipField
              id={`${id}-end`}
              label="End (s)"
              value={draft.end}
              errors={errors.end}
              onChange={(value) => set({ end: value })}
            />
          </div>
        </>
      ) : (
        link !== "" && (
          <p className={styles.hint}>
            Not a YouTube link, so there are no clip times.{" "}
            <a href={link} target="_blank" rel="noreferrer">
              Open video ↗
            </a>
          </p>
        )
      )}

      <TextField
        id={`${id}-name`}
        label="Name"
        value={draft.name}
        errors={errors.name}
        onChange={(value) => set({ name: value })}
      />
      <TextField
        id={`${id}-from`}
        label="From"
        value={draft.from}
        errors={errors.from}
        onChange={(value) => set({ from: value })}
      />

      <div className={styles.row}>
        <div className={styles.field}>
          <Segmented
            label="Side"
            options={SIDE_OPTIONS}
            value={draft.side}
            onSelect={(side) => set({ side })}
          />
          <FieldErrors messages={errors.side} />
        </div>
        <div className={styles.field}>
          <Segmented
            label="Area"
            options={AREA_OPTIONS}
            value={draft.area}
            onSelect={(area) => set({ area })}
          />
          <FieldErrors messages={errors.area} />
        </div>
      </div>

      <div className={styles.field}>
        <div className={styles.row}>
          <Segmented
            label="Movement"
            options={MOVEMENT_OPTIONS}
            value={draft.movement}
            onSelect={(movement) => set({ movement })}
          />
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={draft.jump}
              onChange={(event) => set({ jump: event.target.checked })}
            />
            Jump
          </label>
          <Segmented
            label="Click"
            options={CLICK_OPTIONS}
            value={draft.click}
            onSelect={(click) => set({ click })}
          />
        </div>
        <p className={styles.technique}>
          {techniqueText({ movement: draft.movement, jump: draft.jump, click: draft.click })}
        </p>
      </div>

      <div className={styles.field}>
        <p className={styles.hint}>
          Click the radar to place the land and stand spots; drag a spot to adjust it.
        </p>
        <FieldErrors messages={[...(errors.land ?? []), ...(errors.stand ?? [])]} />
      </div>

      <div className={styles.field}>
        <label htmlFor={`${id}-notes`}>Notes</label>
        <textarea
          id={`${id}-notes`}
          rows={3}
          value={draft.notes}
          onChange={(event) => set({ notes: event.target.value })}
        />
        <span className={styles.counter}>{draft.notes.length}/280</span>
        <FieldErrors messages={errors.notes} />
      </div>

      <div className={styles.row}>
        <Segmented
          label="Status"
          options={STATUS_OPTIONS}
          value={draft.status}
          onSelect={(status) => set({ status })}
        />
        <span className={styles.hint}>Last checked {checkedOn}</span>
      </div>
      <p className={styles.hint}>
        Id: <code>{idText}</code>
      </p>
    </>
  );
}

function TextField({
  id,
  label,
  value,
  errors,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  errors?: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="text" value={value} onChange={(event) => onChange(event.target.value)} />
      <span className={styles.counter}>{value.length}/40</span>
      <FieldErrors messages={errors} />
    </div>
  );
}

function ClipField({
  id,
  label,
  value,
  errors,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  errors?: string[];
  onChange: (value: string) => void;
}) {
  const parsed = seconds(value);
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {parsed !== undefined && <span className={styles.hint}>{clock(parsed)}</span>}
      <FieldErrors messages={errors} />
    </div>
  );
}
