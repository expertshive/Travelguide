import { authorizedRequest } from './auth';
import type { LatLng } from './map';

export type HeritageSite = {
  id: string;
  name: string;
  address: string;
  center: LatLng;
  category: string;
  routeDistanceMeters: number;
  originDistanceMeters: number | null;
  alongIndex: number;
  side: 'left' | 'right' | 'along';
  visitable: boolean;
  openNow: boolean | null;
  hoursSummary: string | null;
  visitMinutes: { min: number; max: number };
  ageLabel: string | null;
  ageSource: 'verified' | 'estimated' | 'unknown';
  whyImportant: string;
  story: string;
  storyLong: string | null;
  source: 'wikipedia' | 'maps';
};

export function fetchHeritageAlongRoute(input: {
  geometry: LatLng[];
  radiusMeters: number;
  origin?: LatLng;
}): Promise<HeritageSite[]> {
  return authorizedRequest<HeritageSite[]>('/map/heritage/along-route', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function toPlace(site: HeritageSite) {
  return {
    id: site.id,
    name: site.name,
    address: site.address,
    center: site.center,
    category: site.category,
  };
}

export function sideLabel(side: HeritageSite['side']): string {
  if (side === 'left') return 'on your left';
  if (side === 'right') return 'on your right';
  return 'along the road';
}

export function approachNarration(site: HeritageSite, meters: number, distanceFn: (n: number) => string): string {
  const side = sideLabel(site.side);
  const age =
    site.ageLabel && site.ageSource !== 'unknown'
      ? site.ageSource === 'estimated'
        ? ` Estimated date: ${site.ageLabel}.`
        : ` ${site.ageLabel}.`
      : '';
  const access =
    site.openNow === false
      ? ' It may be closed right now.'
      : ' It is accessible to visitors.';
  return (
    `In about ${distanceFn(meters)}, you'll pass ${site.name}, ${side}. ` +
    `${site.story}${site.story.endsWith('.') ? '' : '.'}` +
    age +
    access +
    ` If you'd like to explore it, I can add a ${site.visitMinutes.min} to ${site.visitMinutes.max} minute stop. Say add it, skip, or tell me more.`
  );
}
