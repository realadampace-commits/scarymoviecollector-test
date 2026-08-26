const rangesInDays = { '1W': 7, '1M': 31, '3M': 92, '6M': 183, '1Y': 365 };

export function buildPortfolioHistory(items) {
  let total = 0;
  return [...(items ?? [])]
    .filter((item) => item.user_value !== null
      && item.user_value !== undefined
      && (typeof item.user_value !== 'string' || item.user_value.trim() !== '')
      && Number.isFinite(new Date(item.created_at).getTime())
      && Number.isFinite(Number(item.user_value))
      && Number(item.user_value) >= 0)
    .sort((left, right) => new Date(left.created_at) - new Date(right.created_at))
    .map((item) => {
      total += Number(item.user_value);
      return { at: item.created_at, value: total };
    });
}

export function selectPortfolioRange(history, range, now = new Date()) {
  if (range === 'ALL' || !rangesInDays[range]) return [...history];
  const cutoff = now.getTime() - rangesInDays[range] * 24 * 60 * 60 * 1000;
  const firstInRange = history.findIndex((point) => new Date(point.at).getTime() >= cutoff);
  if (firstInRange === -1) return history.length ? [history.at(-1)] : [];
  return history.slice(Math.max(0, firstInRange - 1));
}
