import fs from "node:fs";
import yaml from "js-yaml";

// Frontmatter das páginas do menu, lido direto do disco.
// Necessário porque o endereço de um item de galeria (/fotografias/praia/) precisa
// saber o tipo da página antes das coleções do Eleventy existirem.
export default () =>
  Object.fromEntries(
    fs
      .readdirSync("src/paginas")
      .filter((nome) => nome.endsWith(".md"))
      .map((nome) => {
        const texto = fs.readFileSync(`src/paginas/${nome}`, "utf8");
        return [nome.replace(/\.md$/, ""), yaml.load(texto.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "") || {}];
      })
  );
