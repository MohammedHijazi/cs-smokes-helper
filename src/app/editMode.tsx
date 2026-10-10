import { lazy, Suspense, type ReactNode } from "react";

/**
 * Phase 2 edit mode, only under `npm run dev`. In builds Vite turns import.meta.env.DEV into
 * false and drops this branch with its lazy imports, so no edit code is published
 * (npm run check-bundle checks). Callers also test import.meta.env.DEV where they render, so
 * tests can switch edit mode off.
 */
export const Edit = import.meta.env.DEV
  ? {
      SmokeActions: lazy(() =>
        import("../features/edit/SmokeActions").then((m) => ({ default: m.SmokeActions })),
      ),
      SmokeFormPage: lazy(() =>
        import("../features/edit/SmokeFormPage").then((m) => ({ default: m.SmokeFormPage })),
      ),
    }
  : null;

/** Shows nothing while an edit component loads. */
export function EditBoundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
