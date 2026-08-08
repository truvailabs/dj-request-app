export type ITunesResult = {
  trackId: number;
  trackName: string;
  artistName: string;
};

// Identification only — never persisted server-side. Just resolves a
// title/artist to write onto the request row.
export async function searchITunes(term: string): Promise<ITunesResult[]> {
  if (!term.trim()) return [];
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=8`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results ?? []).map((r: { trackId: number; trackName: string; artistName: string }) => ({
    trackId: r.trackId,
    trackName: r.trackName,
    artistName: r.artistName,
  }));
}
