import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://agyvgwtsbsfqychbdekj.supabase.co";

// This is a browser-safe publishable key, not a service-role secret. It is
// replaced with the project's real key before the GitHub Pages build is
// published.
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_RlkZ4TcbpO67_rJAQPADvg_LU8e3owP";

export const SUPABASE_AUTH_STORAGE_KEY = "ai-star-scoreboard.supabase.auth";

let client: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (SUPABASE_PUBLISHABLE_KEY.startsWith("__")) {
    throw new Error("Supabase 공개 키가 아직 설정되지 않았습니다.");
  }

  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        persistSession: true,
        storageKey: SUPABASE_AUTH_STORAGE_KEY,
      },
    });
  }

  return client;
}

export type SupabaseAccessContext = {
  status: "owner" | "approved" | "pending" | "rejected" | "none";
  isAdmin: boolean;
  displayName: string;
};

export async function getSupabaseAccessContext(): Promise<SupabaseAccessContext> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("get_access_context");
  if (error) throw error;

  const context = data as {
    status?: SupabaseAccessContext["status"];
    is_admin?: boolean;
    display_name?: string;
  } | null;

  return {
    status: context?.status ?? "none",
    isAdmin: Boolean(context?.is_admin),
    displayName: context?.display_name?.trim() || "사용자",
  };
}
