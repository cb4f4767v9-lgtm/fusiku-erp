import type { InstituteEnrollment } from '../services/api';

/** Prefer an “active” enrollment; otherwise most recently enrolled. */
export function pickPrimaryEnrollment(
  all: InstituteEnrollment[],
  studentId: string
): InstituteEnrollment | null {
  const rows = all.filter((e) => e.studentId === studentId);
  if (rows.length === 0) return null;
  const rank = (s: string) => {
    const x = String(s || '').toLowerCase();
    if (x === 'active') return 0;
    return 1;
  };
  return [...rows].sort((a, b) => {
    const d = rank(a.status) - rank(b.status);
    if (d !== 0) return d;
    return new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime();
  })[0];
}

export function formatTimingSlot(
  slot: string | null | undefined,
  label: string | null | undefined,
  t: (k: string) => string
): string {
  if (label?.trim()) return label.trim();
  const k = String(slot || '').toLowerCase();
  if (k === 'morning') return t('institute.timingMorning');
  if (k === 'evening') return t('institute.timingEvening');
  if (k === 'weekend') return t('institute.timingWeekend');
  return slot?.trim() || '—';
}
