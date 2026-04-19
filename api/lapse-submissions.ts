export const config = { runtime: "edge" };

import { createClient } from "@supabase/supabase-js";

/**
 * Nightly cron job — lapses any submission that has been sitting in
 * not_started or in_progress for more than 30 days without activity.
 *
 * Secured via CRON_SECRET env var. Vercel automatically passes
 * Authorization: Bearer <CRON_SECRET> when invoking cron routes.
 */

const LAPSE_AFTER_DAYS = 30;

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(req: Request): Promise<Response> {
  // Allow GET (Vercel cron) or POST (manual trigger from dashboard/CLI)
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "Method Not Allowed" }, 405);
  }

  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") ?? "";
    const provided = auth.replace(/^Bearer\s+/i, "").trim();
    if (provided !== cronSecret) {
      return json({ error: "Unauthorised" }, 401);
    }
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Missing Supabase env vars" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const cutoff = new Date(
    Date.now() - LAPSE_AFTER_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Lapse submissions where the most recent activity (or creation, if never
  // touched) is older than the cutoff and status is still open.
  const { data, error } = await supabase
    .from("submissions")
    .update({ status: "lapsed" })
    .in("status", ["not_started", "in_progress"])
    .or(`last_activity.lt.${cutoff},and(last_activity.is.null,created_at.lt.${cutoff})`)
    .select("id");

  if (error) {
    console.error("[api/lapse-submissions]", error);
    return json({ error: error.message }, 500);
  }

  const count = data?.length ?? 0;
  console.log(`[api/lapse-submissions] lapsed ${count} submission(s)`);
  return json({ ok: true, lapsed: count }, 200);
}
