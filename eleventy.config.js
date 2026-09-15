import { HtmlBasePlugin } from "@11ty/eleventy";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import markdownIt from "markdown-it";
import { abrirExternosEmNovaAba } from "./src/assets/markdown.js";

const md = abrirExternosEmNovaAba(markdownIt({ linkify: true }));
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
  // src/midia não é copiada: o site usa só as versões comprimidas geradas abaixo (em /img).

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
  eleventyConfig.addFilter("youtubeId", (link) => String(link).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)?.[1] ?? link);

  // Endereço de um texto: página dele + #subtítulo. Vazio se o texto ou a página estiverem ocultos.
  const linkDoTexto = (slug, textos, paginas) => {
    const texto = textos.find((t) => t.fileSlug === slug);
    const pagina = texto && paginas.find((p) => p.fileSlug === texto.data.pagina);
    return pagina ? pagina.url + "#" + slug : "";
  };
  eleventyConfig.addFilter("linkDoTexto", linkDoTexto);

  // Busca só por título e página: um JSON pequeno embutido, sem biblioteca.
  eleventyConfig.addFilter("indiceBusca", (textos, paginas) => {
    const indice = textos.flatMap((t) => {
      const url = linkDoTexto(t.fileSlug, textos, paginas);
      if (!url) return [];
      return [{ titulo: t.data.title, secao: paginas.find((p) => p.fileSlug === t.data.pagina).data.title, url: eleventyConfig.getFilter("url")(url) }];
    });
    return JSON.stringify(indice).replaceAll("<", "\\u003c");
  });
}
