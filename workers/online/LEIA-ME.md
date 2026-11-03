# Worker "online agora"

Conta as pessoas com o site aberto (cada página avisa a cada 30 s; vale quem avisou no último minuto).

1. Conta grátis em https://dash.cloudflare.com (sem cartão).
2. Nesta pasta: `npx wrangler login` e depois `npx wrangler deploy`.
3. Copie a URL que ele mostrar (`https://online.SEU-USUARIO.workers.dev`) para `"online"` em `src/_data/site.json`.
4. Se o site mudar de endereço, ajuste `ORIGEM` em `worker.js` e publique de novo.

Enquanto `"online"` estiver vazio, o "N online" da página inicial fica escondido.
