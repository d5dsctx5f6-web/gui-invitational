import { createClient } from "@/lib/supabase/server";
import { loadCupData } from "@/lib/cupData";
import { resolveScope } from "@/lib/qaScope";
import { BoardView } from "./BoardView";

export const dynamic = "force-dynamic";

// The TV board: no login, read-only, no admin links. QA data only via ?scope=qa for the commissioner
// or a QA-signed-in device; the default view never contains QA data.
export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const scope = await resolveScope(params.scope);
  const supabase = await createClient();
  const initial = await loadCupData(supabase, scope);
  return <BoardView initial={initial} />;
}
