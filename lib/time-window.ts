const MS_PER_DAY = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function getKstDayRange(base = new Date()) {
  const baseMs = base.getTime();
  const kstMs = baseMs + KST_OFFSET_MS;
  const kstDayStartMs = Math.floor(kstMs / MS_PER_DAY) * MS_PER_DAY;

  const start = new Date(kstDayStartMs - KST_OFFSET_MS);
  const end = new Date(kstDayStartMs + MS_PER_DAY - KST_OFFSET_MS);

  return { start, end };
}
