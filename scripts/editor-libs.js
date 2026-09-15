// Entrada do pacote de bibliotecas do modo de edição, servido pelo próprio site (sem CDN).
// Regerar depois de atualizar js-yaml ou markdown-it: npm run vendor
export { load, dump } from "js-yaml";
export { default as markdownIt } from "markdown-it";
