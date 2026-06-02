// Minimal stub — original evidence store deleted in Phase C.
// Kept so that keep/shoehorn extensions (browser-extract-retention,
// evidence-compact) still compile. EvidenceAdd/EvidenceGet/EvidenceList
// tools are no longer registered; these extensions gracefully become
// no-ops.
export interface EvidenceEntry {
  id: string;
  source: string;
  note: string;
  snippet: string;
}

const _store: EvidenceEntry[] = [];

export function getSessionStore(): EvidenceEntry[] {
  return _store;
}
