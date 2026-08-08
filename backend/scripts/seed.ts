import "dotenv/config";
import { supabaseAdmin } from "../src/lib/supabase.js";

const EVENT_NAME = "DJ Vibez - Fake Wedding";
const VIP_CODE = "djvibez2026";
const DJ_EMAIL = "me@veddave.com";
const DJ_PASSWORD = "batman";

const SEED_SONGS = [
  { title: "Blinding Lights", artist: "The Weeknd", bpm: 171 },
  { title: "Levitating", artist: "Dua Lipa", bpm: 103 },
  { title: "Uptown Funk", artist: "Mark Ronson ft. Bruno Mars", bpm: 115 },
  { title: "Don't Start Now", artist: "Dua Lipa", bpm: 124 },
  { title: "24K Magic", artist: "Bruno Mars", bpm: 107 },
];

async function main() {
  const { data: existing, error: findError } = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("name", EVENT_NAME)
    .maybeSingle();
  if (findError) throw new Error(`Lookup failed: ${findError.message}`);

  let eventId = existing?.id as string | undefined;

  if (!eventId) {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("events")
      .insert({
        name: EVENT_NAME,
        vip_code: VIP_CODE,
        itunes_search_enabled: true,
        public_queue_mode: "top3",
        payments_enabled: false,
        status: "active",
      })
      .select("id")
      .single();
    if (insertError) throw new Error(`Insert event failed: ${insertError.message}`);
    eventId = inserted.id;
    console.log(`Created event ${EVENT_NAME} (${eventId})`);
  } else {
    console.log(`Event already exists (${eventId}), leaving as-is`);
  }

  const { data: existingSongs, error: songsError } = await supabaseAdmin
    .from("songs")
    .select("id")
    .eq("event_id", eventId);
  if (songsError) throw new Error(`Songs lookup failed: ${songsError.message}`);

  if (!existingSongs || existingSongs.length === 0) {
    const { error: songsInsertError } = await supabaseAdmin
      .from("songs")
      .insert(SEED_SONGS.map((s) => ({ ...s, event_id: eventId })));
    if (songsInsertError) throw new Error(`Insert songs failed: ${songsInsertError.message}`);
    console.log(`Seeded ${SEED_SONGS.length} setlist songs`);
  } else {
    console.log(`Songs already seeded (${existingSongs.length}), leaving as-is`);
  }

  const { data: usersPage, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) throw new Error(`List users failed: ${listError.message}`);
  const djExists = usersPage.users.some((u) => u.email === DJ_EMAIL);

  if (!djExists) {
    const { error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: DJ_EMAIL,
      password: DJ_PASSWORD,
      email_confirm: true,
    });
    if (createUserError) throw new Error(`Create DJ user failed: ${createUserError.message}`);
    console.log(`Created DJ auth user ${DJ_EMAIL}`);
  } else {
    console.log(`DJ auth user already exists (${DJ_EMAIL})`);
  }

  console.log("Seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
