import { render } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { AppRoutes } from "../app/AppRoutes";
import { ProgressProvider } from "../app/progress";
import type { StorageLike } from "../lib/storage";
import { memoryStorage } from "./memoryStorage";

/** Renders the router's current path and query so tests can check navigation. */
export function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

export interface RenderOptions {
  /** Defaults to fresh in-memory storage; pass null to simulate a browser without storage. */
  storage?: StorageLike | null;
  now?: () => Date;
}

/** Renders the whole app at `path`, with an in-memory router and progress provider. */
export function renderAt(path: string, { storage = memoryStorage(), now }: RenderOptions = {}) {
  return render(
    <ProgressProvider storage={storage} now={now}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
        <LocationProbe />
      </MemoryRouter>
    </ProgressProvider>,
  );
}
