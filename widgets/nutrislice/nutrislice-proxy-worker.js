/**
 * nutrislice-proxy-worker.js
 * ===========================
 * A minimal Cloudflare Worker that proxies requests to a district's Nutrislice
 * API and adds permissive CORS headers, so the DakBoard widget's browser-side
 * fetch() can read the response even if Nutrislice itself doesn't send CORS
 * headers.
 *
 * Unlike MealViewer, Nutrislice gives every district its own subdomain, so the
 * widget sends the host along with the path. Only *.nutrislice.com hosts are
 * forwarded -- this is deliberately not a general-purpose open proxy.
 *
 * DEPLOY (free tier is plenty):
 * 1. Sign up at https://workers.cloudflare.com (free).
 * 2. Create a new Worker, paste this file's contents in as the script.
 * 3. Deploy -- you'll get a URL like:
 *      https://nutrislice-proxy.<your-subdomain>.workers.dev
 * 4. Paste that URL into PROXY_URL in dakboard-nutrislice-widget.html.
 *
 * USAGE:
 *   GET https://<your-worker>.workers.dev/?host=elkhornweb.nutrislice.com
 *         &path=/menu/api/weeks/school/elkhorn-high-school/menu-type/lunch/2026/08/19/?format=json
 *   -> proxies to that URL and returns the response with
 *      Access-Control-Allow-Origin: *
 *
 * If 'host' is omitted, DEFAULT_HOST below is used, so you can hard-code your
 * district here instead of passing it from the widget.
 */

// Change this if you'd rather pin the worker to a single district.
const DEFAULT_HOST = "";

// Only hosts matching this are proxied, e.g. "elkhornweb.nutrislice.com"
// or "elkhornweb.api.nutrislice.com".
const ALLOWED_HOST = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)*\.nutrislice\.com$/i;

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    const host = url.searchParams.get("host") || DEFAULT_HOST;
    if (!host || !ALLOWED_HOST.test(host)) {
      return new Response("Missing or invalid 'host' query parameter (must be a *.nutrislice.com host).", {
        status: 400,
        headers: corsHeaders(),
      });
    }

    const path = url.searchParams.get("path");
    if (!path || !path.startsWith("/")) {
      return new Response("Missing or invalid 'path' query parameter.", {
        status: 400,
        headers: corsHeaders(),
      });
    }

    const upstreamUrl = "https://" + host + path;

    try {
      const upstreamResp = await fetch(upstreamUrl, {
        headers: { "Accept": "application/json, */*" },
      });

      const body = await upstreamResp.text();

      return new Response(body, {
        status: upstreamResp.status,
        headers: {
          ...corsHeaders(),
          "Content-Type": upstreamResp.headers.get("Content-Type") || "application/json",
          "Cache-Control": "public, max-age=3600", // menus don't change often
        },
      });
    } catch (err) {
      return new Response("Proxy fetch failed: " + err.message, {
        status: 502,
        headers: corsHeaders(),
      });
    }
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
