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
