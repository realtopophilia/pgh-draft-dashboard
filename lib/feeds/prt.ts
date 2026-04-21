import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { inBounds } from '@/lib/bounds';

export type VehicleType = 'bus' | 'train';

export interface TransitVehicle {
  id: string;
  type: VehicleType;
  lat: number;
  lon: number;
  bearing: number;
  speed: number;       // m/s from feed
  speedMph: number;   // converted for display
  route: string;
  label: string;       // human-readable vehicle number
  timestamp: number;   // unix seconds
}

const BUS_URL = 'https://truetime.portauthority.org/gtfsrt-bus/vehicles';
const TRAIN_URL = 'https://truetime.portauthority.org/gtfsrt-train/vehicles';

async function fetchFeed(url: string, type: VehicleType): Promise<TransitVehicle[]> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`PRT ${type} feed returned ${res.status}`);

  const buffer = await res.arrayBuffer();
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
    new Uint8Array(buffer)
  );

  return feed.entity
    .filter((e) => e.vehicle?.position != null)
    .map((e) => {
      const pos = e.vehicle!.position!;
      const veh = e.vehicle!;
      const speedMs = pos.speed ?? 0;
      return {
        id: e.id,
        type,
        lat: pos.latitude,
        lon: pos.longitude,
        bearing: pos.bearing ?? 0,
        speed: speedMs,
        speedMph: Math.round(speedMs * 2.237),
        route: veh.trip?.routeId || '',
        label: veh.vehicle?.label || veh.vehicle?.id || e.id,
        // protobuf Long → number
        timestamp: typeof veh.timestamp === 'object'
          ? (veh.timestamp as { low: number }).low
          : (veh.timestamp as number) ?? 0,
      };
    })
    .filter((v) => inBounds(v.lat, v.lon));
}

export async function fetchAllVehicles(): Promise<TransitVehicle[]> {
  const [buses, trains] = await Promise.allSettled([
    fetchFeed(BUS_URL, 'bus'),
    fetchFeed(TRAIN_URL, 'train'),
  ]);

  const result: TransitVehicle[] = [];
  if (buses.status === 'fulfilled') result.push(...buses.value);
  if (trains.status === 'fulfilled') result.push(...trains.value);
  return result;
}
