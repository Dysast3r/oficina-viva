import { useSyncExternalStore } from 'react';
import { bridge } from '../bridge';
import { api } from './store';
import type { Weather } from './weather';

/** Clima actual de Santiago, compartido por el HUD y la oficina. */
let current: Weather | null = null;
const listeners = new Set<() => void>();

export function getWeather(): Weather | null {
  return current;
}

export function useWeather(): Weather | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
  );
}

async function load(): Promise<void> {
  try {
    const r = await api<{ weather: Weather | null }>('weather');
    if (!r.weather || r.weather.updated === current?.updated) return;
    current = r.weather;
    listeners.forEach((fn) => fn());
    bridge.emit('weather', current);
  } catch {
    // Sin conexión: se mantiene el último clima conocido.
  }
}

/** Consulta el clima ahora y luego cada 10 minutos. Devuelve cómo detenerlo. */
export function startWeather(): () => void {
  void load();
  const id = window.setInterval(() => void load(), 10 * 60_000);
  return () => window.clearInterval(id);
}
