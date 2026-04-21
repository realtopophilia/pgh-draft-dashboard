const KPIT_OBS = 'https://api.weather.gov/stations/KPIT/observations/latest';
const HOURLY   = 'https://api.weather.gov/gridpoints/PBZ/75,67/forecast/hourly';

function cToF(c: number | null): number | null {
  return c == null ? null : Math.round(c * 9 / 5 + 32);
}
function kmhToMph(k: number | null): number | null {
  return k == null ? null : Math.round(k * 0.621371);
}
function degreesToCompass(deg: number | null): string {
  if (deg == null) return '';
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg / 45) % 8];
}

export interface CurrentWeather {
  tempF: number | null;
  description: string;
  windMph: number | null;
  windDir: string;
  humidity: number | null;
  fetchedAt: number;
}

export interface DayForecast {
  label: string;   // "Thu Apr 23"
  highF: number;
  lowF: number;
  description: string;
  precipPct: number;
}

export interface WeatherData {
  current: CurrentWeather;
  draftDays: DayForecast[];   // April 23, 24, 25
}

export async function fetchWeather(): Promise<WeatherData> {
  const [obsRes, hourlyRes] = await Promise.all([
    fetch(KPIT_OBS,  { next: { revalidate: 600 } }),
    fetch(HOURLY,    { next: { revalidate: 600 } }),
  ]);

  if (!obsRes.ok)    throw new Error(`NWS obs ${obsRes.status}`);
  if (!hourlyRes.ok) throw new Error(`NWS hourly ${hourlyRes.status}`);

  const [obs, hourly] = await Promise.all([obsRes.json(), hourlyRes.json()]);
  const p = obs.properties;

  const current: CurrentWeather = {
    tempF:       cToF(p.temperature?.value),
    description: p.textDescription ?? '',
    windMph:     kmhToMph(p.windSpeed?.value),
    windDir:     degreesToCompass(p.windDirection?.value),
    humidity:    p.relativeHumidity?.value != null
                   ? Math.round(p.relativeHumidity.value)
                   : null,
    fetchedAt:   Date.now(),
  };

  // Summarize each Draft day from hourly periods
  const DRAFT_DATES = ['2026-04-23', '2026-04-24', '2026-04-25'];
  const LABELS      = ['Thu Apr 23', 'Fri Apr 24', 'Sat Apr 25'];
  const periods: typeof hourly.properties.periods = hourly.properties.periods ?? [];

  const draftDays: DayForecast[] = DRAFT_DATES.map((date, i) => {
    const dayPeriods = periods.filter((pd: { startTime: string }) =>
      pd.startTime.startsWith(date)
    );
    const temps   = dayPeriods.map((pd: { temperature: number }) => pd.temperature);
    const precips = dayPeriods.map((pd: { probabilityOfPrecipitation: { value: number | null } }) =>
      pd.probabilityOfPrecipitation?.value ?? 0
    );
    return {
      label:      LABELS[i],
      highF:      temps.length ? Math.max(...temps) : 0,
      lowF:       temps.length ? Math.min(...temps) : 0,
      description: dayPeriods[12]?.shortForecast   // ~noon period
                ?? dayPeriods[0]?.shortForecast
                ?? '',
      precipPct:  precips.length ? Math.max(...precips) : 0,
    };
  });

  return { current, draftDays };
}
