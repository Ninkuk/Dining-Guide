import { createAnonClient } from "@/lib/supabase/anon";

export type CuisineRow = { name: string; emoji: string };

/** All cuisines from the lookup table; sorted by name. */
export async function getCuisines(): Promise<CuisineRow[]> {
  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("cuisines")
    .select("name, emoji")
    .order("name", { ascending: true });

  if (error) throw new Error(`getCuisines failed: ${error.message}`);
  return data ?? [];
}
