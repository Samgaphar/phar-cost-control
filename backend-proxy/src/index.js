/* ============================================================
   PHAR Cost — Proxy Anthropic (Cloudflare Worker)

   Rôle : le navigateur n'a JAMAIS la vraie clé API Anthropic.
   Il envoie sa requête à ce Worker (avec juste son client_id),
   le Worker rajoute la vraie clé (stockée en secret Cloudflare,
   jamais dans un fichier du repo) et relaie l'appel à Anthropic.

   Endpoint exposé : POST /v1/messages
   Corps attendu   : { client_id, model, max_tokens, system?, messages }
   ============================================================ */

const ANTHROPIC_URL     = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export default {
  async fetch(request, env) {
    const origin  = request.headers.get('Origin') || '';
    const allowed = isAllowedOrigin(origin, env);

    // Pré-vol CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin, allowed) });
    }

    if (!allowed) {
      return json({ error: 'Origine non autorisée' }, 403, corsHeaders(origin, false));
    }

    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true }, 200, corsHeaders(origin, allowed));
    }

    if (request.method !== 'POST' || url.pathname !== '/v1/messages') {
      return json({ error: 'Not found' }, 404, corsHeaders(origin, allowed));
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: 'JSON invalide' }, 400, corsHeaders(origin, allowed));
    }

    if (!body.client_id || typeof body.client_id !== 'string') {
      return json({ error: 'client_id manquant' }, 400, corsHeaders(origin, allowed));
    }

    // On ignore volontairement toute clé envoyée par le navigateur — seule
    // une clé connue du serveur est utilisée.
    const { client_id, api_key, ...anthropicPayload } = body;

    const apiKey = await resolveApiKey(env, client_id);
    if (!apiKey) {
      return json({ error: 'Proxy mal configuré : ANTHROPIC_API_KEY absente' }, 500, corsHeaders(origin, allowed));
    }

    const anthropicRes = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION
      },
      body: JSON.stringify(anthropicPayload)
    });

    const resBody = await anthropicRes.text();

    // Suivi d'usage par client (facultatif) — sert de base si on veut un jour
    // refacturer par client ou lui attribuer sa propre clé. N'empêche jamais
    // la réponse de partir si le binding KV n'est pas configuré.
    if (anthropicRes.ok && env.USAGE) {
      try {
        const parsed = JSON.parse(resBody);
        if (parsed.usage) await logUsage(env, client_id, parsed.usage);
      } catch (e) { /* le suivi d'usage ne doit jamais faire échouer la requête */ }
    }

    return new Response(resBody, {
      status: anthropicRes.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, allowed) }
    });
  }
};

/**
 * Détermine quelle clé Anthropic utiliser pour ce client.
 * Aujourd'hui : une seule clé PHAR pour tout le monde (env.ANTHROPIC_API_KEY).
 * Demain, pour facturer/attribuer une clé par client sans réécrire le Worker :
 * lier un KV nommé "CLIENT_KEYS" (wrangler.toml) et y faire
 * `wrangler kv:key put --binding=CLIENT_KEYS "<client_id>" "sk-ant-..."`.
 * S'il existe une clé pour ce client_id, elle prend le dessus sur la clé partagée.
 */
async function resolveApiKey(env, clientId) {
  if (env.CLIENT_KEYS) {
    const perClient = await env.CLIENT_KEYS.get(clientId);
    if (perClient) return perClient;
  }
  return env.ANTHROPIC_API_KEY || null;
}

/** Cumule les tokens utilisés par client et par mois dans le KV "USAGE" (si lié). */
async function logUsage(env, clientId, usage) {
  const month = new Date().toISOString().slice(0, 7); // "2026-07"
  const key = `usage:${clientId}:${month}`;
  const current = JSON.parse((await env.USAGE.get(key)) || '{"input_tokens":0,"output_tokens":0,"calls":0}');
  current.input_tokens  += usage.input_tokens  || 0;
  current.output_tokens += usage.output_tokens || 0;
  current.calls += 1;
  await env.USAGE.put(key, JSON.stringify(current));
}

/** Liste blanche des origines autorisées, définie via wrangler.toml [vars] ALLOWED_ORIGINS
 *  (séparées par des virgules). Si vide, tout est autorisé — pratique en dev local,
 *  À CONFIGURER avant toute mise en production. */
function isAllowedOrigin(origin, env) {
  const list = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!list.length) return true;
  return list.includes(origin);
}

function corsHeaders(origin, allowed) {
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'null',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function json(obj, status, extraHeaders) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders }
  });
}
