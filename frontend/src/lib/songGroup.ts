import type { RequestRow, SongGroup } from "./types";

export function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

// Mirrors backend/src/lib/songGroup.ts — must stay in sync so accept/reject
// hits the same group the DJ is looking at.
export function encodeSongGroup(title: string, artist: string): string {
  const json = JSON.stringify({ title, artist });
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function groupRequests(requests: RequestRow[]): SongGroup[] {
  const groups = new Map<string, SongGroup>();

  for (const r of requests) {
    const key = `${normalize(r.title)}::${normalize(r.artist)}`;
    const existing = groups.get(key);
    if (existing) {
      existing.totalAmount += r.amount;
      existing.count += 1;
      existing.isVip = existing.isVip || r.is_vip;
      existing.requests.push(r);
    } else {
      groups.set(key, {
        key,
        title: r.title,
        artist: r.artist,
        bpm: r.bpm,
        isVip: r.is_vip,
        totalAmount: r.amount,
        count: 1,
        requests: [r],
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (a.isVip !== b.isVip) return a.isVip ? -1 : 1;
    if (b.totalAmount !== a.totalAmount) return b.totalAmount - a.totalAmount;
    return b.count - a.count;
  });
}
