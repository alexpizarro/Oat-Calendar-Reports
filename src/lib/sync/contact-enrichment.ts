import prisma from '@/lib/prisma';
import type { GHLClient } from '@/lib/ghl/client';
import { searchContactsByIds } from '@/lib/ghl/contacts';
import type { GHLContact } from '@/lib/ghl/types';

/** Returns a map of GHL contactId → internal Contact.id */
export async function enrichContacts(
  client: GHLClient,
  locationId: string,
  ghlContactIds: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (ghlContactIds.length === 0) return result;

  const unique = [...new Set(ghlContactIds)];

  // Check which are already fresh in DB (updated within 24h)
  const freshCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existing = await prisma.contact.findMany({
    where: {
      location_id: locationId,
      ghl_id: { in: unique },
      updated_at: { gte: freshCutoff },
    },
    select: { id: true, ghl_id: true },
  });

  for (const c of existing) {
    result.set(c.ghl_id, c.id);
  }

  const toFetch = unique.filter(id => !result.has(id));
  if (toFetch.length === 0) return result;

  // Batch fetch from GHL
  const fetched = await searchContactsByIds(client, locationId, toFetch);
  const fetchedSet = new Set(fetched.map(c => c.id));

  for (const contact of fetched) {
    const internal = await upsertContact(locationId, contact);
    result.set(contact.id, internal.id);
  }

  // Fallback: stale contacts not returned by search — use whatever is in DB
  const missed = toFetch.filter(id => !fetchedSet.has(id));
  if (missed.length > 0) {
    const stale = await prisma.contact.findMany({
      where: { location_id: locationId, ghl_id: { in: missed } },
      select: { id: true, ghl_id: true },
    });
    for (const c of stale) {
      result.set(c.ghl_id, c.id);
    }
  }

  return result;
}

export async function upsertContact(
  locationId: string,
  contact: GHLContact,
): Promise<{ id: string }> {
  const fullName = contact.name ?? ([contact.firstName, contact.lastName].filter(Boolean).join(' ') || null);

  const data = {
    name: fullName,
    email: contact.email ?? null,
    phone: contact.phone ?? null,
    tags_json: contact.tags ? JSON.stringify(contact.tags) : null,
    custom_fields_json: contact.customFields ? JSON.stringify(contact.customFields) : null,
    raw_json: JSON.stringify(contact),
  };

  const row = await prisma.contact.upsert({
    where: {
      location_id_ghl_id: { location_id: locationId, ghl_id: contact.id },
    },
    update: data,
    create: {
      location_id: locationId,
      ghl_id: contact.id,
      ...data,
    },
    select: { id: true },
  });

  return row;
}
