const html = document.documentElement;
const celular = matchMedia("(max-width: 768px)");

// barra lateral: fechada por padrão, lembra a escolha (só no desktop)
const botao = document.querySelector(".alternar");
const sincronizar = () => botao.setAttribute("aria-expanded", html.classList.contains("menu-aberto"));
sincronizar();
botao.addEventListener("click", () => {
  const aberto = html.classList.toggle("menu-aberto");
  if (!celular.matches) try { localStorage.setItem("menu", aberto ? "aberto" : "fechado"); } catch {}
  sincronizar();
});

// subtítulos: o link com #id abre o subtítulo; abrir um atualiza o link
const abrirDoLink = () => {
  const d = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (d?.tagName !== "DETAILS") return;
  d.open = true;
  d.scrollIntoView();
  if (celular.matches) { html.classList.remove("menu-aberto"); sincronizar(); }
};
addEventListener("hashchange", abrirDoLink);
abrirDoLink();
document.querySelectorAll("details[id]").forEach((d) =>
  d.addEventListener("toggle", () => d.open && history.replaceState(null, "", "#" + d.id))
);

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
