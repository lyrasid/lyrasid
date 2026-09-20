// Cada tipo de página tem seu próprio modelo. "secao" é o caderno com subtítulos que abrem.
const LAYOUTS = {
  galeria: "galeria.njk", // capas em grade; cada item abre em página própria
  estante: "estante.njk", // livros, filmes, séries e jogos
  pastas: "pastas.njk", // pastas de computador que abrem em janela
};

export default {
  eleventyComputed: {
    layout: (data) => LAYOUTS[data.tipo] ?? "secao.njk",
    // o endereço vem do nome do arquivo; páginas ocultas não são publicadas
    permalink: (data) => (data.oculto ? false : `/${data.page.fileSlug}/`),
  },
};
