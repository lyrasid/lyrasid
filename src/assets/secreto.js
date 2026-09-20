// Terminal da área restrita. É um easter egg, não um cofre: a senha é conferida aqui
// no navegador, então quem abrir o código do site consegue entrar. Nada sigiloso aqui dentro.
const saida = document.querySelector(".saida");
const form = document.querySelector(".linha-comando");
const entrada = document.querySelector("#entrada");
const video = document.querySelector(".jumpscare");
const modelo = document.getElementById("conteudo-restrito");
const calma = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Marca da senha (djb2 em base 36). Guardada assim só para não ficar escrita por extenso.
const MARCA = "18gx0nk";
const marcar = (texto) => {
  let x = 5381;
  for (const c of texto) x = ((x * 33) ^ c.codePointAt(0)) >>> 0;
  return x.toString(36);
};

let liberado = false;
let erros = 0;

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function digitar(texto, velocidade = 14) {
  if (calma) return void (saida.textContent += texto + "\n");
  for (const letra of texto) {
    saida.textContent += letra;
    if (letra !== " ") await esperar(velocidade);
  }
  saida.textContent += "\n";
  saida.scrollTop = saida.scrollHeight;
}

const escrever = (texto) => {
  saida.textContent += texto + "\n";
  saida.scrollTop = saida.scrollHeight;
};

async function abertura() {
  form.hidden = true;
  await digitar("LYRA SYSTEMS  ·  terminal 0.98", 18);
  await digitar("----------------------------------------", 4);
  await esperar(200);
  await digitar("verificando identidade do visitante ... ok");
  await digitar("abrindo canal ......................... ok");
  await digitar("setor: ARQUIVO RESTRITO");
  await esperar(250);
  await digitar("");
  await digitar("Esta parte do caderno está trancada.");
  await digitar("Digite a senha e aperte Enter.");
  form.hidden = false;
  entrada.focus();
}

// O vídeo toca com som porque a pessoa acabou de apertar Enter: o navegador aceita
// tocar com som logo depois de um gesto assim.
async function jumpscare() {
  if (!video) return escrever("[nenhum vídeo configurado no painel]");
  document.body.classList.add("assustando");
  video.muted = false;
  video.currentTime = 0;
  try {
    await video.play();
  } catch {
    document.body.classList.remove("assustando");
    return escrever("[o navegador barrou o vídeo]");
  }
  await new Promise((pronto) => {
    const fim = () => {
      video.pause();
      pronto();
    };
    video.addEventListener("ended", fim, { once: true });
    video.addEventListener("click", fim, { once: true });
    addEventListener("keydown", (e) => e.key === "Escape" && fim(), { once: true });
  });
  document.body.classList.remove("assustando");
}

function revelar() {
  const caixa = document.createElement("div");
  caixa.className = "restrito";
  caixa.append(modelo.content.cloneNode(true));
  saida.after(caixa);
}

async function liberar() {
  liberado = true;
  form.hidden = true;
  await digitar("ACESSO AUTORIZADO", 30);
  await esperar(300);
  await jumpscare();
  escrever("");
  await digitar("bem-vindo de volta.", 24);
  revelar();
  entrada.type = "text";
  entrada.placeholder = "ajuda";
  form.hidden = false;
  entrada.focus();
}

const COMANDOS = {
  ajuda: () => escrever("comandos: ajuda · limpar · sair"),
  limpar: () => (saida.textContent = ""),
  // o endereço do link "sair" já vem com o prefixo certo do site publicado
  sair: () => (location.href = document.querySelector(".fuga a").href),
};

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const digitado = entrada.value.trim();
  entrada.value = "";
  if (!digitado) return;

  if (liberado) {
    escrever("> " + digitado);
    return (COMANDOS[digitado.toLowerCase()] ?? (() => escrever(`comando desconhecido: ${digitado}`)))();
  }

  escrever("> " + "•".repeat(digitado.length));
  if (marcar(digitado) === MARCA) return liberar();

  erros += 1;
  document.body.classList.add("negado");
  setTimeout(() => document.body.classList.remove("negado"), 400);
  escrever("ACESSO NEGADO");
  if (erros === 3) escrever("dica: é a senha que todo mundo usa quando não quer pensar.");
  if (erros >= 6) escrever("a porta continua trancada. o corredor também.");
});

// alguns navegadores não enviam o formulário só com Enter quando não há botão de enviar
entrada.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    form.requestSubmit();
  }
});

document.addEventListener("click", (e) => !e.target.closest("a") && !form.hidden && entrada.focus());
abertura();
