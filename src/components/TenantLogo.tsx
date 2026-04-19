import React from "react";

const FALLBACK = "/acrisure-logo-black.svg";

interface TenantLogoProps {
  /** URL override — pass from AuthContext.logoUrl (broker pages) or
   *  sessionStorage ff_tenant_logo (client-facing pages). If null/undefined
   *  the component falls back to the bundled Acrisure logo. */
  src?: string | null;
  className?: string;
  alt?: string;
}

/**
 * Renders the tenant's branding logo.
 *
 * Broker pages: pass `src={logoUrl}` from useAuth().
 * Client-facing pages: pass `src={sessionStorage.getItem("ff_tenant_logo")}`.
 *
 * When the tenant hasn't uploaded a custom logo yet the Acrisure SVG is shown
 * as a fallback, so the UI is never empty.
 */
const TenantLogo: React.FC<TenantLogoProps> = ({
  src,
  className = "h-8 w-auto",
  alt = "Logo",
}) => {
  const resolved = src || FALLBACK;
  return (
    <img
      src={resolved}
      alt={alt}
      className={className}
      onError={(e) => {
        // If the custom URL 404s, silently fall back to the default
        (e.currentTarget as HTMLImageElement).src = FALLBACK;
      }}
    />
  );
};

export default TenantLogo;
