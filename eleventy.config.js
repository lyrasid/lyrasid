import { HtmlBasePlugin } from "@11ty/eleventy";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
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
  eleventyConfig.addFilter("dataBr", (valor) => (valor ? formatoData.format(new Date(valor)) : ""));
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
