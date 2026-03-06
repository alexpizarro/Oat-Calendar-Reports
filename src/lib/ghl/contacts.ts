import type { GHLClient } from './client';
import type {
  GHLContact,
  GHLContactSearchResponse,
  GHLAppointmentsResponse,
  GHLBulkTagResponse,
  GHLTagResponse,
} from './types';

const SEARCH_BATCH_SIZE = 100;

export async function searchContactsByIds(
  client: GHLClient,
  locationId: string,
  contactIds: string[],
): Promise<GHLContact[]> {
  const all: GHLContact[] = [];

  for (let i = 0; i < contactIds.length; i += SEARCH_BATCH_SIZE) {
    const batch = contactIds.slice(i, i + SEARCH_BATCH_SIZE);

    try {
      const res = await client.post<GHLContactSearchResponse>('/contacts/search', {
        locationId,
        page: 1,
        pageLimit: SEARCH_BATCH_SIZE,
        filters: [{ field: 'id', operator: 'in', value: batch }],
      });
      all.push(...(res.contacts ?? []));
    } catch (e) {
      console.error(`[contacts] searchContactsByIds batch ${i} failed:`, e);
    }
  }

  return all;
}

export async function getContactAppointments(
  client: GHLClient,
  contactId: string,
): Promise<GHLAppointmentsResponse> {
  return client.get<GHLAppointmentsResponse>(`/contacts/${contactId}/appointments`);
}

export async function addTagsToContact(
  client: GHLClient,
  contactId: string,
  tags: string[],
): Promise<GHLTagResponse> {
  return client.post<GHLTagResponse>(`/contacts/${contactId}/tags`, { tags });
}

export async function bulkUpdateTags(
  client: GHLClient,
  locationId: string,
  contactIds: string[],
  tags: string[],
  action: 'add' | 'remove',
): Promise<GHLBulkTagResponse> {
  return client.post<GHLBulkTagResponse>(`/contacts/bulk/tags/update/${action}`, {
    locationId,
    contactIds,
    tags,
  });
}
