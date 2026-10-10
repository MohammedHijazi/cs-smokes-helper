import { hasLevels, type MapInfo } from "../../data/maps";
import type { Filters } from "../../lib/filters";
import styles from "./MapPage.module.css";

const SIDE_OPTIONS = [
  ["all", "All"],
  ["T", "T"],
  ["CT", "CT"],
] as const;
const AREA_OPTIONS = [
  ["all", "All"],
  ["A", "A"],
  ["B", "B"],
  ["Mid", "Mid"],
  ["Other", "Other"],
] as const;
const LEVEL_OPTIONS = [
  ["upper", "Upper"],
  ["lower", "Lower"],
] as const;

export function FiltersBar({
  map,
  filters,
  onChange,
}: {
  map: MapInfo;
  filters: Filters;
  onChange: (next: Filters) => void;
}) {
  return (
    <div className={styles.filters}>
      <Segmented
        label="Side"
        options={SIDE_OPTIONS}
        value={filters.side}
        onSelect={(side) => onChange({ ...filters, side })}
      />
      <Segmented
        label="Area"
        options={AREA_OPTIONS}
        value={filters.area}
        onSelect={(area) => onChange({ ...filters, area })}
      />
      {hasLevels(map) && (
        <Segmented
          label="Level"
          options={LEVEL_OPTIONS}
          value={filters.level}
          onSelect={(level) => onChange({ ...filters, level })}
        />
      )}
    </div>
  );
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onSelect,
}: {
  label: string;
  options: readonly (readonly [T, string])[];
  value: T;
  onSelect: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className={styles.segmented}>
      {options.map(([option, text]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onSelect(option)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
