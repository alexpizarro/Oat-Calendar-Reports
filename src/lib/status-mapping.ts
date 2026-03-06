import type { StatusNorm, StatusMapping, LocationSettings } from '@/types/api';
import { DEFAULT_STATUS_MAPPINGS } from '@/types/api';

export function getStatusMappings(settingsJson: string | null | undefined): StatusMapping {
  if (!settingsJson) return DEFAULT_STATUS_MAPPINGS;

  try {
    const settings = JSON.parse(settingsJson) as Partial<LocationSettings>;
    return settings.statusMappings ?? DEFAULT_STATUS_MAPPINGS;
  } catch {
    return DEFAULT_STATUS_MAPPINGS;
  }
}

export function normalizeStatus(rawStatus: string | undefined | null, mappings: StatusMapping): StatusNorm {
  if (!rawStatus) return 'OTHER';
  const key = rawStatus.toLowerCase().trim();
  return mappings[key] ?? 'OTHER';
}

export function parseLocationSettings(settingsJson: string | null | undefined): LocationSettings {
  const defaults: LocationSettings = {
    statusMappings: DEFAULT_STATUS_MAPPINGS,
    defaultBackfillMonths: 12,
    incrementalWindowDays: 7,
    segmentationField: 'email_domain',
  };

  if (!settingsJson) return defaults;

  try {
    const parsed = JSON.parse(settingsJson) as Partial<LocationSettings>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}
