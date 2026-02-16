export type TopicKind = "BETTING" | "POLL";

export function parseTopicKindFromTitle(title: string): TopicKind {
  const normalized = title.trim().toUpperCase();
  if (normalized.startsWith("[POLL]")) return "POLL";
  return "BETTING";
}

export function ensureTopicPrefix(kind: TopicKind, title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return trimmed;

  if (/^\[(BETTING|POLL)\]\s*/i.test(trimmed)) {
    return trimmed.replace(/^\[(BETTING|POLL)\]\s*/i, `[${kind}] `).trim();
  }

  return `[${kind}] ${trimmed}`;
}
