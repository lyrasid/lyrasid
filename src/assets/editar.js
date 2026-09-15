// Modo de edição visual. Carregado só quando o modo está ligado (ver site.js).
// Lê e grava os arquivos direto no GitHub; todas as mudanças vão num único commit.
// Bibliotecas servidas pelo próprio site, sem CDN (gerado por: npm run vendor).
import { load, dump, markdownIt } from "./vendor/editor-libs.js";
import { abrirExternosEmNovaAba } from "./markdown.js";

const yaml = { load, dump };
const REPO = "lyrasid/lyrasid";
const RAMO = "main";
const md = abrirExternosEmNovaAba(markdownIt({ linkify: true })); // mesmas opções do site: HTML no texto não é renderizado
document.documentElement.classList.add("edicao");

// ---------- GitHub ----------
// O token fica só nesta aba (sessionStorage) e some ao fechá-la. Guardar para sempre (localStorage) deixava
// o token legível por qualquer outro projeto publicado em lyrasid.github.io.
localStorage.removeItem("github-token"); // limpa o token guardado por versões anteriores do editor
function token(pedir) {
  let t = sessionStorage.getItem("github-token");
  try { t ||= JSON.parse(localStorage.getItem("sveltia-cms.user"))?.token; } catch {}
  if (!t && pedir) {
    t = prompt("Cole um token do GitHub com permissão de escrita (Contents) em " + REPO + ".\nEle fica guardado só até você fechar esta aba.")?.trim();
    if (t) sessionStorage.setItem("github-token", t);
  }
  return t;
}

async function gh(caminho, metodo = "GET", corpo) {
  const t = token(metodo !== "GET");
  const r = await fetch(`https://api.github.com/repos/${REPO}${caminho}`, {
    method: metodo,
    cache: "no-store", // a API manda guardar leituras por 60s; ler versão velha desfazia o último Salvar
    headers: { Accept: "application/vnd.github+json", ...(t && { Authorization: `Bearer ${t}` }) },
    body: corpo && JSON.stringify(corpo),
  });
  if (r.status === 401) sessionStorage.removeItem("github-token");
  if (!r.ok) throw new Error(`GitHub respondeu ${r.status}`);
  return r.json();
}

// ---------- arquivos: frontmatter YAML + corpo ----------
const arquivos = new Map();
const alterados = new Set();

function abrir(caminho) {
  if (!arquivos.has(caminho)) {
    arquivos.set(caminho, gh(`/contents/${encodeURI(caminho)}?ref=${RAMO}`).then((r) => {
      const bytes = Uint8Array.from(atob(r.content.replace(/\n/g, "")), (c) => c.charCodeAt(0));
      const [, fm, corpo] = new TextDecoder().decode(bytes).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
      return { dados: yaml.load(fm) || {}, corpo, sha: r.sha };
    }));
  }
  return arquivos.get(caminho);
}

const ler = (obj, campo) => campo.split(".").reduce((o, k) => o?.[k], obj);
function definir(obj, campo, valor) {
  const chaves = campo.split(".");
  const ultima = chaves.pop();
  chaves.reduce((o, k) => (o[k] ??= {}), obj)[ultima] = valor;
}

async function alterar(caminho, campo, valor) {
  const a = await abrir(caminho);
  if (ler(a.dados, campo) === valor) return;
  definir(a.dados, campo, valor);
  alterados.add(caminho);
  atualizarBarra();
}

// Antes de gravar, confere se algum arquivo mudou no GitHub (painel, outra aba) desde que foi aberto aqui.
async function conferirConflitos() {
  const mudaram = [];
  await Promise.all([...alterados].map(async (path) => {
    const [atual, aberto] = await Promise.all([gh(`/contents/${encodeURI(path)}?ref=${RAMO}`), abrir(path)]);
    if (atual.sha !== aberto.sha) mudaram.push(path);
  }));
  if (!mudaram.length) return;
  const sobrescrever = confirm(
    "Estes arquivos foram alterados em outro lugar (painel ou outra aba) depois que você começou a editar:\n\n" +
    mudaram.join("\n") +
    "\n\nOK: salvar mesmo assim e substituir a outra versão.\nCancelar: não salvar. Recarregue a página para ver a versão nova (as mudanças feitas aqui se perdem)."
  );
  if (!sobrescrever) throw new Error("arquivo alterado em outro lugar");
}

async function salvar() {
  await conferirConflitos();
  const ref = await gh(`/git/ref/heads/${RAMO}`);
  const base = await gh(`/git/commits/${ref.object.sha}`);
  const tree = await Promise.all([...alterados].map(async (path) => {
    const { dados, corpo } = await abrir(path);
    return { path, mode: "100644", type: "blob", content: `---\n${yaml.dump(dados, { lineWidth: -1 })}---\n${corpo}` };
  }));
  const novaArvore = await gh("/git/trees", "POST", { base_tree: base.tree.sha, tree });
  const commit = await gh("/git/commits", "POST", { message: "Edição visual pelo site", tree: novaArvore.sha, parents: [ref.object.sha] });
  await gh(`/git/refs/heads/${RAMO}`, "PATCH", { sha: commit.sha });
  alterados.clear();
  arquivos.clear();
}

// ---------- barra ----------
const barra = document.createElement("div");
barra.className = "edicao-barra";
barra.innerHTML = `<strong>Modo edição</strong><small></small><button type="button" data-acao="salvar">Salvar</button><button type="button" data-acao="sair">Sair</button>`;
document.body.append(barra);
const aviso = barra.querySelector("small");
const botaoSalvar = barra.querySelector('[data-acao="salvar"]');
const DICA = "arraste · roda: tamanho · Shift+roda: girar · clique no texto";

function atualizarBarra(mensagem) {
  aviso.textContent = mensagem ?? (alterados.size ? `${alterados.size} arquivo(s) alterado(s)` : DICA);
  botaoSalvar.disabled = !alterados.size;
}
atualizarBarra(matchMedia("(max-width: 768px)").matches ? "use o computador para editar" : undefined);

botaoSalvar.addEventListener("click", async () => {
  botaoSalvar.disabled = true;
  atualizarBarra("salvando…");
  try {
    await salvar();
    atualizarBarra("salvo! o site atualiza em cerca de 1 minuto");
  } catch (erro) {
    atualizarBarra(`não salvou: ${erro.message}`);
    botaoSalvar.disabled = false;
  }
});
barra.querySelector('[data-acao="sair"]').addEventListener("click", () => {
  if (alterados.size && !confirm("Sair sem salvar as alterações?")) return;
  alterados.clear();
  localStorage.removeItem("editar");
  location.href = location.pathname;
});
addEventListener("beforeunload", (e) => alterados.size && e.preventDefault());

// ---------- adesivos: arrastar (site.js), roda = tamanho, Shift+roda = rotação ----------
document.addEventListener("click", (e) => e.target.closest(".adesivo") && e.preventDefault(), true);
document.querySelectorAll(".adesivos").forEach((camada) => {
  camada.querySelectorAll(".adesivo").forEach((el) => {
    const campo = (nome) => `adesivos.${el.dataset.indice}.${nome}`;
    const variavel = (nome) => parseFloat(getComputedStyle(el).getPropertyValue(nome));
    el.addEventListener("pointerup", () => {
      if (!el.style.left) return;
      alterar(camada.dataset.arquivo, campo("x"), Math.round((el.offsetLeft / camada.offsetWidth) * 100));
      alterar(camada.dataset.arquivo, campo("y"), Math.round(el.offsetTop));
    });
    el.addEventListener("wheel", (e) => {
      e.preventDefault();
      const passo = Math.sign(e.deltaY || e.deltaX);
      if (e.shiftKey) {
        const r = Math.max(-45, Math.min(45, variavel("--r") + passo * 3));
        el.style.setProperty("--r", r + "deg");
        alterar(camada.dataset.arquivo, campo("rotacao"), r);
      } else {
        const w = Math.max(40, Math.min(600, variavel("--w") - passo * 10));
        el.style.setProperty("--w", w + "px");
        alterar(camada.dataset.arquivo, campo("largura"), w);
      }
    }, { passive: false });
  });
});

// ---------- textos: markdown ao lado da prévia real ----------
document.querySelectorAll(".texto[data-campo]").forEach((div) => {
  div.addEventListener("click", async (e) => {
    if (div.previousElementSibling?.classList.contains("edicao-texto")) return;
    e.preventDefault();
    const { arquivo, campo } = div.dataset;
    const a = await abrir(arquivo);
    const area = document.createElement("textarea");
    area.className = "edicao-texto";
    area.value = ler(a.dados, campo) ?? "";
    const ajustar = () => { area.style.height = "auto"; area.style.height = area.scrollHeight + "px"; };
    area.addEventListener("input", () => {
      div.innerHTML = md.render(area.value);
      ajustar();
      alterar(arquivo, campo, area.value);
    });
    area.addEventListener("blur", () => area.remove());
    div.before(area);
    ajustar();
    area.focus();
  });
});

// ---------- ordem: arrastar pastas do menu e subtítulos ----------
function ordenavel(itens, alca = (el) => el) {
  let arrastado = null;
  itens.forEach((el) => {
    const pega = alca(el);
    pega.draggable = true;
    pega.addEventListener("dragstart", (e) => { arrastado = el; e.dataTransfer.effectAllowed = "move"; });
    pega.addEventListener("dragend", () => {
      arrastado = null;
      [...el.parentElement.children].filter((irmao) => itens.includes(irmao))
        .forEach((item, i) => alterar(item.dataset.arquivo, "ordem", i + 1));
    });
    el.addEventListener("dragover", (e) => {
      if (!arrastado || arrastado === el) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      el[e.clientY < r.top + r.height / 2 ? "before" : "after"](arrastado);
    });
  });
}
ordenavel([...document.querySelectorAll(".pastas a[data-arquivo]")]);
ordenavel([...document.querySelectorAll("details[data-arquivo]")], (d) => {
  const alca = Object.assign(document.createElement("span"), { className: "edicao-alca-subtitulo", textContent: "⠿", title: "Arraste para mudar a ordem" });
  alca.addEventListener("click", (e) => e.preventDefault());
  d.querySelector("summary").append(alca);
  return alca;
});

// ---------- campos de texto simples dos blocos: legendas e fichas ----------
document.querySelectorAll("[data-editar]").forEach((el) => {
  const tipo = el.dataset.editar;
  el.contentEditable = tipo === "lista" ? "true" : "plaintext-only";
  el.addEventListener("focus", () => {
    if (tipo === "lista" && !el.querySelector("li")) el.innerHTML = "<li></li>";
  });
  el.addEventListener("keydown", (e) => {
    if (tipo === "linha" && e.key === "Enter") { e.preventDefault(); el.blur(); }
  });
  if (el.dataset.campo === "title") {
    // título apagado volta ao último valor ao sair do campo
    let ultimo = el.innerText.trim();
    el.addEventListener("input", () => el.innerText.trim() && (ultimo = el.innerText.trim()));
    el.addEventListener("blur", () => !el.innerText.trim() && (el.textContent = ultimo));
  }
  if (el.closest("summary")) {
    // subtítulo: clicar ou dar espaço edita o texto em vez de abrir/fechar
    el.addEventListener("click", (e) => e.preventDefault());
    el.addEventListener("keyup", (e) => e.key === " " && e.preventDefault());
  }
  el.addEventListener("input", () => {
    const arquivo = el.closest("[data-arquivo]").dataset.arquivo;
    const valor = tipo === "lista"
      ? [...el.querySelectorAll("li")].map((li) => li.textContent.trim()).filter(Boolean)
      : el.innerText.trim();
    if (el.dataset.campo === "title") {
      if (!valor) return; // título vazio quebraria a ordenação do site; mantém o anterior
      document.querySelectorAll(`.pastas a[data-arquivo="${arquivo}"] span`).forEach((s) => (s.textContent = valor));
    }
    alterar(arquivo, el.dataset.campo, valor);
  });
});

// ---------- blocos: arrastar acima/abaixo muda a ordem; na lateral coloca lado a lado ----------
let blocoArrastado = null;
const LADOS = ["esquerda", "direita", "acima", "abaixo"];
const limparAlvo = () => document.querySelectorAll(".bloco").forEach((b) => b.classList.remove(...LADOS.map((l) => "alvo-" + l)));
const novaLinha = () => Object.assign(document.createElement("div"), { className: "linha" });

function posicao(e, el) {
  const r = el.getBoundingClientRect();
  const fx = (e.clientX - r.left) / r.width;
  if (fx < 0.25) return "esquerda";
  if (fx > 0.75) return "direita";
  return e.clientY < r.top + r.height / 2 ? "acima" : "abaixo";
}

// Remonta as linhas a partir do DOM (máx. 3 por linha) e grava a nova ordem + "ao lado" no arquivo.
function reorganizar(container) {
  const itens = [...container.querySelectorAll(".bloco")].map((el) => ({ el, antigo: Number(el.dataset.indice), aoLado: !!el.previousElementSibling }));
  container.replaceChildren();
  let linha;
  itens.forEach(({ el, aoLado }) => {
    if (!aoLado || linha.children.length >= 3) container.append((linha = novaLinha()));
    linha.append(el);
  });
  container.querySelectorAll(".linha").forEach((l) => {
    l.style.setProperty("--colunas", l.children.length);
    l.classList.toggle("colunas", l.children.length > 1);
  });
  const lados = itens.map(({ el }) => !!el.previousElementSibling);
  itens.forEach(({ el }, i) => {
    el.dataset.indice = i;
    el.querySelectorAll("[data-campo]").forEach((c) => (c.dataset.campo = c.dataset.campo.replace(/^blocos\.\d+\./, `blocos.${i}.`)));
  });
  atualizarBotoes(container);

  abrir(container.dataset.arquivo).then((a) => {
    const antigos = a.dados.blocos;
    if (itens.every(({ antigo }, i) => antigo === i && !!antigos[i].ao_lado === lados[i])) return;
    a.dados.blocos = itens.map(({ antigo }, i) => {
      const { ao_lado, ...bloco } = antigos[antigo];
      return lados[i] ? { ...bloco, ao_lado: true } : bloco;
    });
    alterados.add(container.dataset.arquivo);
    atualizarBarra();
  });
}

function atualizarBotoes(container) {
  container.querySelectorAll(".bloco").forEach((el, i) => {
    const botao = el.querySelector(".edicao-ao-lado");
    botao.hidden = i === 0;
    botao.setAttribute("aria-pressed", !!el.previousElementSibling);
  });
}

document.querySelectorAll(".blocos[data-arquivo]").forEach((container) => {
  container.querySelectorAll(".bloco").forEach((bloco) => {
    const ferramentas = document.createElement("div");
    ferramentas.className = "edicao-ferramentas";
    ferramentas.innerHTML = `<span class="edicao-mover" draggable="true" title="Solte acima ou abaixo de outro bloco para mudar a ordem, ou na lateral para ficar lado a lado">⠿ mover</span><button type="button" class="edicao-ao-lado" title="Ao lado do bloco anterior">ao lado</button>`;
    bloco.append(ferramentas);
    const [mover, aoLado] = ferramentas.children;

    mover.addEventListener("dragstart", (e) => {
      blocoArrastado = bloco;
      e.dataTransfer.setData("text/plain", "");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setDragImage(bloco, 20, 20);
    });
    mover.addEventListener("dragend", () => { blocoArrastado = null; limparAlvo(); });

    aoLado.addEventListener("click", () => {
      if (bloco.previousElementSibling) {
        // tira da linha: este bloco e os seguintes começam uma linha nova
        const linha = bloco.parentElement;
        const nova = novaLinha();
        for (let b = bloco, prox; b; b = prox) {
          prox = b.nextElementSibling;
          nova.append(b);
        }
        linha.after(nova);
      } else {
        bloco.parentElement.previousElementSibling?.append(bloco);
      }
      reorganizar(container);
    });

    const valido = () => blocoArrastado && blocoArrastado !== bloco && blocoArrastado.closest(".blocos") === container;
    bloco.addEventListener("dragover", (e) => {
      if (!valido()) return;
      e.preventDefault();
      e.stopPropagation();
      limparAlvo();
      bloco.classList.add("alvo-" + posicao(e, bloco));
    });
    bloco.addEventListener("drop", (e) => {
      if (!valido()) return;
      e.preventDefault();
      e.stopPropagation();
      const lado = posicao(e, bloco);
      if (lado === "esquerda") bloco.before(blocoArrastado);
      else if (lado === "direita") bloco.after(blocoArrastado);
      else {
        const nova = novaLinha();
        const linhaAlvo = bloco.parentElement;
        nova.append(blocoArrastado);
        linhaAlvo[lado === "acima" ? "before" : "after"](nova);
      }
      limparAlvo();
      reorganizar(container);
    });
  });
  atualizarBotoes(container);
});

// ---------- imagens e vídeos: alça no canto muda a largura ----------
document.querySelectorAll(".midia[data-campo]").forEach((fig) => {
  const alca = document.createElement("span");
  alca.className = "edicao-alca";
  alca.title = "Arraste para mudar a largura";
  fig.append(alca);
  alca.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    alca.setPointerCapture(e.pointerId);
    const inicio = fig.getBoundingClientRect().left;
    const total = fig.parentElement.clientWidth;
    let largura;
    const mover = (ev) => {
      largura = Math.max(20, Math.min(100, Math.round(((ev.clientX - inicio) / total) * 100)));
      fig.style.setProperty("--largura", largura + "%");
    };
    const soltar = () => {
      alca.removeEventListener("pointermove", mover);
      if (largura) alterar(fig.dataset.arquivo, fig.dataset.campo, largura);
    };
    alca.addEventListener("pointermove", mover);
    alca.addEventListener("pointerup", soltar, { once: true });
  });
});
