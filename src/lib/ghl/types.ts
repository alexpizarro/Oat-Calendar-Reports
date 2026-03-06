// GoHighLevel API v2 response types
// Defensive typing: all fields optional unless confirmed always-present

export interface GHLCalendar {
  id: string;
  name: string;
  locationId: string;
  isActive?: boolean;
  description?: string;
  teamMembers?: unknown[];
  [key: string]: unknown;
}

export interface GHLCalendarsResponse {
  calendars?: GHLCalendar[];
}

export interface GHLCalendarEvent {
  id: string;
  calendarId?: string;
  locationId?: string;
  contactId?: string;
  startTime?: string;      // ISO string
  endTime?: string;        // ISO string
  dateAdded?: string;      // ISO string — used as booked_at
  status?: string;
  title?: string;
  appointmentStatus?: string;
  [key: string]: unknown;
}

export interface GHLEventsResponse {
  events?: GHLCalendarEvent[];
  meta?: {
    nextPageToken?: string;
    total?: number;
  };
}

export interface GHLContact {
  id: string;
  locationId?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  customFields?: Array<{ id: string; field_value: unknown }>;
  source?: string;
  dateAdded?: string;
  [key: string]: unknown;
}

export interface GHLContactSearchResponse {
  contacts: GHLContact[];
  meta?: {
    total?: number;
    nextPageToken?: string;
  };
}

export interface GHLAppointment {
  id: string;
  calendarId?: string;
  locationId?: string;
  contactId?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  appointmentStatus?: string;
  contact?: GHLContact;
  [key: string]: unknown;
}

export interface GHLAppointmentsResponse {
  appointments?: GHLAppointment[];
}

export interface GHLTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;       // seconds
  token_type: string;
  locationId?: string;
  companyId?: string;
  userId?: string;
}

export interface GHLBulkTagResponse {
  success?: boolean;
  updatedCount?: number;
  [key: string]: unknown;
}

export interface GHLTagResponse {
  tags?: string[];
  [key: string]: unknown;
}
