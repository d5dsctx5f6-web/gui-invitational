import { createClient } from "@/lib/supabase/server";

export interface CurrentPlayer {
  id: string;
  name: string;
}

/** The signed-in player for this request, from the session cookie — null if not signed in. */
export async function getCurrentPlayer(): Promise<CurrentPlayer | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: device } = await supabase
    .from("player_devices")
    .select("player_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!device) return null;

  const { data: player } = await supabase
    .from("players")
    .select("id, name")
    .eq("id", device.player_id)
    .maybeSingle();

  return player;
}
