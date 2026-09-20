// Textos são pedaços de uma página: normalmente aparecem dentro dela, sem endereço próprio.
// A exceção são as páginas de galeria (fotografias, pinturas): lá cada item vira uma página.
const emGaleria = (data) => data.secoes?.[data.pagina]?.tipo === "galeria";

export default {
  eleventyComputed: {
    layout: (data) => (emGaleria(data) ? "item-galeria.njk" : undefined),
    permalink: (data) => (emGaleria(data) && !data.oculto ? `/${data.pagina}/${data.page.fileSlug}/` : false),
    // o papel do item é o mesmo da página a que ele pertence
    papel: (data) => data.secoes?.[data.pagina]?.papel,
  },
};
