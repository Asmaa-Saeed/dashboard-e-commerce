/**
 * Content-Security-Policy for one response.
 * Scripts only run with this request's nonce; network calls only go to our Supabase project.
 * Styles allow inline attributes because the store's brand colour is set at runtime.
 */
export function buildCsp({ nonce, supabaseUrl, isDev }: { nonce: string; supabaseUrl: string; isDev: boolean }) {
  const supabase = new URL(supabaseUrl);
  const supabaseWs = `wss://${supabase.host}`;

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    // product photos come from each store's own website
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", supabase.origin, supabaseWs, ...(isDev ? ["ws:"] : [])],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");

  return isDev ? policy : `${policy}; upgrade-insecure-requests`;
}
