// Vida em semanas: uma linha por ano de idade, 52 quadradinhos por linha.
// A semana k de um ano começa no aniversário + 7k dias; a 52ª leva junto o dia ou dois que sobram até o próximo aniversário.
const { vida, mundo } = JSON.parse(document.getElementById("dados-semanas").textContent);
const $ = (s) => document.querySelector(s);
const DIA = 864e5;
const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// datas como dias UTC: horário de verão não desloca semana
const dia = (iso) => { const [a, m, d] = iso.split("-").map(Number); return Date.UTC(a, m - 1, d); };
const hojeLocal = new Date();
const HOJE = Date.UTC(hojeLocal.getFullYear(), hojeLocal.getMonth(), hojeLocal.getDate());
const [NA, NM, ND] = vida.nascimento.split("-").map(Number);
const ANOS = vida.anos || 80;
const aniversario = (idade) => Date.UTC(NA + idade, NM - 1, ND);

function semanaDe(t) {
  let idade = new Date(t).getUTCFullYear() - NA;
  if (t < aniversario(idade)) idade--;
  return { idade, semana: Math.min(51, Math.floor((t - aniversario(idade)) / DIA / 7)) };
}
const indice = ({ idade, semana }) => idade * 52 + semana;
function periodoDa(i) {
  const idade = Math.floor(i / 52), s = i % 52;
  const inicio = aniversario(idade) + s * 7 * DIA;
  return { inicio, fim: s === 51 ? aniversario(idade + 1) - DIA : inicio + 6 * DIA };
}

const FASES = [
  ["bebê", 0, 2], ["criança", 3, 9], ["pré-adolescente", 10, 12], ["adolescente", 13, 17],
  ["jovem", 18, 24], ["jovem adulto", 25, 34], ["adulto", 35, 59], ["idoso", 60, ANOS - 1],
];
const CORES = ["#f2a7a0", "#f4c27c", "#eedb6f", "#a8d47f", "#6cc3a3", "#72a9db", "#9d90d8", "#cf8fbd"];
const TIPOS = { estudo: "Estudo", trabalho: "Trabalho", moradia: "Onde morei" };

const AGORA = indice(semanaDe(HOJE));
const TOTAL = ANOS * 52;

// ---------- acontecimentos por semana ----------
const pessoais = (vida.acontecimentos ?? []).filter((a) => a.data).map((a) => ({ ...a, onde: "eu" }));
const todos = [...pessoais, ...mundo].filter((a) => dia(a.data) >= aniversario(0)).sort((a, b) => dia(a.data) - dia(b.data));
function acontecimentosDa(i, mostrar) {
  const { inicio, fim } = periodoDa(i);
  return todos.filter((a) => mostrar.has(a.onde) && dia(a.data) <= fim && dia(a.fim ?? a.data) >= inicio);
}

// ---------- estado ----------
let cor = "fases";
let mostrar = new Set(["eu"]);
try { JSON.parse(localStorage.getItem("semanas-mundo") ?? "[]").forEach((o) => mostrar.add(o)); } catch {}
document.querySelectorAll("[data-onde]").forEach((c) => (c.checked = mostrar.has(c.dataset.onde)));

// cor de cada semana vivida conforme o modo; semanas futuras ficam cinza
function coresDasSemanas() {
  const cores = new Array(TOTAL).fill(null);
  if (cor === "fases") {
    FASES.forEach(([, de, ate], f) => { for (let i = de * 52; i < Math.min((ate + 1) * 52, TOTAL); i++) cores[i] = CORES[f]; });
  } else {
    periodos().forEach((p) => {
      const de = indice(semanaDe(Math.max(dia(p.inicio), aniversario(0))));
      const ate = p.fim ? indice(semanaDe(dia(p.fim))) : AGORA;
      for (let i = de; i <= Math.min(ate, TOTAL - 1); i++) cores[i] = p.cor;
    });
  }
  return cores;
}
const periodos = () => (vida.periodos ?? []).filter((p) => p.tipo === cor && p.inicio).map((p, n) => ({ ...p, cor: CORES[(n * 3) % CORES.length] }));

// ---------- desenho ----------
function desenharGrade() {
  const cores = coresDasSemanas();
  const marcadas = new Map(); // índice -> "eu" | "mundo"
  todos.filter((a) => mostrar.has(a.onde)).forEach((a) => {
    const de = indice(semanaDe(dia(a.data)));
    const ate = a.fim ? indice(semanaDe(dia(a.fim))) : de;
    for (let i = de; i <= ate && i < TOTAL; i++) if (marcadas.get(i) !== "eu") marcadas.set(i, a.onde === "eu" ? "eu" : i === de ? "mundo" : "faixa");
  });
  let html = "";
  for (const [nome, de, ate] of FASES) {
    html += `<section class="semanas-fase"><h3>${nome} <small>${de}–${ate} anos</small></h3>`;
    for (let idade = de; idade <= ate; idade++) {
      html += `<div class="semanas-linha" data-idade="${idade % 5 === 0 ? idade : ""}">`;
      for (let s = 0; s < 52; s++) {
        const i = idade * 52 + s;
        const vivida = i < AGORA;
        const classes = [i === AGORA && "agora", vivida && cores[i] && "cor", !vivida && i !== AGORA && "futuro", marcadas.get(i)].filter(Boolean).join(" ");
        const estilo = (vivida || i === AGORA) && cores[i] ? ` style="--c:${cores[i]}"` : "";
        html += `<i data-i="${i}" class="${classes}"${estilo}></i>`;
      }
      html += "</div>";
    }
    html += "</section>";
  }
  $(".semanas-grade").innerHTML = html;
}

function desenharLegenda() {
  const itens = cor === "fases"
    ? FASES.map(([nome], f) => `<li><i style="--c:${CORES[f]}"></i>${nome}</li>`)
    : periodos().map((p) => `<li><i style="--c:${p.cor}"></i>${esc(p.nome)} <small>${ano(p.inicio)}–${p.fim ? ano(p.fim) : "hoje"}</small></li>`);
  if (!itens.length) itens.push(`<li class="vazio">Nada em "${TIPOS[cor]}" ainda. Os períodos entram pelo painel, em "Vida em semanas".</li>`);
  itens.push(`<li><i class="futuro"></i>ainda não vivido</li>`, `<li><i class="agora-legenda"></i>esta semana</li>`);
  if (mostrar.size > 1 || pessoais.length) itens.push(`<li><i class="eu-legenda"></i>acontecimento</li>`);
  $(".semanas-legenda").innerHTML = itens.join("");
}

const ano = (iso) => iso.slice(0, 4);
const dataBR = (t, comAno = true) => new Date(t).toLocaleDateString("pt-BR", { day: "numeric", month: "short", ...(comAno && { year: "numeric" }), timeZone: "UTC" });
const num = (n) => n.toLocaleString("pt-BR");

function desenharResumo() {
  const dias = Math.floor((HOJE - aniversario(0)) / DIA);
  const { idade } = semanaDe(HOJE);
  $(".semanas-resumo").innerHTML = `<strong>${num(AGORA)}</strong> semanas vividas · <strong>${num(dias)}</strong> dias · ${idade} anos · ` +
    `<strong>${Math.round((AGORA / TOTAL) * 100)}%</strong> de ${ANOS} anos · faltam ${num(TOTAL - AGORA)} semanas`;
}

function desenharLista() {
  const lista = todos.filter((a) => mostrar.has(a.onde));
  $(".semanas-lista").innerHTML = lista.map((a) => `<li class="o-${a.onde}"><button type="button" data-i="${indice(semanaDe(dia(a.data)))}">` +
    `<time>${dataBR(dia(a.data))}</time> ${esc(a.titulo)}</button></li>`).join("") || `<li class="vazio">Nenhum acontecimento à mostra.</li>`;
}

function abrir(i) {
  document.querySelector(".semanas-grade .escolhida")?.classList.remove("escolhida");
  const cel = document.querySelector(`.semanas-grade [data-i="${i}"]`);
  cel?.classList.add("escolhida");
  const { inicio, fim } = periodoDa(i);
  const idade = Math.floor(i / 52);
  const quando = i < AGORA ? "vivida" : i === AGORA ? "esta semana" : "ainda não vivida";
  const acs = acontecimentosDa(i, mostrar);
  const painel = $(".semana-detalhe");
  painel.querySelector("div").innerHTML = `<p class="semana-cabeca"><strong>Semana ${num(i + 1)}</strong> · ${dataBR(inicio, false)} a ${dataBR(fim)} · ${idade} anos · ${quando}</p>` +
    (acs.length ? `<ul>${acs.map((a) => `<li class="o-${a.onde}"><strong>${esc(a.titulo)}</strong>${a.onde !== "eu" ? ` <small>${a.onde}</small>` : ""}${a.texto ? `<br>${esc(a.texto)}` : ""}</li>`).join("")}</ul>` : "");
  painel.hidden = false;
  return cel;
}

function desenhar() {
  desenharResumo();
  desenharLegenda();
  desenharGrade();
  desenharLista();
}

// ---------- eventos ----------
$(".semanas-grade").addEventListener("click", (e) => {
  const cel = e.target.closest("[data-i]");
  if (cel) abrir(Number(cel.dataset.i));
});
$(".semanas-lista").addEventListener("click", (e) => {
  const b = e.target.closest("[data-i]");
  if (b) abrir(Number(b.dataset.i))?.scrollIntoView({ block: "center", behavior: "smooth" });
});
$(".semana-detalhe .fechar").addEventListener("click", () => {
  $(".semana-detalhe").hidden = true;
  document.querySelector(".semanas-grade .escolhida")?.classList.remove("escolhida");
});
$(".semanas-cor").addEventListener("click", (e) => {
  const b = e.target.closest("[data-cor]");
  if (!b) return;
  cor = b.dataset.cor;
  document.querySelectorAll("[data-cor]").forEach((x) => x.setAttribute("aria-pressed", x === b));
  desenhar();
});
document.querySelectorAll("[data-onde]").forEach((c) => c.addEventListener("change", () => {
  c.checked ? mostrar.add(c.dataset.onde) : mostrar.delete(c.dataset.onde);
  try { localStorage.setItem("semanas-mundo", JSON.stringify([...mostrar].filter((o) => o !== "eu"))); } catch {}
  desenhar();
}));

desenhar();
