export default {
  layout: "secao.njk",
  eleventyComputed: {
    // o endereço vem do nome do arquivo; páginas ocultas não são publicadas
    permalink: (data) => (data.oculto ? false : `/${data.page.fileSlug}/`),
  },
};
