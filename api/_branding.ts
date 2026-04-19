// Shared tenant branding helper for email templates.
// Returns logo URL, primary colour and display name for a given tenant,
// falling back to Acrisure defaults if the tenant has no branding configured.

import { createClient } from "@supabase/supabase-js";

const APP_URL = (process.env.APP_URL ?? "https://form-bloom-pro.vercel.app").replace(/\/$/, "");

const DEFAULTS = {
  logoUrl:       `${APP_URL}/acrisure-logo-white.svg`,
  primaryColour: "#041240",
  tenantName:    "Acrisure",
};

export interface TenantBranding {
  logoUrl:       string;
  primaryColour: string;
  tenantName:    string;
}

export async function getTenantBranding(tenantId: string): Promise<TenantBranding> {
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL ?? "",
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
    );

    const { data } = await supabase
      .from("tenants")
      .select("name, logo_url, primary_colour")
      .eq("id", tenantId)
      .single();

    if (!data) return DEFAULTS;

    return {
      logoUrl:       data.logo_url       ?? DEFAULTS.logoUrl,
      primaryColour: data.primary_colour ?? DEFAULTS.primaryColour,
      tenantName:    data.name           ?? DEFAULTS.tenantName,
    };
  } catch {
    return DEFAULTS;
  }
}

/** Builds the three reusable inline style strings for an email template */
export function emailStyles(primaryColour: string) {
  return {
    headerStyle: `background-color:${primaryColour};padding:24px 32px;border-radius:8px 8px 0 0`,
    bodyStyle:   `background-color:#ffffff;padding:32px;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 8px 8px`,
    btnStyle:    `display:inline-block;background-color:${primaryColour};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:bold;font-size:15px;margin:16px 0`,
  };
}
