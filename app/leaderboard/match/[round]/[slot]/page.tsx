import { createClient } from "@/lib/supabase/server";
import { loadCupData } from "@/lib/cupData";
import { resolveScope } from "@/lib/qaScope";
import { MatchDetail } from "../../../MatchDetail";

export const dynamic = "force-dynamic";

export default async function MatchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ round: string; slot: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { round, slot } = await params;
  const query = await searchParams;
  const scope = await resolveScope(query.scope);
  const supabase = await createClient();
  const initial = await loadCupData(supabase, scope);
  return <MatchDetail initial={initial} roundId={round} slot={Number(slot)} />;
}
