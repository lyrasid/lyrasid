// Modo de edição visual. Carregado só quando o modo está ligado (ver site.js).
// Lê e grava os arquivos direto no GitHub; todas as mudanças vão num único commit.
import yaml from "https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/+esm";
import markdownIt from "https://cdn.jsdelivr.net/npm/markdown-it@15.0.2/+esm";

const REPO = "lyrasid/lyrasid";
const RAMO = "main";
const md = markdownIt({ html: true, linkify: true });
document.documentElement.classList.add("edicao");

// ---------- GitHub ----------
function token(pedir) {
  let t = localStorage.getItem("github-token");
  try { t ||= JSON.parse(localStorage.getItem("sveltia-cms.user"))?.token; } catch {}
  if (!t && pedir) {
    t = prompt("Cole um token do GitHub com permissão de escrita (Contents) em " + REPO + ":")?.trim();
    if (t) localStorage.setItem("github-token", t);
  }
  return t;
}

async function gh(caminho, metodo = "GET", corpo) {
  const t = token(metodo !== "GET");
  const r = await fetch(`https://api.github.com/repos/${REPO}${caminho}`, {
    method: metodo,
    headers: { Accept: "application/vnd.github+json", ...(t && { Authorization: `Bearer ${t}` }) },
    body: corpo && JSON.stringify(corpo),
  });
  if (r.status === 401) localStorage.removeItem("github-token");
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
      return { dados: yaml.load(fm) || {}, corpo };
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

// ponytail: grava por cima do que estiver no GitHub; se o mesmo arquivo foi editado no painel
// depois de abrir o modo de edição, a versão do painel se perde. Comparar SHAs se isso acontecer.
async function salvar() {
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
ordenavel([...document.querySelectorAll("details[data-arquivo]")], (d) => d.querySelector("summary"));

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
