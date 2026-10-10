/** Resolves a path under public/ against Vite's base ("./" in production). */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}
