// Cria um rascunho de item da estante buscando o título em APIs externas (Open Library para
// livros, TMDB para filmes e séries, RAWG para jogos): baixa a capa, comprime como o painel faz
// (WebP, até 2048px) e grava um .md pronto em src/estante/. Nota, data e comentário ficam em
// branco de propósito — só dá para saber isso depois de terminar a obra, então quem preenche
// é você mesmo, no painel.
//
// Rodar: npm run adicionar -- <livro|filme|serie|jogo> "<título>"
// Sem argumentos, o script pergunta interativamente.
//
// Chaves de API: copie .env.example para .env. Livros não precisam de chave.
import sharp from "sharp";
import fs from "node:fs";
import readline from "node:readline/promises";
import { dump } from "js-yaml";

const PASTA_ESTANTE = "src/estante";
const PASTA_CAPAS = "src/midia/estante";

carregarEnv();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const perguntar = (texto) => rl.question(texto);

const BUSCAS = {
  livro: buscarLivro,
  filme: (q) => buscarTmdb(q, "movie"),
  serie: (q) => buscarTmdb(q, "tv"),
  jogo: buscarJogo,
};

try {
  await main();
} catch (erro) {
  console.error(`\nErro: ${erro.message}`);
  process.exitCode = 1;
} finally {
  rl.close();
}

async function main() {
  let [tipo, ...resto] = process.argv.slice(2);
  let titulo = resto.join(" ").trim();

  if (tipo && !BUSCAS[tipo]) {
    console.log(`Não conheço o tipo "${tipo}" — escolha na lista abaixo.`);
    tipo = null;
  }
  if (!tipo) tipo = await escolherTipo();
  if (!titulo) titulo = (await perguntar("Título para buscar: ")).trim();
  if (!titulo) throw new Error("preciso de um título para buscar.");

  console.log(`\nBuscando "${titulo}"...`);
  const resultados = dedupe(await BUSCAS[tipo](titulo));
  if (resultados.length === 0) {
    console.log("Nada encontrado. Tente um termo mais simples ou crie o item manualmente no painel.");
    return;
  }

  resultados.forEach((r, i) => console.log(`${i + 1}. ${r.titulo}${r.ano ? ` (${r.ano})` : ""}${r.autor ? ` — ${r.autor}` : ""}`));
  const escolha = (await perguntar("\nEscolha um número (Enter para cancelar): ")).trim();
  const indice = Number(escolha) - 1;
  if (!escolha || Number.isNaN(indice) || !resultados[indice]) {
    console.log("Cancelado.");
    return;
  }
  const item = resultados[indice];
  if (item.detalhar) await item.detalhar(item); // segunda chamada: só busca autoria de quem foi escolhido

  const slug = nomeUnico(slugificar(item.titulo));
  const capa = item.capaUrl ? await baixarCapa(item.capaUrl, slug) : "";
  if (item.capaUrl && !capa) console.log("Não consegui baixar a capa — adicione manualmente no painel.");

  gravarArquivo(slug, { title: item.titulo, tipo, autor: item.autor || "", ano: item.ano || "", capa });

  console.log(`\nCriado: ${PASTA_ESTANTE}/${slug}.md${capa ? ` + ${capa}` : ""}`);
  console.log("Falta: nota, data e comentário — preencha no painel quando terminar a obra.");
  console.log("E não esquecer: git add, commit e push. O painel e o site só mostram o que já estiver no GitHub.");
}

async function escolherTipo() {
  console.log("1. Livro\n2. Filme\n3. Série\n4. Jogo");
  const mapa = { 1: "livro", 2: "filme", 3: "serie", 4: "jogo" };
  for (;;) {
    const resp = (await perguntar("Tipo: ")).trim();
    if (mapa[resp]) return mapa[resp];
    console.log("Não entendi — digite 1, 2, 3 ou 4.");
  }
}

// Lê .env na raiz do projeto (arquivo local, fora do git) e completa process.env.
function carregarEnv() {
  if (!fs.existsSync(".env")) return;
  for (const linha of fs.readFileSync(".env", "utf8").split("\n")) {
    const m = linha.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/);
    if (!m || linha.trim().startsWith("#")) continue;
    const [, chave, bruto] = m;
    if (!(chave in process.env)) process.env[chave] = bruto.replace(/^["']|["']$/, "").replace(/["']$/, "");
  }
}

function exigirChave(nome, ondeConseguir) {
  const chave = process.env[nome];
  if (!chave) throw new Error(`falta ${nome} no .env (chave grátis em ${ondeConseguir}). Veja .env.example.`);
  return chave;
}

async function buscarJson(url) {
  const controlador = new AbortController();
  const tempo = setTimeout(() => controlador.abort(), 10_000);
  try {
    const resposta = await fetch(url, { signal: controlador.signal });
    if (!resposta.ok) throw new Error(`a API respondeu ${resposta.status} — tente de novo em instantes.`);
    return await resposta.json();
  } finally {
    clearTimeout(tempo);
  }
}

async function buscarLivro(query) {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8&fields=title,author_name,first_publish_year,cover_i`;
  const dados = await buscarJson(url);
  return (dados.docs || []).map((d) => ({
    titulo: d.title,
    autor: (d.author_name || []).join(", "),
    ano: d.first_publish_year || "",
    capaUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : "",
  }));
}

async function buscarTmdb(query, tipoTmdb) {
  const chave = exigirChave("TMDB_API_KEY", "https://www.themoviedb.org/settings/api");
  const url = `https://api.themoviedb.org/3/search/${tipoTmdb}?api_key=${chave}&language=pt-BR&query=${encodeURIComponent(query)}`;
  const dados = await buscarJson(url);
  return (dados.results || []).slice(0, 8).map((r) => ({
    titulo: tipoTmdb === "movie" ? r.title : r.name,
    ano: ((tipoTmdb === "movie" ? r.release_date : r.first_air_date) || "").slice(0, 4),
    autor: "",
    capaUrl: r.poster_path ? `https://image.tmdb.org/t/p/w780${r.poster_path}` : "",
    // diretor (filme) ou criador (série): só a API de detalhe/créditos tem essa informação
    detalhar: async (item) => {
      item.autor =
        tipoTmdb === "tv"
          ? (await buscarJson(`https://api.themoviedb.org/3/tv/${r.id}?api_key=${chave}&language=pt-BR`)).created_by?.map((c) => c.name).join(", ") || ""
          : (await buscarJson(`https://api.themoviedb.org/3/movie/${r.id}/credits?api_key=${chave}`)).crew
              ?.filter((c) => c.job === "Director")
              .map((c) => c.name)
              .join(", ") || "";
    },
  }));
}

async function buscarJogo(query) {
  const chave = exigirChave("RAWG_API_KEY", "https://rawg.io/apidocs");
  const url = `https://api.rawg.io/api/games?key=${chave}&search=${encodeURIComponent(query)}&page_size=8`;
  const dados = await buscarJson(url);
  return (dados.results || []).map((r) => ({
    titulo: r.name,
    ano: (r.released || "").slice(0, 4),
    autor: "",
    capaUrl: r.background_image || "",
    // desenvolvedora: a busca não traz isso, só o detalhe do jogo
    detalhar: async (item) => {
      const d = await buscarJson(`https://api.rawg.io/api/games/${r.id}?key=${chave}`);
      item.autor = (d.developers || []).map((e) => e.name).join(", ");
    },
  }));
}

// Tira duplicatas (a mesma obra em edições diferentes, comum na Open Library).
function dedupe(resultados) {
  const vistos = new Set();
  return resultados.filter((r) => {
    const chave = `${r.titulo}|${r.ano}`.toLowerCase();
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

async function baixarCapa(url, slug) {
  try {
    const resposta = await fetch(url);
    if (!resposta.ok) return "";
    const buffer = Buffer.from(await resposta.arrayBuffer());
    fs.mkdirSync(PASTA_CAPAS, { recursive: true });
    const destino = `${PASTA_CAPAS}/${slug}.webp`;
    // mesmo tratamento que o painel aplica às fotos enviadas por lá (ver src/admin/config.yml)
    await sharp(buffer)
      .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(destino);
    return `/midia/estante/${slug}.webp`;
  } catch {
    return "";
  }
}

// Igual ao slug do painel (src/admin/config.yml: encoding ascii, clean_accents).
function slugificar(texto) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function nomeUnico(base) {
  let slug = base;
  for (let n = 2; fs.existsSync(`${PASTA_ESTANTE}/${slug}.md`); n++) slug = `${base}-${n}`;
  return slug;
}

function gravarArquivo(slug, dados) {
  fs.mkdirSync(PASTA_ESTANTE, { recursive: true });
  fs.writeFileSync(`${PASTA_ESTANTE}/${slug}.md`, `---\n${dump(dados)}---\n`);
}
