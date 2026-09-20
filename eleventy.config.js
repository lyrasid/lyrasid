import { HtmlBasePlugin } from "@11ty/eleventy";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import fs from "node:fs";
import crypto from "node:crypto";
import markdownIt from "markdown-it";
import { prepararMarkdown } from "./src/assets/markdown.js";

const md = prepararMarkdown(markdownIt({ linkify: true }));
const porOrdem = (a, b) => (a.data.ordem ?? 999) - (b.data.ordem ?? 999) || a.data.title.localeCompare(b.data.title);
const visiveis = (api, glob) => api.getFilteredByGlob(glob).filter((i) => !i.data.oculto).sort(porOrdem);

export const config = {
  dir: { input: "src" },
  templateFormats: ["md", "njk"],
  markdownTemplateEngine: "njk",
};

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/admin");
  // vídeos não passam pelo compressor de imagens: são copiados como estão
  eleventyConfig.addPassthroughCopy("src/midia/**/*.{mp4,webm,mov,m4v}");
  // o resto de src/midia não é copiado: o site usa só as versões comprimidas geradas abaixo (em /img).

  // Fontes e painel servidos pelo próprio site (sem Google Fonts nem CDN; versões fixas pelo package-lock).
  const fontes = ["narnoor-latin-400", "narnoor-latin-ext-400", "narnoor-latin-700", "narnoor-latin-ext-700", "schoolbell-latin-400"];
  eleventyConfig.addPassthroughCopy({
    ...Object.fromEntries(fontes.map((f) => [`node_modules/@fontsource/${f.split("-")[0]}/files/${f}-normal.woff2`, `assets/fontes/${f}-normal.woff2`])),
    "node_modules/@sveltia/cms/dist/sveltia-cms.js": "admin/sveltia-cms.js",
  });

  // Prefixo do endereço (/lyrasid/) aplicado em todos os links e imagens do HTML final.
  eleventyConfig.addPlugin(HtmlBasePlugin);

  // Toda <img> do site é comprimida na publicação: WebP + JPEG de reserva, em até 3 larguras.
  // (JPEG em vez do formato original: PNG de foto gerava reservas de 12 MB.)
  // ponytail: reprocessa todas as imagens a cada publicação; guardar cache no GitHub Actions se ficar lento.
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    formats: ["svg", "webp", "jpeg"], // "svg" só vale para SVG de origem: adesivos vetoriais continuam vetoriais
    widths: [600, 1200, 2000],
    svgShortCircuit: true,
    htmlOptions: {
      imgAttributes: { loading: "lazy", decoding: "async", sizes: "(max-width: 768px) 100vw, 60vw" },
    },
  });

  // Endereço completo do site, para a prévia de compartilhamento (Open Graph). Na publicação vem do GitHub Pages.
  eleventyConfig.addGlobalData("urlSite", (process.env.SITE_URL || "https://lyrasid.github.io/lyrasid").replace(/\/$/, ""));

  eleventyConfig.addCollection("paginas", (api) => visiveis(api, "src/paginas/*.md"));
  eleventyConfig.addCollection("textos", (api) => visiveis(api, "src/conteudo/*.md"));
  eleventyConfig.addCollection("estante", (api) =>
    api
      .getFilteredByGlob("src/estante/*.md")
      .filter((i) => !i.data.oculto)
      .sort((a, b) => Number(new Date(b.data.data ?? 0)) - Number(new Date(a.data.data ?? 0)) || a.data.title.localeCompare(b.data.title))
  );

  // caminho do arquivo no repositório, usado pelo modo de edição para salvar
  // Marca de versão no endereço do CSS e do JS. Sem ela, o navegador segura a versão
  // antiga por até 10 minutos depois de publicar (Cache-Control do GitHub Pages) — e se
  // o nome de uma classe mudou nesse meio tempo, a página aparece sem estilo nenhum.
  // O número sai do conteúdo do arquivo: só muda quando o arquivo muda.
  eleventyConfig.addFilter("versao", (caminho) =>
    crypto.createHash("sha1").update(fs.readFileSync("src" + caminho)).digest("hex").slice(0, 8)
  );

  eleventyConfig.addFilter("arquivo", (inputPath) => inputPath.replace(/^\.\//, ""));
  eleventyConfig.addFilter("daPagina", (textos, slug) => textos.filter((t) => t.data.pagina === slug));

  // Agrupa blocos em linhas: "ao lado do bloco anterior" junta até 3 blocos na mesma linha.
  eleventyConfig.addFilter("emLinhas", (blocos) =>
    (blocos || []).reduce((linhas, bloco, indice) => {
      const ultima = linhas.at(-1);
      if (bloco.ao_lado && ultima?.length < 3) ultima.push({ bloco, indice });
      else linhas.push([{ bloco, indice }]);
      return linhas;
    }, [])
  );
  eleventyConfig.addFilter("md", (texto) => md.render(texto || ""));
  // Links digitados no painel: só http(s) e mailto (bloqueia javascript: e afins).
  eleventyConfig.addFilter("urlSegura", (url) => (/^(https?:|mailto:)/i.test(String(url ?? "").trim()) ? url : "#"));
  // Arquivos enviados pelo painel: só caminhos internos (bloqueia javascript: e endereços de fora).
  eleventyConfig.addFilter("arquivoSeguro", (caminho) => {
    const limpo = String(caminho ?? "").trim();
    // só caminho interno: começa com uma barra e não é endereço de outro site (//outro.site)
    return /^\/[^"'<>]*$/.test(limpo) && !limpo.startsWith("//") ? limpo : "";
  });
  eleventyConfig.addFilter("youtubeId", (link) => String(link).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)?.[1] ?? link);

  // Primeira imagem de um item: vira a capa na grade de galeria.
  eleventyConfig.addFilter("capa", (item) => item.data.capa || (item.data.blocos || []).find((b) => b.type === "imagem" && b.imagem)?.imagem || "");
  eleventyConfig.addFilter("contarImagens", (item) => (item.data.blocos || []).filter((b) => (b.type === "imagem" && b.imagem) || (b.type === "video" && b.youtube)).length);
  // Item anterior e seguinte dentro da mesma galeria.
  eleventyConfig.addFilter("vizinhos", (itens, slug) => {
    const i = itens.findIndex((t) => t.fileSlug === slug);
    return { anterior: itens[i - 1], proximo: itens[i + 1] };
  });
  eleventyConfig.addFilter("temBloco", (blocos, tipo) => (blocos || []).some((b) => b.type === tipo));
  // Datas do painel (2026-08-14) escritas por extenso. UTC para a data não voltar um dia.
  const formatoData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  // Data escrita torta no painel não derruba a publicação: o site sai sem a data.
  const dataValida = (valor) => {
    const data = valor ? new Date(valor) : null;
    return data && !Number.isNaN(+data) ? data : null;
  };
  eleventyConfig.addFilter("dataBr", (valor) => {
    const data = dataValida(valor);
    return data ? formatoData.format(data) : "";
  });

  // ---------- filtros das páginas ----------
  // As opções de cada filtro saem do próprio conteúdo: nada de lista fixa aqui.
  // Vão para o HTML separadas por "|", que aguenta valor com espaço ("no céu das plantas").
  const unicos = (lista) => [...new Set(lista.filter(Boolean))];
  const anosEscritos = (valor) => String(valor ?? "").match(/\d{4}/g) ?? [];
  const texto = (item, campo) => String(item.data[campo] ?? "").trim();

  // Um livro ou uma série ocupam vários meses: o período vai de "comecei" a "terminei".
  // Faltando um dos dois, vale só o outro; invertidos, a ordem se corrige sozinha.
  const periodo = (item) => {
    const a = dataValida(item.data.inicio) || dataValida(item.data.data);
    const b = dataValida(item.data.data) || dataValida(item.data.inicio);
    if (!a) return [];
    const [de, ate] = a <= b ? [a, b] : [b, a];
    const meses = [];
    const passo = new Date(Date.UTC(de.getUTCFullYear(), de.getUTCMonth(), 1));
    // ponytail: teto de 600 meses para um ano digitado errado não travar a publicação
    while (passo <= ate && meses.length < 600) {
      meses.push({ ano: String(passo.getUTCFullYear()), mes: MESES[passo.getUTCMonth()] });
      passo.setUTCMonth(passo.getUTCMonth() + 1);
    }
    return meses;
  };

  // ano escrito à mão (divulgação científica, fotografias): aceita "2024" e "2023–2026"
  eleventyConfig.addFilter("anosDoItem", (item) => anosEscritos(item.data.ano).join("|"));
  eleventyConfig.addFilter("opcoesAno", (itens) => unicos(itens.flatMap((i) => anosEscritos(i.data.ano))).sort().reverse());
  // campo de lista fixa: tipo de comida, tipo de planta
  eleventyConfig.addFilter("campoDoItem", texto);
  eleventyConfig.addFilter("opcoesCampo", (itens, campo) => unicos(itens.map((i) => texto(i, campo))).sort((a, b) => a.localeCompare(b, "pt-BR")));
  // estante: todo ano e todo mês que o item atravessou
  eleventyConfig.addFilter("anosDoPeriodo", (item) => unicos(periodo(item).map((m) => m.ano)).join("|"));
  // O mês anda junto do ano a que pertence: "2026-janeiro". Separados, o filtro deixava
  // escolher um mês de um ano e um ano de outro, e mostrava item que não era de nenhum dos dois.
  eleventyConfig.addFilter("mesesDoPeriodo", (item) => unicos(periodo(item).map((m) => m.ano + "-" + m.mes)).join("|"));
  eleventyConfig.addFilter("opcoesAnoPeriodo", (itens) => unicos(itens.flatMap((i) => periodo(i).map((m) => m.ano))).sort().reverse());
  eleventyConfig.addFilter("opcoesMesPeriodo", (itens) => {
    const presentes = unicos(itens.flatMap((i) => periodo(i).map((m) => m.ano + "-" + m.mes)));
    return presentes
      .sort((a, b) => b.split("-")[0].localeCompare(a.split("-")[0]) || MESES.indexOf(a.split("-")[1]) - MESES.indexOf(b.split("-")[1]))
      .map((par) => ({ valor: par, rotulo: par.split("-")[1], ano: par.split("-")[0] }));
  });
  eleventyConfig.addFilter("algumComBloco", (itens, tipo) => itens.some((i) => (i.data.blocos || []).some((b) => b.type === tipo)));
  // Nota de 0 a 5 em estrelas cheias e vazias.
  eleventyConfig.addFilter("estrelas", (nota) => "★".repeat(Math.round(nota || 0)) + "☆".repeat(Math.max(0, 5 - Math.round(nota || 0))));

  // Endereço de um texto: página própria (galeria) ou página da seção + #subtítulo.
  // Vazio se o texto ou a página estiverem ocultos.
  const linkDoTexto = (slug, textos, paginas) => {
    const texto = textos.find((t) => t.fileSlug === slug);
    if (!texto) return "";
    if (texto.url) return texto.url;
    const pagina = paginas.find((p) => p.fileSlug === texto.data.pagina);
    return pagina ? pagina.url + "#" + slug : "";
  };
  eleventyConfig.addFilter("linkDoTexto", linkDoTexto);

  // Busca só por título e página: um JSON pequeno embutido, sem biblioteca.
  eleventyConfig.addFilter("indiceBusca", (textos, paginas, estante) => {
    const paginaEstante = paginas.find((p) => p.data.tipo === "estante");
    const daEstante = (paginaEstante ? estante ?? [] : []).map((i) => ({
      titulo: i.data.title,
      secao: paginaEstante.data.title,
      url: eleventyConfig.getFilter("url")(paginaEstante.url + "#" + i.fileSlug),
    }));
    const indice = daEstante.concat(textos.flatMap((t) => {
      const url = linkDoTexto(t.fileSlug, textos, paginas);
      const pagina = paginas.find((p) => p.fileSlug === t.data.pagina);
      if (!url || !pagina) return [];
      return [{ titulo: t.data.title, secao: pagina.data.title, url: eleventyConfig.getFilter("url")(url) }];
    }));
    return JSON.stringify(indice).replaceAll("<", "\\u003c");
  });
}
