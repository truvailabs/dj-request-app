import type { EventRow, RequestRow, TierRow } from "./types";

const API_URL = import.meta.env.VITE_API_URL as string;

export type CreateRequestPayload = {
  title: string;
  artist: string;
  bpm?: number | null;
  songId?: string | null;
  tierId?: string;
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
  return data as { request: RequestRow | null; clientSecret: string | null };
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

export async function createTier(name: string, amount: number, djToken: string) {
  const res = await fetch(`${API_URL}/tiers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${djToken}` },
    body: JSON.stringify({ name, amount }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to create tier");
  return data as { tier: TierRow };
}

export async function updateTier(
  id: string,
  updates: { name?: string; amount?: number; sortOrder?: number },
  djToken: string,
) {
  const res = await fetch(`${API_URL}/tiers/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${djToken}` },
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to update tier");
  return data as { tier: TierRow };
}

export async function deleteTier(id: string, djToken: string) {
  const res = await fetch(`${API_URL}/tiers/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${djToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to delete tier");
  return data as { deleted: true };
}

export async function updateEventSettings(paymentsEnabled: boolean, djToken: string) {
  const res = await fetch(`${API_URL}/event`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${djToken}` },
    body: JSON.stringify({ paymentsEnabled }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to update event settings");
  return data as { event: EventRow };
}
