import markdownIt from "markdown-it";
import secoes from "./src/_data/secoes.json" with { type: "json" };

const md = markdownIt({ linkify: true });
const secaoDe = (item) => item.inputPath.match(/conteudo\/([^/]+)\//)[1];

export const config = {
  dir: { input: "src" },
  templateFormats: ["md", "njk"],
  markdownTemplateEngine: "njk",
};

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/midia");
  eleventyConfig.addPassthroughCopy("src/admin");

  eleventyConfig.addCollection("itens", (api) =>
    api
      .getFilteredByGlob("src/conteudo/*/*.md")
      .sort((a, b) => (a.data.ordem ?? 999) - (b.data.ordem ?? 999) || a.data.title.localeCompare(b.data.title))
  );

  eleventyConfig.addFilter("daSecao", (itens, slug) => itens.filter((i) => secaoDe(i) === slug));
  eleventyConfig.addFilter("md", (texto) => md.render(texto || ""));
  eleventyConfig.addFilter("youtubeId", (link) => String(link).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)?.[1] ?? link);

  // Busca só por título e seção: um JSON pequeno embutido na página, sem biblioteca.
  eleventyConfig.addFilter("indiceBusca", (itens) => {
    const url = eleventyConfig.getFilter("url");
    const indice = itens.map((i) => {
      const secao = secoes.find((s) => s.slug === secaoDe(i));
      return { titulo: i.data.title, secao: secao.titulo, url: url(`/${secao.slug}/`) + "#" + i.fileSlug };
    });
    return JSON.stringify(indice).replaceAll("<", "\\u003c");
  });
}
