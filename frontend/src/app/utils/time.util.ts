/** Format backend wall-time without JS Date timezone shift. */
export function formatWallTime(dt: string | null | undefined): string {
  if (!dt) return '—';
  const s = dt.toString();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (m) {
    const d = new Date(m[1] + 'T00:00:00Z');
    const mon = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    const day = m[1].slice(8, 10);
    return `${mon} ${day} ${m[2]}`;
  }
  const t = s.split('T')[1] || s.split(' ')[1] || s;
  return t.substring(0, 5);
}

export function formatBrokerTime(dt: string | null | undefined): string {
  if (!dt) return '—';
  const s = dt.toString();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (m) {
    const d = new Date(m[1] + 'T00:00:00Z');
    const mon = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    const day = m[1].slice(8, 10);
    return `${mon} ${day} ${m[2]}`;
  }
  return s;
}

/** Human-readable age for health cards (minutes from backend). */
export function formatAgeMinutes(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return '—';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 24 * 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
  }
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  return hours > 0 ? `${days}d ${hours}h ago` : `${days}d ago`;
}
