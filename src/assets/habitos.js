// Habit tracker. Os dados ficam em dados/habitos.json no repositório, cifrados com a senha
// (AES-GCM, chave tirada da senha por PBKDF2). Repositório público: sem a senha o arquivo é ilegível.
// ponytail: senha fraca cai em força bruta; trocar por uma senha longa se os dados ficarem sensíveis.
const REPO = "lyrasid/lyrasid";
const RAMO = "main";
const ARQUIVO = "dados/habitos.json";
const INICIO = { ano: 2026, mes: 10 }; // novembro de 2026 (mês começa em 0)

const GRUPOS = [
  { nome: "Sono", itens: [["dormir-cedo", "Dormir cedo"], ["acordar-cedo", "Acordar cedo"], ["sono", "Sono"], ["sonho", "Sonho"]] },
  { nome: "Corpo", itens: [["saude", "Saúde"], ["alimentacao", "Alimentação"], ["agua", "Água"], ["atividade-fisica", "Ativ. física"]] },
  { nome: "Mente", itens: [["humor", "Humor"], ["ansiedade", "Ansiedade"], ["terapia", "Terapia"], ["tempo-para-mim", "Tempo para mim"]] },
  { nome: "Pessoas e lazer", itens: [["relacao-familiar", "Relação familiar"], ["sexo", "Sexo"], ["roles", "Rolês"], ["leitura", "Leitura"], ["joguinhos", "Joguinhos"], ["chapacao", "Chapação"]] },
  { nome: "Rotina", itens: [["trabalho", "Trabalho"], ["clima", "Clima e temp."]] },
];
// estados do dia, não hábitos de sim/não: dá para ver subir e descer numa linha
const LINHAS = [["sono", "Sono"], ["humor", "Humor"], ["ansiedade", "Ansiedade"], ["saude", "Saúde"]];
const VALOR = { b: 3, m: 2, r: 1 };
const NOME = { b: "bom", m: "médio", r: "ruim", ".": "não anotado" };
const CICLO = { ".": "b", b: "m", m: "r", r: "." };
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEMANA = "DSTQQSS";

const $ = (s) => document.querySelector(s);
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const deB64 = (s) => Uint8Array.from(atob(s.replace(/\n/g, "")), (c) => c.charCodeAt(0));

// ---------- GitHub (mesmo token do modo de edição: só na aba, some ao fechar) ----------
function token(pedir) {
  let t = sessionStorage.getItem("github-token");
  try { t ||= JSON.parse(localStorage.getItem("sveltia-cms.user"))?.token; } catch {}
  if (!t && pedir) {
    t = prompt("Cole um token do GitHub com permissão de escrita (Contents) em " + REPO + ".\nEle fica guardado só até você fechar esta aba.")?.trim();
    if (t) sessionStorage.setItem("github-token", t);
  }
  return t;
}

async function gh(metodo, corpo) {
  const t = token(metodo !== "GET");
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${ARQUIVO}${metodo === "GET" ? `?ref=${RAMO}` : ""}`, {
    method: metodo,
    cache: "no-store",
    headers: { Accept: "application/vnd.github+json", ...(t && { Authorization: `Bearer ${t}` }) },
    body: corpo && JSON.stringify(corpo),
  });
  if (r.status === 401) sessionStorage.removeItem("github-token");
  return r;
}

// ---------- cifra ----------
async function chave(senha, sal) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: sal, iterations: 250000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

let dados = {}; // { "2026-11": { sono: "bm.r..." } } — um caractere por dia
let cofre; // { chave, sal, sha }

async function abrir(senha) {
  const r = await gh("GET");
  if (r.status === 404) { // ainda não existe: esta senha passa a trancar o arquivo
    const sal = crypto.getRandomValues(new Uint8Array(16));
    cofre = { chave: await chave(senha, sal), sal };
    return;
  }
  if (!r.ok) throw new Error(`GitHub respondeu ${r.status}`);
  const resposta = await r.json();
  const arquivo = JSON.parse(new TextDecoder().decode(deB64(resposta.content)));
  const sal = deB64(arquivo.sal);
  const k = await chave(senha, sal);
  let claro;
  try {
    claro = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(arquivo.iv) }, k, deB64(arquivo.cifra));
  } catch {
    throw new Error("Senha errada.");
  }
  dados = JSON.parse(new TextDecoder().decode(claro));
  cofre = { chave: k, sal, sha: resposta.sha };
}

async function salvar() {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifra = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cofre.chave, new TextEncoder().encode(JSON.stringify(dados)));
  const arquivo = JSON.stringify({ versao: 1, sal: b64(cofre.sal), iv: b64(iv), cifra: b64(cifra) }, null, 2) + "\n";
  const r = await gh("PUT", {
    message: `Hábitos: ${titulo()}`,
    content: b64(new TextEncoder().encode(arquivo)),
    branch: RAMO,
    ...(cofre.sha && { sha: cofre.sha }),
  });
  if (r.status === 409 || r.status === 422) throw new Error("os hábitos foram salvos em outro lugar depois que esta página abriu. Recarregue (as mudanças daqui se perdem).");
  if (!r.ok) throw new Error(`GitHub respondeu ${r.status}`);
  cofre.sha = (await r.json()).content.sha;
}

// ---------- estado da tela ----------
const hoje = new Date();
const FIM = { ano: hoje.getFullYear(), mes: hoje.getMonth() };
let atual = { ...FIM };
if (atual.ano * 12 + atual.mes < INICIO.ano * 12 + INICIO.mes) atual = { ...INICIO };
let modo = "mes";
let pincel = null;
let mudou = false;

const chaveMes = (ano, mes) => `${ano}-${String(mes + 1).padStart(2, "0")}`;
const diasNoMes = (ano, mes) => new Date(ano, mes + 1, 0).getDate();
const titulo = () => (modo === "ano" ? String(atual.ano) : `${MESES[atual.mes]}/${atual.ano}`);
const futuro = (ano, mes, dia) => new Date(ano, mes, dia) > hoje;

function ler(ano, mes, id) {
  return (dados[chaveMes(ano, mes)]?.[id] ?? "").padEnd(diasNoMes(ano, mes), ".");
}
function gravar(id, dia, valor) {
  const k = chaveMes(atual.ano, atual.mes);
  const linha = ler(atual.ano, atual.mes, id);
  if (linha[dia - 1] === valor) return;
  (dados[k] ??= {})[id] = (linha.slice(0, dia - 1) + valor + linha.slice(dia)).replace(/\.+$/, ""); // pontos no fim não guardam nada
  mudou = true;
  $(".habitos-salvar").disabled = false;
  $(".habitos-status").textContent = "Mudanças não salvas.";
}

// ---------- mês ----------
function desenharMes() {
  const { ano, mes } = atual;
  const n = diasNoMes(ano, mes);
  const dias = Array.from({ length: n }, (_, i) => i + 1);
  const fds = (d) => [0, 6].includes(new Date(ano, mes, d).getDay());
  const eHoje = (d) => ano === hoje.getFullYear() && mes === hoje.getMonth() && d === hoje.getDate();
  const cab = dias.map((d) => `<th scope="col" class="${fds(d) ? "fds" : ""}${eHoje(d) ? " hoje" : ""}">${d}<small>${SEMANA[new Date(ano, mes, d).getDay()]}</small></th>`).join("");
  const corpo = GRUPOS.map((g) => `<tbody><tr class="grupo"><th scope="rowgroup" colspan="${n + 1}">${g.nome}</th></tr>` +
    g.itens.map(([id, rotulo]) => {
      const linha = ler(ano, mes, id);
      return `<tr><th scope="row">${rotulo}</th>` + dias.map((d) => {
        const v = linha[d - 1];
        const off = futuro(ano, mes, d);
        return `<td class="${fds(d) ? "fds" : ""}"><button type="button" class="v-${v}" data-id="${id}" data-dia="${d}"${off ? " disabled" : ""} aria-label="${rotulo}, dia ${d}: ${NOME[v]}"></button></td>`;
      }).join("") + "</tr>";
    }).join("") + "</tbody>").join("");
  $(".habitos-grade").innerHTML = `<thead><tr><th></th>${cab}</tr></thead>${corpo}`;
  $(".habitos-grade .hoje")?.scrollIntoView({ block: "nearest", inline: "center" }); // no celular, abre no dia de hoje
  desenharGrafico();
}

// gráfico de linha dos estados do dia: 3 = bom, 2 = médio, 1 = ruim; dia sem anotação quebra a linha
function desenharGrafico() {
  const { ano, mes } = atual;
  const n = diasNoMes(ano, mes);
  const L = 640, A = 150, esq = 46, topo = 12, base = 24;
  const x = (d) => esq + ((d - 0.5) / n) * (L - esq - 8);
  const y = (v) => topo + ((3 - v) / 2) * (A - topo - base);
  const rotulosY = [[3, "bom"], [2, "médio"], [1, "ruim"]].map(([v, t]) => `<line x1="${esq}" x2="${L - 8}" y1="${y(v)}" y2="${y(v)}" class="eixo"/><text x="${esq - 6}" y="${y(v) + 4}" text-anchor="end">${t}</text>`).join("");
  const rotulosX = Array.from({ length: n }, (_, i) => i + 1).filter((d) => d === 1 || d % 5 === 0).map((d) => `<text x="${x(d)}" y="${A - 6}" text-anchor="middle">${d}</text>`).join("");
  const series = LINHAS.map(([id], i) => {
    const desvio = (i - 1.5) * 2.5; // separa linhas iguais para não sumirem uma atrás da outra
    const linha = ler(ano, mes, id);
    let d = "", pontos = "", aberto = false;
    for (let dia = 1; dia <= n; dia++) {
      const v = VALOR[linha[dia - 1]];
      if (!v) { aberto = false; continue; }
      d += `${aberto ? "L" : "M"}${x(dia).toFixed(1)} ${(y(v) + desvio).toFixed(1)}`;
      pontos += `<circle cx="${x(dia).toFixed(1)}" cy="${(y(v) + desvio).toFixed(1)}" r="2.6"/>`;
      aberto = true;
    }
    return `<g class="serie s${i}"><path d="${d}"/>${pontos}</g>`;
  }).join("");
  const legenda = LINHAS.map(([, rotulo], i) => `<span class="s${i}"><svg viewBox="0 0 24 8" aria-hidden="true"><line x1="0" x2="24" y1="4" y2="4"/></svg>${rotulo}</span>`).join("");
  $(".habitos-grafico").innerHTML = `<figcaption>Como estive no mês ${legenda}</figcaption>
    <svg viewBox="0 0 ${L} ${A}" role="img" aria-label="Sono, humor, ansiedade e saúde ao longo de ${MESES[mes]}">${rotulosY}${rotulosX}${series}</svg>`;
}

// ---------- ano: média de cada parâmetro por mês ----------
function cor(media) {
  // 1 vermelho → 2 amarelo → 3 verde
  const matiz = media <= 2 ? (media - 1) * 46 : 46 + (media - 2) * 84;
  return `hsl(${matiz.toFixed(0)} 72% 62%)`;
}

function desenharAno() {
  const { ano } = atual;
  const meses = MESES.map((_, i) => i);
  const cab = meses.map((i) => `<th scope="col">${MESES[i].slice(0, 3)}</th>`).join("");
  const corpo = GRUPOS.map((g) => `<tbody><tr class="grupo"><th scope="rowgroup" colspan="13">${g.nome}</th></tr>` +
    g.itens.map(([id, rotulo]) => `<tr><th scope="row">${rotulo}</th>` + meses.map((mes) => {
      const valores = [...ler(ano, mes, id)].map((c) => VALOR[c]).filter(Boolean);
      if (!valores.length) return `<td><span class="media vazia" title="${rotulo}, ${MESES[mes]}: nada anotado"></span></td>`;
      const media = valores.reduce((a, b) => a + b, 0) / valores.length;
      const texto = media.toFixed(1).replace(".", ",");
      return `<td><span class="media" style="background:${cor(media)}" title="${rotulo}, ${MESES[mes]}: média ${texto} em ${valores.length} dias anotados">${texto}</span></td>`;
    }).join("") + "</tr>").join("") + "</tbody>").join("");
  $(".habitos-grade").innerHTML = `<thead><tr><th></th>${cab}</tr></thead>${corpo}`;
  $(".habitos-grafico").innerHTML = `<figcaption>Média do mês: 3 = bom, 2 = médio, 1 = ruim. Dias não anotados ficam fora da conta.</figcaption>`;
}

function desenhar() {
  $(".habitos").dataset.modo = modo;
  $(".habitos-periodo").textContent = titulo();
  const passo = modo === "ano" ? 12 : 1;
  const pos = atual.ano * 12 + atual.mes;
  $('[data-ir="-1"]').disabled = modo === "ano" ? atual.ano <= INICIO.ano : pos - passo < INICIO.ano * 12 + INICIO.mes;
  $('[data-ir="1"]').disabled = modo === "ano" ? atual.ano >= FIM.ano : pos + passo > FIM.ano * 12 + FIM.mes;
  modo === "ano" ? desenharAno() : desenharMes();
}

// ---------- eventos ----------
$(".habitos-senha").addEventListener("submit", async (e) => {
  e.preventDefault();
  const aviso = $(".habitos-aviso");
  aviso.textContent = "Abrindo…";
  try {
    await abrir($("#senha-habitos").value);
    e.target.hidden = true;
    $(".habitos").hidden = false;
    desenhar();
  } catch (erro) {
    aviso.textContent = erro.message;
  }
});

$(".habitos-modo").addEventListener("click", (e) => {
  const b = e.target.closest("[data-modo]");
  if (!b) return;
  modo = b.dataset.modo;
  if (modo === "mes" && atual.ano === FIM.ano) atual.mes = Math.min(atual.mes, FIM.mes);
  document.querySelectorAll("[data-modo]").forEach((x) => x.setAttribute("aria-pressed", x === b));
  desenhar();
});

document.querySelectorAll("[data-ir]").forEach((b) => b.addEventListener("click", () => {
  const pos = atual.ano * 12 + atual.mes + Number(b.dataset.ir) * (modo === "ano" ? 12 : 1);
  const limite = Math.min(Math.max(pos, INICIO.ano * 12 + INICIO.mes), FIM.ano * 12 + FIM.mes);
  atual = { ano: Math.floor(limite / 12), mes: limite % 12 };
  desenhar();
}));

$(".habitos-legenda").addEventListener("click", (e) => {
  const b = e.target.closest("[data-pincel]");
  if (!b) return;
  pincel = pincel === b.dataset.pincel ? null : b.dataset.pincel;
  document.querySelectorAll("[data-pincel]").forEach((x) => x.setAttribute("aria-pressed", x.dataset.pincel === pincel));
});

// pintar: clique troca a cor (ou aplica o pincel); com pincel, arrastar pinta vários dias
let arrastando = false;
function pintar(botao, novo) {
  const { id, dia } = botao.dataset;
  gravar(id, Number(dia), novo);
  botao.className = `v-${novo}`;
  botao.setAttribute("aria-label", botao.getAttribute("aria-label").replace(/: [^:]*$/, `: ${NOME[novo]}`));
}
const celula = (e) => modo === "mes" && e.target.closest(".habitos-grade button:not(:disabled)");
$(".habitos-grade").addEventListener("pointerdown", (e) => {
  if (!pincel || !celula(e)) return;
  arrastando = true;
  e.target.releasePointerCapture?.(e.pointerId); // deixa o pointerover chegar às outras células
});
$(".habitos-grade").addEventListener("pointerover", (e) => {
  const b = arrastando && celula(e);
  if (b) pintar(b, pincel);
});
addEventListener("pointerup", () => { if (arrastando) { arrastando = false; desenharGrafico(); } });
$(".habitos-grade").addEventListener("click", (e) => {
  const b = celula(e);
  if (!b) return;
  pintar(b, pincel ?? CICLO[b.className.slice(2)]);
  desenharGrafico();
});

$(".habitos-salvar").addEventListener("click", async (e) => {
  const status = $(".habitos-status");
  e.target.disabled = true;
  status.textContent = "Salvando…";
  try {
    await salvar();
    mudou = false;
    status.textContent = "Salvo.";
  } catch (erro) {
    e.target.disabled = false;
    status.textContent = "Não salvou: " + erro.message;
  }
});

addEventListener("beforeunload", (e) => { if (mudou) e.preventDefault(); });
