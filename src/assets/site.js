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

// o link com #id abre o item: subtítulo que expande, pasta que vira janela ou ficha da estante
const abrirDoLink = () => {
  const alvo = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (!alvo) return;
  const botao = alvo.querySelector(".pasta[data-janela], .carta");
  if (alvo.tagName === "DETAILS") {
    alvo.open = true;
    alvo.scrollIntoView();
  } else if (botao) {
    // pasta e estante abrem numa janela centralizada: rolar a página só atrapalharia
    botao.click();
  } else return;
  if (celular.matches) fecharMenu();
};
addEventListener("hashchange", abrirDoLink);
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

// ---------- segredos ----------
// balãozinho que sobe a partir de um adesivo
function balao(el, texto) {
  const area = el.closest("main");
  if (!area) return;
  const caixa = el.getBoundingClientRect();
  const areaCaixa = area.getBoundingClientRect();
  const bolha = Object.assign(document.createElement("span"), { className: "balao-miau", textContent: texto });
  bolha.style.left = caixa.left - areaCaixa.left + caixa.width / 2 + "px";
  // se o adesivo está colado no topo, o balão sai por baixo para não subir para fora da tela
  const acima = caixa.top - areaCaixa.top - 12;
  bolha.style.top = (acima < 48 ? caixa.bottom - areaCaixa.top + 6 : acima) + "px";
  area.append(bolha);
  setTimeout(() => bolha.remove(), 1200);
}

// miado sintetizado na hora: um "miau" sem arquivo de som para baixar
let audio;
function miar() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume?.();
  } catch { return; }
  const agora = audio.currentTime;
  const osc = audio.createOscillator();
  const filtro = audio.createBiquadFilter();
  const volume = audio.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(430, agora);
  osc.frequency.exponentialRampToValueAtTime(640, agora + 0.16);
  osc.frequency.exponentialRampToValueAtTime(330, agora + 0.58);
  filtro.type = "bandpass";
  filtro.Q.value = 4.5;
  filtro.frequency.setValueAtTime(950, agora);
  filtro.frequency.exponentialRampToValueAtTime(1600, agora + 0.18);
  filtro.frequency.exponentialRampToValueAtTime(760, agora + 0.55);
  volume.gain.setValueAtTime(0.0001, agora);
  volume.gain.exponentialRampToValueAtTime(0.22, agora + 0.07);
  volume.gain.exponentialRampToValueAtTime(0.0001, agora + 0.6);
  osc.connect(filtro).connect(volume).connect(audio.destination);
  osc.start(agora);
  osc.stop(agora + 0.62);
}

// cinco cliques no gato e ele responde
document.querySelectorAll('.adesivo[data-segredo="miar"]').forEach((gato) => {
  let cliques = 0;
  let ultimo = 0;
  gato.addEventListener("click", () => {
    const agora = Date.now();
    cliques = agora - ultimo > 2000 ? 1 : cliques + 1;
    ultimo = agora;
    if (cliques < 5) return;
    cliques = 0;
    miar();
    balao(gato, "miau!");
  });
});

// ---------- filtros das páginas ----------
// Uma barra serve estante, galerias e seções. Cada grupo de botões é um eixo (ano, mês,
// tipo...) e vale junto com os outros: escolher "2026" e "livros" mostra só livros de 2026.
// Clicar de novo no botão aceso desliga aquele eixo, igual ao "tudo".
const barraFiltros = document.querySelector(".filtros");
if (barraFiltros) {
  const itens = [...document.querySelectorAll(".filtravel")];
  const vazio = document.querySelector(".filtros-vazio");
  const escolhas = new Map(); // eixo -> valor escolhido ("" = todos)

  function aplicarFiltros() {
    let visiveis = 0;
    itens.forEach((item) => {
      // getAttribute e não dataset: os nomes dos eixos vêm de dados, sem virar camelCase
      const cabe = [...escolhas].every(([eixo, valor]) => !valor || (item.getAttribute("data-f-" + eixo) || "").split("|").includes(valor));
      item.hidden = !cabe;
      if (!cabe) return;
      // reinicia a entrada em cascata só para quem continua na tela
      item.style.setProperty("--atraso", visiveis * 35 + "ms");
      item.style.animation = "none";
      void item.offsetWidth;
      item.style.animation = "";
      visiveis += 1;
    });
    if (vazio) vazio.hidden = visiveis > 0;
  }

  barraFiltros.querySelectorAll(".filtro-grupo").forEach((grupo) => {
    const eixo = grupo.dataset.grupo;
    const botoes = [...grupo.querySelectorAll("button")];
    escolhas.set(eixo, "");
    botoes.forEach((botao) =>
      botao.addEventListener("click", () => {
        const valor = escolhas.get(eixo) === botao.dataset.valor ? "" : botao.dataset.valor;
        escolhas.set(eixo, valor);
        botoes.forEach((b) => b.setAttribute("aria-pressed", b.dataset.valor === valor));
        aplicarFiltros();
      })
    );
  });
}

// ---------- estante: ficha de um item ----------
const estante = document.querySelector(".estante");
if (estante) {
  // ficha completa do item, aberta sobre a página
  const folha = document.createElement("dialog");
  folha.className = "folha";
  folha.innerHTML = '<button type="button" class="folha-fechar" aria-label="Fechar">×</button><div class="folha-corpo"></div>';
  document.body.append(folha);
  const corpoFolha = folha.querySelector(".folha-corpo");
  folha.querySelector(".folha-fechar").addEventListener("click", () => folha.close());
  folha.addEventListener("click", (e) => e.target === folha && folha.close());

  estante.addEventListener("click", (e) => {
    const carta = e.target.closest(".carta");
    if (!carta) return;
    corpoFolha.replaceChildren(carta.parentElement.querySelector("template").content.cloneNode(true));
    folha.showModal();
  });
}

// ---------- outros projetos: pastas que abrem em janela ----------
document.querySelectorAll(".pasta[data-janela]").forEach((pasta) => {
  const janela = document.getElementById(pasta.dataset.janela);
  if (janela) pasta.addEventListener("click", () => janela.showModal());
});
document.querySelectorAll(".janela").forEach((janela) => {
  janela.querySelector(".janela-fechar").addEventListener("click", () => janela.close());
  janela.addEventListener("click", (e) => e.target === janela && janela.close());
});

// ---------- modo cozinha ----------
// A receita abre sobre a página com o fundo desfocado, a tela não apaga enquanto está aberta
// e cada ingrediente pode ser riscado com um toque.
const botoesCozinha = document.querySelectorAll(".botao-cozinha");
if (botoesCozinha.length) {
  const cozinha = document.createElement("dialog");
  cozinha.className = "cozinha";
  cozinha.innerHTML =
    '<div class="cozinha-topo"><strong></strong><span class="acoes"><span class="acesa"></span>' +
    '<button type="button" class="cozinha-imprimir">Imprimir</button>' +
    '<button type="button" class="cozinha-fechar" aria-label="Fechar">×</button></span></div>' +
    '<div class="cozinha-corpo"></div>';
  document.body.append(cozinha);
  const tituloCozinha = cozinha.querySelector("strong");
  const corpoCozinha = cozinha.querySelector(".cozinha-corpo");
  const avisoTela = cozinha.querySelector(".acesa");
  let receitaAberta = null;

  // mantém a tela acesa enquanto a receita está aberta (quando o navegador permite)
  let trava = null;
  async function manterAcesa() {
    try {
      trava = await navigator.wakeLock?.request("screen");
      avisoTela.textContent = trava ? "tela acesa" : "";
    } catch {
      avisoTela.textContent = "";
    }
  }
  function soltarTela() {
    trava?.release?.().catch(() => {});
    trava = null;
    avisoTela.textContent = "";
  }
  // voltar para a aba depois de o celular bloquear precisa pedir a trava de novo
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && cozinha.open && !trava) manterAcesa();
  });

  function montarCozinha(detalhe) {
    tituloCozinha.textContent = detalhe.querySelector("summary h2").textContent.trim();
    corpoCozinha.replaceChildren();

    const ficha = detalhe.querySelector(".ficha:not(.campo-vazio)");
    if (ficha) corpoCozinha.append(ficha.cloneNode(true));

    const ingredientes = [...detalhe.querySelectorAll('[data-editar="lista"] li')].map((li) => li.textContent.trim()).filter(Boolean);
    if (ingredientes.length) {
      const coluna = document.createElement("section");
      coluna.className = "coluna-ingredientes";
      coluna.append(Object.assign(document.createElement("h3"), { textContent: "Ingredientes" }));
      const lista = document.createElement("ul");
      lista.className = "ingredientes";
      lista.append(
        ...ingredientes.map((nome) => {
          const li = Object.assign(document.createElement("li"), { textContent: nome, tabIndex: 0 });
          li.setAttribute("role", "checkbox");
          li.setAttribute("aria-checked", "false");
          return li;
        })
      );
      coluna.append(lista);
      corpoCozinha.append(coluna);
    }

    const passos = [...detalhe.querySelectorAll(".item .texto:not(.campo-vazio)")];
    if (passos.length) {
      const coluna = document.createElement("section");
      coluna.className = "coluna-passos";
      coluna.append(Object.assign(document.createElement("h3"), { textContent: "Preparo" }));
      const caixa = document.createElement("div");
      caixa.className = "passos";
      passos.forEach((p) => caixa.append(...[...p.cloneNode(true).childNodes]));
      coluna.append(caixa);
      corpoCozinha.append(coluna);
    }
  }

  // riscar um ingrediente com toque, clique ou teclado
  const riscar = (li) => li.setAttribute("aria-checked", li.getAttribute("aria-checked") !== "true");
  corpoCozinha.addEventListener("click", (e) => {
    const li = e.target.closest(".ingredientes li");
    if (li) riscar(li);
  });
  corpoCozinha.addEventListener("keydown", (e) => {
    const li = e.target.closest(".ingredientes li");
    if (li && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      riscar(li);
    }
  });

  botoesCozinha.forEach((botao) =>
    botao.addEventListener("click", () => {
      receitaAberta = botao.closest("details");
      montarCozinha(receitaAberta);
      cozinha.showModal();
      manterAcesa();
    })
  );
  cozinha.querySelector(".cozinha-fechar").addEventListener("click", () => cozinha.close());
  cozinha.addEventListener("close", soltarTela);
  cozinha.querySelector(".cozinha-imprimir").addEventListener("click", () => {
    cozinha.close();
    imprimirReceita(receitaAberta);
  });
}

// ---------- imprimir uma receita ----------
// Some com o resto da página e deixa só a receita escolhida, com quadradinhos para marcar.
function imprimirReceita(detalhe) {
  if (!detalhe) return;
  const abertoAntes = detalhe.open;
  detalhe.open = true;
  detalhe.classList.add("imprimindo");
  html.classList.add("imprimindo-receita");
  const limpar = () => {
    html.classList.remove("imprimindo-receita");
    detalhe.classList.remove("imprimindo");
    detalhe.open = abertoAntes;
  };
  addEventListener("afterprint", limpar, { once: true });
  print();
}
document.querySelectorAll(".botao-imprimir").forEach((botao) => botao.addEventListener("click", () => imprimirReceita(botao.closest("details"))));

// por último: os botões de pasta e de estante já existem quando um link com #id é aberto
abrirDoLink();
