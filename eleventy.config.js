import markdownIt from "markdown-it";

const md = markdownIt({ linkify: true });
const porOrdem = (a, b) => (a.data.ordem ?? 999) - (b.data.ordem ?? 999) || a.data.title.localeCompare(b.data.title);
const visiveis = (api, glob) => api.getFilteredByGlob(glob).filter((i) => !i.data.oculto).sort(porOrdem);

export const config = {
  dir: { input: "src" },
  templateFormats: ["md", "njk"],
  markdownTemplateEngine: "njk",
};

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/midia");
  eleventyConfig.addPassthroughCopy("src/admin");

  eleventyConfig.addCollection("paginas", (api) => visiveis(api, "src/paginas/*.md"));
  eleventyConfig.addCollection("textos", (api) => visiveis(api, "src/conteudo/*.md"));

  eleventyConfig.addFilter("daPagina", (textos, slug) => textos.filter((t) => t.data.pagina === slug));
  eleventyConfig.addFilter("md", (texto) => md.render(texto || ""));
  eleventyConfig.addFilter("youtubeId", (link) => String(link).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)?.[1] ?? link);

  // Endereço de um texto: página dele + #subtítulo. Vazio se o texto ou a página estiverem ocultos.
  const linkDoTexto = (slug, textos, paginas) => {
    const texto = textos.find((t) => t.fileSlug === slug);
    const pagina = texto && paginas.find((p) => p.fileSlug === texto.data.pagina);
    return pagina ? eleventyConfig.getFilter("url")(pagina.url) + "#" + slug : "";
  };
  eleventyConfig.addFilter("linkDoTexto", linkDoTexto);

  // Busca só por título e página: um JSON pequeno embutido, sem biblioteca.
  eleventyConfig.addFilter("indiceBusca", (textos, paginas) => {
    const indice = textos.flatMap((t) => {
      const url = linkDoTexto(t.fileSlug, textos, paginas);
      if (!url) return [];
      return [{ titulo: t.data.title, secao: paginas.find((p) => p.fileSlug === t.data.pagina).data.title, url }];
    });
    return JSON.stringify(indice).replaceAll("<", "\\u003c");
  });
}
