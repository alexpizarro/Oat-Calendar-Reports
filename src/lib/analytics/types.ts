export interface SummaryMetrics {
  totalBookings: number;
  attended: number;
  noShow: number;
  cancelled: number;
  other: number;
  attendanceRate: number; // attended / (attended + noShow), 0 if no data
}

export interface TrendPoint {
  date: string; // YYYY-MM-DD or YYYY-WXX
  bookings: number;
  attended: number;
  noShow: number;
  cancelled: number;
}

export interface CalendarPopularity {
  calendarId: string;
  calendarName: string;
  bookings: number;
  attended: number;
}

export interface HeatmapCell {
  dayOfWeek: number; // 0=Sunday, 1=Monday, … 6=Saturday
  hourOfDay: number; // 0-23
  count: number;
}

export interface LeadTimeBucket {
  bucket: 'under_24h' | '24_48h' | '3_7d' | '8_14d' | '15_30d' | '30d_plus';
  count: number;
}

export interface SegmentRow {
  value: string;
  bookings: number;
  attended: number;
  noShow: number;
  cancelled: number;
  attendanceRate: number;
  avgLeadTimeHours: number | null;
}

export interface ContactAppointmentSummary {
  contactId: string;
  contactName: string | null;
  email: string | null;
  totalBookings: number;
  attended: number;
  noShow: number;
  cancelled: number;
  lastAppointment: string | null;
}
