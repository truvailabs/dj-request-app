export type ITunesResult = {
  trackId: number;
  trackName: string;
  artistName: string;
};

const API_URL = import.meta.env.VITE_API_URL as string;

// Proxied through our backend, not called directly from the browser: on iOS
// Safari, itunes.apple.com/search redirects to a musics:// custom URL scheme
// (an app-handoff attempt) that browsers refuse to follow cross-origin. Node
// never hits that redirect. Identification only — never persisted server-side.
export async function searchITunes(term: string): Promise<ITunesResult[]> {
  if (!term.trim()) return [];
  const res = await fetch(`${API_URL}/itunes-search?term=${encodeURIComponent(term)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `iTunes search failed (${res.status})`);
  }
  const data = await res.json();
  return data.results ?? [];
}
