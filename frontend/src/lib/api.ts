import type { RequestRow, Tier } from "./types";

const API_URL = import.meta.env.VITE_API_URL as string;

export type CreateRequestPayload = {
  title: string;
  artist: string;
  bpm?: number | null;
  songId?: string | null;
  tier: Tier;
  requesterName: string;
  vipCode?: string;
};

export async function createRequest(payload: CreateRequestPayload) {
  const res = await fetch(`${API_URL}/requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data as { request: RequestRow; clientSecret: string | null };
}

export async function decideSongGroup(
  songGroup: string,
  decision: "accept" | "reject",
  djToken: string,
) {
  const res = await fetch(`${API_URL}/requests/${songGroup}/${decision}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${djToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to update song group");
  return data as { updated: number };
}
