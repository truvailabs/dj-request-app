import { Router } from "express";

export const itunesRouter = Router();

// Proxied server-side deliberately: on iOS Safari, itunes.apple.com/search
// redirects to a musics:// custom URL scheme (an app-handoff attempt), which
// browsers correctly refuse to follow as a cross-origin CORS redirect. That
// redirect behavior is iOS-Safari-specific — a plain Node fetch never hits it.
itunesRouter.get("/itunes-search", async (req, res) => {
  const term = typeof req.query.term === "string" ? req.query.term : "";
  if (!term.trim()) {
    res.json({ results: [] });
    return;
  }

  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=8`;
    const upstream = await fetch(url);
    if (!upstream.ok) {
      res.status(502).json({ error: `iTunes search failed (${upstream.status})` });
      return;
    }
    const data = (await upstream.json()) as {
      results?: { trackId: number; trackName: string; artistName: string }[];
    };
    const results = (data.results ?? []).map((r) => ({
      trackId: r.trackId,
      trackName: r.trackName,
      artistName: r.artistName,
    }));
    res.json({ results });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});
