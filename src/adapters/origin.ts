/**
 * Origen actual de la URL, leído en runtime desde el navegador.
 * Nunca se hardcodea el dominio de despliegue.
 *
 * Expuesto como snapshots de useSyncExternalStore: el de servidor ("") se
 * usa en el prerender y la primera hidratación, luego React toma el del
 * navegador sin advertencias de mismatch.
 */
export const subscribeOrigin = () => () => {};

export function originSnapshot(): string {
  return typeof window === "undefined" ? "" : window.location.origin;
}

export function originServerSnapshot(): string {
  return "";
}
