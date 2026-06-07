// Locale-aware display formatters shared across the reporter/dashboard UI, so the
// "X min ago" thresholds and the km² precision contract live in exactly one place
// (previously re-implemented in ActivityFeed, /me, the landing, and the confirm screen).
export function useFormatters() {
  const { t, locale } = useI18n()

  function relativeTime(iso: string): string {
    const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
    if (s < 60) return t('feedJustNow')
    if (s < 3600) return t('feedMinAgo', { n: Math.floor(s / 60) })
    if (s < 86400) return t('feedHrAgo', { n: Math.floor(s / 3600) })
    return t('feedDayAgo', { n: Math.floor(s / 86400) })
  }

  const km2 = (n: number) =>
    n.toLocaleString(locale.value, { minimumFractionDigits: 1, maximumFractionDigits: 2 })

  return { relativeTime, km2 }
}
