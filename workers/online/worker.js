// "N online": cada página aberta avisa a cada 30s (?id=sessão) e conta quem avisou no último minuto.
// ponytail: a contagem fica na memória do Durable Object; se ele for reiniciado, zera e volta em 30s.
const ORIGEM = "https://lyrasid.github.io";
const VALIDADE = 60_000;

export class Online {
  visto = new Map();
  fetch(req) {
    const id = new URL(req.url).searchParams.get("id");
    const agora = Date.now();
    if (id) this.visto.set(id, agora);
    for (const [k, t] of this.visto) if (agora - t > VALIDADE) this.visto.delete(k);
    return Response.json({ online: this.visto.size });
  }
}

export default {
  async fetch(req, env) {
    const cors = { "Access-Control-Allow-Origin": ORIGEM, "Cache-Control": "no-store" };
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (req.method !== "GET" || !/^[\w-]{8,64}$/.test(id) || req.headers.get("Origin") !== ORIGEM) return new Response(null, { status: 400, headers: cors });
    const res = await env.ONLINE.get(env.ONLINE.idFromName("site")).fetch(req);
    return new Response(res.body, { headers: { ...cors, "Content-Type": "application/json" } });
  },
};
