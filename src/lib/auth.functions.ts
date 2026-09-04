import { createServerFn } from "@tanstack/react-start";
import { getRequest, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LogInput = z.object({
  email: z.string().email().nullable().optional(),
});

export const logLoginEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => LogInput.parse(input))
  .handler(async ({ data, context }) => {
    const req = getRequest();
    const headers = req?.headers;
    const ip =
      headers?.get("cf-connecting-ip") ||
      headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      getRequestIP({ xForwardedFor: true }) ||
      null;
    const country = headers?.get("cf-ipcountry") || null;
    const city = headers?.get("cf-ipcity") || null;
    const ua = headers?.get("user-agent") || null;

    // Fallback country lookup if Cloudflare header missing
    let countryName: string | null = null;
    let countryCode: string | null = country;
    let resolvedCity: string | null = city;
    if (!country && ip) {
      try {
        const res = await fetch(`https://ipapi.co/${ip}/json/`);
        if (res.ok) {
          const j = (await res.json()) as {
            country_name?: string;
            country_code?: string;
            city?: string;
          };
          countryName = j.country_name ?? null;
          countryCode = j.country_code ?? null;
          resolvedCity = resolvedCity || j.city || null;
        }
      } catch {
        /* ignore */
      }
    } else {
      countryName = country;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("login_events").insert({
      user_id: context.userId,
      email: data.email ?? null,
      ip,
      country: countryName,
      country_code: countryCode,
      city: resolvedCity,
      user_agent: ua,
    });
    if (error) {
      console.error("login_events insert failed", error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  });

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // role check
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) {
      throw new Error("Доступ запрещён — нужны права администратора");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [profilesRes, eventsRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, email, display_name, created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("login_events")
        .select("id, user_id, email, country, country_code, city, ip, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    return {
      profiles: profilesRes.data ?? [],
      events: eventsRes.data ?? [],
    };
  });

// Only this email may ever claim the admin role — closes the "first
// authenticated visitor becomes admin" hole (anyone could previously sign up
// on the public /auth page and grab admin before the real owner did).
const OWNER_EMAIL = "tort2310@gmail.com";

export const claimAdminIfFirst = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", context.userId)
      .maybeSingle();

    if (!profile?.email || profile.email.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
      return { granted: false };
    }

    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) === 0) {
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: context.userId, role: "admin" });
      return { granted: true };
    }
    return { granted: false };
  });
