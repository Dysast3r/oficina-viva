/**
 * Clima real de Santiago (Open-Meteo, sin clave) y momento del día según la
 * salida y puesta de sol. Lo consulta el servidor cada 10 minutos y lo
 * comparten la oficina (luz, lluvia) y el reloj del HUD.
 */

export interface Weather {
  /** °C */
  temp: number;
  /** Código WMO de Open-Meteo. */
  code: number;
  /** Minutos desde medianoche (hora de Chile). */
  sunrise: number;
  sunset: number;
  wind: number;
  /** Cuándo lo consultó el servidor (ms). */
  updated: number;
}

export type Sky = 'clear' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'storm' | 'snow';

/** Tipo de cielo para cada código WMO. */
export function skyOf(code: number): Sky {
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 2) return 'cloudy';
  return 'clear';
}

const LABEL: Record<Sky, string> = {
  clear: 'Despejado',
  cloudy: 'Nublado',
  fog: 'Neblina',
  drizzle: 'Llovizna',
  rain: 'Lluvia',
  storm: 'Tormenta',
  snow: 'Nieve',
};

export function weatherLabel(code: number): string {
  if (code === 1) return 'Mayormente despejado';
  if (code === 2) return 'Parcialmente nublado';
  return LABEL[skyOf(code)];
}

export function weatherIcon(code: number, night: boolean): string {
  const sky = skyOf(code);
  if (sky === 'clear') return night ? '🌙' : code === 1 ? '🌤️' : '☀️';
  if (sky === 'cloudy') return code === 2 ? (night ? '☁️' : '⛅') : '☁️';
  return { fog: '🌫️', drizzle: '🌦️', rain: '🌧️', storm: '⛈️', snow: '🌨️' }[sky];
}

export type DayPhase = 'night' | 'dawn' | 'day' | 'golden' | 'dusk';

/** Salida y puesta aproximadas (Santiago) para cuando aún no llega el clima. */
const FALLBACK_SUN: [number, number][] = [
  // [salida, puesta] en minutos, por mes (enero = 0), hora oficial de Chile.
  [6 * 60 + 50, 20 * 60 + 55], [7 * 60 + 15, 20 * 60 + 40], [7 * 60 + 40, 20 * 60 + 5], [7 * 60 + 5, 18 * 60 + 25],
  [7 * 60 + 30, 17 * 60 + 55], [7 * 60 + 45, 17 * 60 + 45], [7 * 60 + 45, 17 * 60 + 55], [7 * 60 + 25, 18 * 60 + 15],
  [7 * 60 + 15, 19 * 60 + 35], [6 * 60 + 50, 19 * 60 + 55], [6 * 60 + 30, 20 * 60 + 20], [6 * 60 + 30, 20 * 60 + 45],
];

export function sunTimes(w: Weather | null, month: number): { sunrise: number; sunset: number } {
  if (w) return { sunrise: w.sunrise, sunset: w.sunset };
  const [sunrise, sunset] = FALLBACK_SUN[month] ?? FALLBACK_SUN[0];
  return { sunrise, sunset };
}

/**
 * Momento del día: amanecer (±40 min de la salida), día, hora dorada (la
 * hora y media antes de la puesta), atardecer (40 min después) y noche.
 */
export function dayPhase(minutes: number, sunrise: number, sunset: number): DayPhase {
  if (minutes < sunrise - 40 || minutes >= sunset + 40) return 'night';
  if (minutes < sunrise + 40) return 'dawn';
  if (minutes >= sunset) return 'dusk';
  if (minutes >= sunset - 90) return 'golden';
  return 'day';
}
