// Usado pelo site (eleventy.config.js) e pelo modo de edição (editar.js), para os dois mostrarem o mesmo resultado.
// Links externos (http/https) escritos no texto abrem em nova aba.
export function abrirExternosEmNovaAba(md) {
  const padrao = md.renderer.rules.link_open ?? ((tokens, i, opcoes, env, self) => self.renderToken(tokens, i, opcoes));
  md.renderer.rules.link_open = (tokens, i, opcoes, env, self) => {
    if (/^https?:\/\//i.test(tokens[i].attrGet("href"))) {
      tokens[i].attrSet("target", "_blank");
      tokens[i].attrSet("rel", "noopener");
    }
    return padrao(tokens, i, opcoes, env, self);
  };
  return md;
}
