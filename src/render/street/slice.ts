/** Which streets have had the phase 3 street pass, and the switch that turns it off. No Three.js, so tests can read it. */

/** The streets rebuilt to the style guide so far. */
export const SLICE_LEVELS: readonly string[] = ['estate'];

/** `?street=classic` draws every street the old way: the fallback if the pass ever misbehaves on a device. */
export function streetPassEnabled(search: string): boolean {
  return new URLSearchParams(search).get('street') !== 'classic';
}
