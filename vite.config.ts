import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget = env.VITE_API_PROXY_TARGET;

  return {
    server: {
      host: "127.0.0.1",
      port: 8080,
      proxy: apiProxyTarget
        ? {
            "/api": {
              target: apiProxyTarget,
              changeOrigin: true,
            },
          }
        : undefined,
      hmr: {
        overlay: false,
      },
    },
    build: {
      sourcemap: true,
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      mode === "development" && !apiProxyTarget && {
        name: "api-dev-middleware",
        configureServer(server) {
          // Local handler for /api/companies-house — mirrors api/companies-house.ts
          server.middlewares.use("/api/companies-house", async (req, res) => {
            const url = new URL(req.url ?? "", "http://localhost");
            const q = url.searchParams.get("q")?.trim() ?? "";

            if (q.length < 2) {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ items: [] }));
              return;
            }

            const apiKey = env.COMPANIES_HOUSE_API_KEY;
            if (!apiKey) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "COMPANIES_HOUSE_API_KEY not set in .env.local" }));
              return;
            }

            try {
              const chUrl = `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(q)}&items_per_page=8`;
              const upstream = await fetch(chUrl, {
                headers: {
                  Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
                },
              });

              const data = await upstream.json() as {
                items?: {
                  title: string;
                  company_number: string;
                  company_status: string;
                  date_of_creation?: string;
                  address?: {
                    address_line_1?: string;
                    address_line_2?: string;
                    locality?: string;
                    postal_code?: string;
                    country?: string;
                  };
                  description?: string;
                }[];
              };

              const items = (data.items ?? []).map((c) => ({
                company_name: c.title,
                company_number: c.company_number,
                company_status: c.company_status,
                date_of_creation: c.date_of_creation ?? null,
                address_line_1: c.address?.address_line_1 ?? "",
                address_line_2: c.address?.address_line_2 ?? "",
                locality: c.address?.locality ?? "",
                postal_code: c.address?.postal_code ?? "",
                country: c.address?.country ?? "",
                description: c.description ?? "",
              }));

              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ items }));
            } catch (err) {
              res.statusCode = 502;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Companies House request failed" }));
            }
          });
        },
      },
      // Upload source maps to Sentry on production builds
      mode !== "development" && sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        telemetry: false,
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
  };
});
