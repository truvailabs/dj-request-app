import "dotenv/config";
import { readFileSync } from "node:fs";
import { supabaseAdmin } from "../src/lib/supabase.js";

const EVENT_NAME = "DJ Vibez - Fake Wedding";
const CSV_PATH = new URL("./setlist.csv", import.meta.url);

type Row = { title: string; artist: string; bpm: number | null };

function parseCsv(text: string): Row[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.toLowerCase().startsWith("title,"))
    .map((line) => {
      const [title, artist, bpm] = line.split(",").map((s) => s?.trim() ?? "");
      return { title, artist, bpm: bpm ? Number(bpm) : null };
    })
    .filter((r) => r.title && r.artist);
}

async function main() {
  const csv = readFileSync(CSV_PATH, "utf8");
  const rows = parseCsv(csv);
  if (rows.length === 0) throw new Error("setlist.csv has no valid rows (expected: title,artist,bpm)");

  const { data: event, error: eventError } = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("name", EVENT_NAME)
    .single();
  if (eventError || !event) throw new Error(`Event lookup failed: ${eventError?.message ?? "not found"}`);

  const { error: deleteError } = await supabaseAdmin.from("songs").delete().eq("event_id", event.id);
  if (deleteError) throw new Error(`Clearing old songs failed: ${deleteError.message}`);

  const { error: insertError } = await supabaseAdmin
    .from("songs")
    .insert(rows.map((r) => ({ ...r, event_id: event.id })));
  if (insertError) throw new Error(`Insert failed: ${insertError.message}`);

  console.log(`Replaced setlist with ${rows.length} songs for "${EVENT_NAME}".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
