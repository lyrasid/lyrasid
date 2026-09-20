// Botões de marca-texto na barra do editor de markdown do painel.
//
// O Sveltia não deixa acrescentar botão pela configuração: a lista aceita em "buttons" é
// fixa (negrito, itálico, tachado, código, link e os blocos) e não há como registrar uma
// marca nova. Então os botões são encaixados na barra aqui pelo navegador, copiando as
// classes de um botão que já existe para ficarem com a mesma aparência.
//
// Funcionam como o negrito: acendem quando o cursor está dentro de um grifo, e clicar
// neles ali tira o grifo. Clicar em outra cor troca a cor.
//
// Se um dia o painel mudar por dentro e os botões sumirem, nada quebra: continua dando
// para escrever ==verde: assim== na mão, que é o que os botões fazem.
(() => {
  // mesmas cores do site (ver "marca-texto" em assets/estilo.css)
  const CORES = [
    ["amarelo", "#fce02f"],
    ["verde", "#8ae874"],
    ["vermelho", "#ff8278"],
  ];
  const nomes = CORES.map(([nome]) => nome).join("|");
  // ==assim==, ==verde: assim==, ==vermelho:assim==
  // a flag "s" faz o ponto valer também para quebra de linha
  const GRIFO = new RegExp(`==(?:(${nomes}): ?)?(.*?)==`, "gis");
  const marcar = (cor, texto) => `==${cor === "amarelo" ? "" : cor + ": "}${texto}==`;

  // o editor tem dois campos e só um fica visível: o markdown cru e o texto formatado
  const campoAtivo = (editor) => {
    const area = editor.querySelector("textarea");
    return area?.offsetParent ? area : editor.querySelector(".lexical-root");
  };

  // ---------- posições dentro do texto formatado ----------
  // O editor rico quebra o parágrafo em vários pedaços de texto, e um grifo pode ficar
  // partido entre eles. Por isso as contas são feitas sobre o parágrafo inteiro, não
  // sobre o pedaço onde o cursor está.
  const paragrafoDe = (no, raiz) => {
    let elemento = no.nodeType === Node.TEXT_NODE ? no.parentElement : no;
    while (elemento && elemento.parentElement !== raiz) elemento = elemento.parentElement;
    return elemento;
  };

  function pedacosDe(paragrafo) {
    const pedacos = [];
    const caminhante = document.createTreeWalker(paragrafo, NodeFilter.SHOW_TEXT);
    for (let no = caminhante.nextNode(); no; no = caminhante.nextNode()) pedacos.push(no);
    return pedacos;
  }

  // posição contada desde o começo do parágrafo
  function posicaoNoParagrafo(paragrafo, no, deslocamento) {
    let total = 0;
    for (const pedaco of pedacosDe(paragrafo)) {
      if (pedaco === no) return total + deslocamento;
      total += pedaco.textContent.length;
    }
    return null;
  }

  // o caminho inverso: de uma posição no parágrafo para o pedaço e o deslocamento dele
  function pedacoNaPosicao(paragrafo, posicao) {
    let total = 0;
    const pedacos = pedacosDe(paragrafo);
    for (const pedaco of pedacos) {
      const fim = total + pedaco.textContent.length;
      if (posicao <= fim) return { no: pedaco, deslocamento: posicao - total };
      total = fim;
    }
    const ultimo = pedacos.at(-1);
    return ultimo && { no: ultimo, deslocamento: ultimo.textContent.length };
  }

  // ---------- ler e marcar a seleção, nos dois campos ----------
  function lerSelecao(alvo) {
    if (alvo.tagName === "TEXTAREA") {
      return { texto: alvo.value, inicio: alvo.selectionStart, fim: alvo.selectionEnd };
    }
    const selecao = getSelection();
    const inicioNo = selecao?.anchorNode;
    const fimNo = selecao?.focusNode;
    if (!inicioNo || !fimNo || !alvo.contains(inicioNo) || !alvo.contains(fimNo)) return null;
    if (inicioNo.nodeType !== Node.TEXT_NODE || fimNo.nodeType !== Node.TEXT_NODE) return null;
    const paragrafo = paragrafoDe(inicioNo, alvo);
    if (!paragrafo || paragrafoDe(fimNo, alvo) !== paragrafo) return null;
    const a = posicaoNoParagrafo(paragrafo, inicioNo, selecao.anchorOffset);
    const b = posicaoNoParagrafo(paragrafo, fimNo, selecao.focusOffset);
    if (a === null || b === null) return null;
    return { texto: paragrafo.textContent, inicio: Math.min(a, b), fim: Math.max(a, b), paragrafo };
  }

  function selecionar(alvo, leitura, inicio, fim) {
    if (alvo.tagName === "TEXTAREA") return alvo.setSelectionRange(inicio, fim);
    const de = pedacoNaPosicao(leitura.paragrafo, inicio);
    const ate = pedacoNaPosicao(leitura.paragrafo, fim);
    if (!de || !ate) return;
    const faixa = document.createRange();
    faixa.setStart(de.no, de.deslocamento);
    faixa.setEnd(ate.no, ate.deslocamento);
    const selecao = getSelection();
    selecao.removeAllRanges();
    selecao.addRange(faixa);
  }

  // O grifo que envolve o cursor, se houver.
  function grifoEmVolta(leitura) {
    for (const achado of leitura.texto.matchAll(GRIFO)) {
      const inicio = achado.index;
      const fim = inicio + achado[0].length;
      if (leitura.inicio >= inicio && leitura.fim <= fim) {
        return { inicio, fim, cor: (achado[1] ?? "amarelo").toLowerCase(), conteudo: achado[2] };
      }
    }
    return null;
  }

  function grifar(editor, cor) {
    const alvo = campoAtivo(editor);
    if (!alvo) return;
    alvo.focus();
    const leitura = lerSelecao(alvo);
    if (!leitura) return;

    const existente = grifoEmVolta(leitura);
    if (existente) {
      // mesma cor tira o grifo; cor diferente troca a cor
      selecionar(alvo, leitura, existente.inicio, existente.fim);
      document.execCommand("insertText", false, existente.cor === cor ? existente.conteudo : marcar(cor, existente.conteudo));
    } else {
      const selecionado = leitura.texto.slice(leitura.inicio, leitura.fim);
      // insertText em vez de mexer no valor direto: assim o painel percebe a mudança e o
      // Ctrl+Z continua funcionando
      document.execCommand("insertText", false, marcar(cor, selecionado));
      // sem nada selecionado, o cursor volta para dentro do grifo
      if (!selecionado && alvo.tagName === "TEXTAREA") {
        const dentro = alvo.selectionStart - 2;
        alvo.setSelectionRange(dentro, dentro);
      }
    }
    atualizarBotoes(editor);
  }

  // Acende o botão da cor em que o cursor está, como o painel faz com o negrito.
  function atualizarBotoes(editor) {
    const alvo = campoAtivo(editor);
    const leitura = alvo && document.activeElement === alvo ? lerSelecao(alvo) : null;
    const atual = leitura && grifoEmVolta(leitura);
    editor.querySelectorAll("[data-grifo-cor]").forEach((botao) => {
      const aceso = atual?.cor === botao.dataset.grifoCor;
      botao.setAttribute("aria-pressed", String(aceso));
      // o painel não desenha nada para aria-pressed, então o anel de aceso é feito aqui
      const amostra = botao.firstElementChild;
      if (amostra) amostra.style.boxShadow = aceso ? "inset 0 0 0 1px rgba(0,0,0,.4), 0 0 0 2px currentColor" : "inset 0 0 0 1px rgba(0,0,0,.4)";
    });
  }

  function aparelhar(editor) {
    if (editor.dataset.grifo) return;
    const grupo = editor.querySelector('[role="toolbar"] .button-group');
    if (!grupo) return;
    editor.dataset.grifo = "1";

    const modelo = grupo.querySelector("button");
    const novoGrupo = document.createElement("div");
    novoGrupo.className = grupo.className;

    for (const [cor, tinta] of CORES) {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = modelo?.className ?? "sui button medium iconic";
      botao.dataset.grifoCor = cor;
      botao.title = `Grifar em ${cor} (clique de novo para tirar)`;
      botao.setAttribute("aria-label", `Grifar em ${cor}`);
      botao.setAttribute("aria-pressed", "false");
      botao.innerHTML = `<span style="display:block;width:1em;height:1em;border-radius:3px;background:${tinta};box-shadow:inset 0 0 0 1px rgba(0,0,0,.4)"></span>`;
      botao.dataset.grifoTinta = tinta;
      // sem isso o clique tira o foco do editor e a seleção se perde antes de grifar
      botao.addEventListener("mousedown", (evento) => evento.preventDefault());
      botao.addEventListener("click", () => grifar(editor, cor));
      novoGrupo.append(botao);
    }
    grupo.after(novoGrupo);
  }

  const varrer = () => {
    try {
      document.querySelectorAll(".text-editor").forEach(aparelhar);
    } catch {
      // painel mudou por dentro: melhor ficar sem os botões do que quebrar a edição
    }
  };
  new MutationObserver(varrer).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("selectionchange", () => {
    try {
      document.querySelectorAll("[data-grifo]").forEach(atualizarBotoes);
    } catch {}
  });
  varrer();
})();
