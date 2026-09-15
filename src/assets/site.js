const html = document.documentElement;
const celular = matchMedia("(max-width: 768px)");

// modo de edição: liga com ?editar no endereço, fica ligado até clicar em "Sair"
if (new URLSearchParams(location.search).has("editar")) localStorage.setItem("editar", "1");
if (localStorage.getItem("editar") === "1") import(new URL("editar.js", document.currentScript.src));

// barra lateral: fechada por padrão, lembra a escolha (só no desktop)
const botao = document.querySelector(".alternar");
const sincronizar = () => botao.setAttribute("aria-expanded", html.classList.contains("menu-aberto"));
sincronizar();
botao.addEventListener("click", () => {
  const aberto = html.classList.toggle("menu-aberto");
  if (!celular.matches) try { localStorage.setItem("menu", aberto ? "aberto" : "fechado"); } catch {}
  sincronizar();
});

// celular: tocar fora do menu ou apertar Esc fecha o menu
const fecharMenu = () => { html.classList.remove("menu-aberto"); sincronizar(); };
document.addEventListener("click", (e) => {
  if (celular.matches && html.classList.contains("menu-aberto") && !e.target.closest(".barra")) fecharMenu();
});
document.addEventListener("keydown", (e) => e.key === "Escape" && celular.matches && fecharMenu());

// subtítulos: o link com #id abre o subtítulo; abrir um atualiza o link
const abrirDoLink = () => {
  const d = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (d?.tagName !== "DETAILS") return;
  d.open = true;
  d.scrollIntoView();
  if (celular.matches) fecharMenu();
};
addEventListener("hashchange", abrirDoLink);
abrirDoLink();
document.querySelectorAll("details[id]").forEach((d) =>
  d.addEventListener("toggle", () => d.open && history.replaceState(null, "", "#" + d.id))
);

// e-mail montado só quando alguém vai clicar: robôs que leem o HTML não encontram o endereço
document.querySelectorAll("a.email").forEach((a) => {
  const montar = () => (a.href = `mailto:${a.dataset.usuario}@${a.dataset.dominio}`);
  for (const evento of ["pointerenter", "focus", "touchstart"]) a.addEventListener(evento, montar, { once: true });
});

// busca por título e seção, ignorando acentos
const indice = JSON.parse(document.getElementById("indice-busca").textContent);
const campo = document.querySelector(".busca input");
const lista = document.querySelector(".resultados");
const normalizar = (s) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

campo.addEventListener("input", () => {
  const q = normalizar(campo.value.trim());
  if (!q) return lista.replaceChildren();
  const achados = indice.filter((r) => normalizar(`${r.titulo} ${r.secao}`).includes(q)).slice(0, 15);
  lista.replaceChildren(
    ...achados.map((r) => {
      const a = Object.assign(document.createElement("a"), { href: r.url, textContent: r.titulo });
      a.append(Object.assign(document.createElement("small"), { textContent: r.secao }));
      const li = document.createElement("li");
      li.append(a);
      return li;
    })
  );
  if (!achados.length) lista.append(Object.assign(document.createElement("li"), { textContent: "Nada encontrado." }));
});

// fotos: clicar amplia em tela cheia; setas, teclado e deslizar navegam entre as fotos do mesmo subtítulo
const visor = document.createElement("dialog");
visor.className = "visor";
visor.innerHTML = `<button type="button" class="visor-fechar" aria-label="Fechar">×</button><button type="button" class="visor-anterior" aria-label="Foto anterior">‹</button><figure><img alt=""><figcaption></figcaption></figure><button type="button" class="visor-proxima" aria-label="Próxima foto">›</button>`;
document.body.append(visor);
const [botaoFechar, botaoAnterior, figuraVisor, botaoProxima] = visor.children;
const imagemVisor = figuraVisor.querySelector("img");
const legendaVisor = figuraVisor.querySelector("figcaption");
let fotos = [];
let fotoAtual = 0;

// maior versão gerada na publicação (último item do srcset WebP), ou a própria imagem
const maiorVersao = (img) => img.closest("picture")?.querySelector("source")?.srcset.split(",").at(-1).trim().split(" ")[0] || img.currentSrc || img.src;

function mostrarFoto(i) {
  fotoAtual = (i + fotos.length) % fotos.length;
  const img = fotos[fotoAtual];
  imagemVisor.src = maiorVersao(img);
  imagemVisor.alt = img.alt;
  const legenda = img.closest("figure").querySelector("figcaption");
  legendaVisor.textContent = legenda
    ? [...legenda.children].filter((e) => !e.classList.contains("campo-vazio")).map((e) => e.textContent.trim()).filter(Boolean).join(" · ")
    : "";
  const sozinha = fotos.length < 2 ? "hidden" : "";
  botaoAnterior.style.visibility = botaoProxima.style.visibility = sozinha;
}

document.addEventListener("click", (e) => {
  const img = e.target.closest(".midia img");
  if (!img || html.classList.contains("edicao")) return;
  fotos = [...img.closest(".blocos").querySelectorAll(".midia img")];
  mostrarFoto(fotos.indexOf(img));
  visor.showModal();
});
botaoFechar.addEventListener("click", () => visor.close());
botaoAnterior.addEventListener("click", () => mostrarFoto(fotoAtual - 1));
botaoProxima.addEventListener("click", () => mostrarFoto(fotoAtual + 1));
visor.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") mostrarFoto(fotoAtual - 1);
  if (e.key === "ArrowRight") mostrarFoto(fotoAtual + 1);
});
let inicioToque = null;
let deslizou = false;
visor.addEventListener("pointerdown", (e) => { inicioToque = e.clientX; deslizou = false; });
visor.addEventListener("pointerup", (e) => {
  if (inicioToque === null) return;
  const dx = e.clientX - inicioToque;
  inicioToque = null;
  if (Math.abs(dx) > 50 && fotos.length > 1) { deslizou = true; mostrarFoto(fotoAtual + (dx < 0 ? 1 : -1)); }
});
// clicar no fundo escuro fecha (Esc já fecha, é o comportamento nativo do <dialog>)
visor.addEventListener("click", (e) => e.target === visor && !deslizou && visor.close());

// adesivos: arrastáveis (volta ao lugar ao recarregar); clique sem arrastar abre o link
let camada = 2;
document.querySelectorAll(".adesivo").forEach((el) => {
  let inicio = null;
  let arrastou = false;
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    inicio = { dx: e.clientX - el.offsetLeft, dy: e.clientY - el.offsetTop, x: e.clientX, y: e.clientY };
    arrastou = false;
    el.setPointerCapture(e.pointerId);
    el.style.zIndex = camada++;
  });
  el.addEventListener("pointermove", (e) => {
    if (!inicio) return;
    if (Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > 5) arrastou = true;
    if (!arrastou) return;
    el.classList.add("arrastando");
    el.style.left = e.clientX - inicio.dx + "px";
    el.style.top = e.clientY - inicio.dy + "px";
  });
  el.addEventListener("pointerup", () => {
    inicio = null;
    el.classList.remove("arrastando");
  });
  el.addEventListener("click", (e) => arrastou && e.preventDefault());
});
