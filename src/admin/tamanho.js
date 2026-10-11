// Campo "Tamanho na página" das imagens e vídeos: botões com o desenho de uma página e a foto
// ocupando ¼, ⅓, ½, ⅔, ¾ ou a largura inteira, no lugar de digitar a porcentagem.
//
// Grava o mesmo número de antes no campo "largura" (25, 33, 50...; inteira = vazio), então
// o site e o conteúdo antigo não mudam. Valor fora da lista (47%, feito com a alça do modo de
// edição) aparece como "personalizado" e continua valendo até outro botão ser escolhido.
//
// Campo personalizado do Sveltia (CMS.registerFieldType). O painel já traz o React e expõe
// window.h (= React.createElement): dá para escrever o componente sem etapa de build.
// (A documentação nova cita também um atalho `html`, mas a versão instalada não o tem.)
(() => {
  const OPCOES = [
    [25, "¼"],
    [33, "⅓"],
    [50, "½"],
    [67, "⅔"],
    [75, "¾"],
    [null, "inteira"],
  ];

  const Tamanho = ({ forID, value, onChange }) => {
    const numero = Number(value);
    const atual = value == null || value === "" || !numero || numero >= 100 ? null : numero;
    const personalizado = atual !== null && !OPCOES.some(([v]) => v === atual);
    return h(
      "div",
      { className: "tamanho-foto", role: "radiogroup", id: forID },
      ...OPCOES.map(([v, rotulo]) =>
        h(
          "button",
          { key: rotulo, type: "button", role: "radio", "aria-checked": atual === v, title: v ? v + "% da largura" : "largura inteira", onClick: () => onChange(v) },
          h("span", { className: "folha", "aria-hidden": true }, h("span", { className: "foto", style: { width: (v ?? 100) + "%" } })),
          rotulo
        )
      ),
      personalizado ? h("span", { className: "personalizado" }, `personalizado: ${atual}%`) : null
    );
  };

  CMS.registerFieldType("tamanho", Tamanho);
})();
