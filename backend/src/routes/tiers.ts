import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase.js";
import { getActiveEvent } from "../lib/event.js";
import { requireDj } from "../middleware/requireDj.js";

export const tiersRouter = Router();

tiersRouter.post("/tiers", requireDj, async (req, res) => {
  const { name, amount } = req.body ?? {};
  if (typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 0) {
    res.status(400).json({ error: "amount must be a non-negative integer (cents)" });
    return;
  }

  const event = await getActiveEvent();

  const { count } = await supabaseAdmin
    .from("tiers")
    .select("id", { count: "exact", head: true })
    .eq("event_id", event.id);

  const { data, error } = await supabaseAdmin
    .from("tiers")
    .insert({ event_id: event.id, name: name.trim(), amount, sort_order: count ?? 0 })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(201).json({ tier: data });
});

tiersRouter.patch("/tiers/:id", requireDj, async (req, res) => {
  const { name, amount, sortOrder } = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (typeof name === "string" && name.trim()) updates.name = name.trim();
  if (typeof amount === "number" && Number.isInteger(amount) && amount >= 0) updates.amount = amount;
  if (typeof sortOrder === "number" && Number.isInteger(sortOrder)) updates.sort_order = sortOrder;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("tiers")
    .update(updates)
    .eq("id", String(req.params.id))
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ tier: data });
});

tiersRouter.delete("/tiers/:id", requireDj, async (req, res) => {
  const { error } = await supabaseAdmin.from("tiers").delete().eq("id", String(req.params.id));
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ deleted: true });
});
