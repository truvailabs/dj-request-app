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

// Denormalized label snapshot of whatever tier was picked at request time —
// stays correct even if the tier is later renamed/deleted. See TierRow for
// the live, DJ-editable tier definitions.
export type Tier = string;

export type TierRow = {
  id: string;
  event_id: string;
  name: string;
  amount: number;
  sort_order: number;
  created_at: string;
};

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
