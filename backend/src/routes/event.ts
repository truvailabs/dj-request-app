import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase.js";
import { getActiveEvent, invalidateEventCache } from "../lib/event.js";
import { requireDj } from "../middleware/requireDj.js";

export const eventRouter = Router();

eventRouter.patch("/event", requireDj, async (req, res) => {
  const { paymentsEnabled } = req.body ?? {};
  if (typeof paymentsEnabled !== "boolean") {
    res.status(400).json({ error: "paymentsEnabled must be a boolean" });
    return;
  }

  const event = await getActiveEvent();
  const { data, error } = await supabaseAdmin
    .from("events")
    .update({ payments_enabled: paymentsEnabled })
    .eq("id", event.id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  invalidateEventCache();
  res.json({ event: data });
});
