export function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function encodeSongGroup(title: string, artist: string): string {
  return Buffer.from(JSON.stringify({ title, artist }), "utf8").toString("base64url");
}

export function decodeSongGroup(param: string): { title: string; artist: string } {
  const parsed = JSON.parse(Buffer.from(param, "base64url").toString("utf8"));
  if (typeof parsed?.title !== "string" || typeof parsed?.artist !== "string") {
    throw new Error("Invalid song group param");
  }
  return parsed;
}
