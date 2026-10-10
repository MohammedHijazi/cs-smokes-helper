/** A deterministic random-number generator for tests: cycles through `values`. */
export function sequenceRng(...values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}
