export type EventRow = {
  id: string;
  name: string;
  itunes_search_enabled: boolean;
  public_queue_mode: "full" | "top3" | "hidden";
  payments_enabled: boolean;
  status: "active" | "ended";
  created_at: string;
};

export type SongRow = {
  id: string;
  event_id: string;
  title: string;
  artist: string;
  bpm: number | null;
  created_at: string;
};

export type Tier = "free" | "boost" | "front";

export type RequestRow = {
  id: string;
  event_id: string;
  song_id: string | null;
  title: string;
  artist: string;
  bpm: number | null;
  tier: Tier;
  amount: number;
  is_vip: boolean;
  status: "pending" | "accepted" | "rejected" | "expired";
  created_at: string;
  // Only present for the DJ (authenticated) column grant, not for anon.
  requester_name?: string;
  stripe_payment_intent_id?: string | null;
};

export type SongGroup = {
  key: string;
  title: string;
  artist: string;
  bpm: number | null;
  isVip: boolean;
  totalAmount: number;
  count: number;
  requests: RequestRow[];
};
