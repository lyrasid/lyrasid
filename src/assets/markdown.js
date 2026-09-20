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

// Marca-texto: ==assim== vira um trecho grifado de caneta amarela.
// Para trocar a cor, comece com o nome dela: ==verde: assim== ou ==vermelho: assim==.
// Aceita negrito e links dentro do grifo.
const CORES_GRIFO = ["amarelo", "verde", "vermelho"];

export function marcaTexto(md) {
  const IGUAL = 0x3d;
  md.inline.ruler.before("emphasis", "marca", (state, silencioso) => {
    const inicio = state.pos;
    if (state.src.charCodeAt(inicio) !== IGUAL || state.src.charCodeAt(inicio + 1) !== IGUAL) return false;
    const fim = state.src.indexOf("==", inicio + 2);
    if (fim < 0 || fim === inicio + 2 || fim + 2 > state.posMax) return false;
    if (silencioso) {
      state.pos = fim + 2;
      return true;
    }
    // "==verde: texto==": o nome da cor e os dois-pontos não entram no texto grifado
    const conteudo = state.src.slice(inicio + 2, fim);
    const cor = CORES_GRIFO.find((c) => conteudo.toLowerCase().startsWith(c + ":"));
    const comeco = cor ? inicio + 2 + cor.length + 1 + (conteudo[cor.length + 1] === " " ? 1 : 0) : inicio + 2;
    if (comeco >= fim) return false;

    const limiteAntigo = state.posMax;
    const abertura = state.push("mark_open", "mark", 1);
    if (cor && cor !== "amarelo") abertura.attrSet("class", cor);
    state.pos = comeco;
    state.posMax = fim;
    state.md.inline.tokenize(state);
    state.push("mark_close", "mark", -1);
    state.pos = fim + 2;
    state.posMax = limiteAntigo;
    return true;
  });
  return md;
}

// Todas as regras do site em uma chamada só.
export const prepararMarkdown = (md) => marcaTexto(abrirExternosEmNovaAba(md));
