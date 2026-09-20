// Gera as texturas de fundo do site a partir de fotos de papel de verdade (scripts/papel/).
// Rodar: npm run texturas
//
// A ideia: da foto sobra só a fibra do papel. A iluminação da foto é descontada (foto menos
// foto borrada), as linhas impressas são apagadas e o que resta vira um ladrilho que o CSS
// aplica por cima da cor do papel.
//
// O ladrilho fica quase branco, só com as partes escuras da fibra, e o CSS o aplica com
// "multiply". Foi o único jeito de a textura aparecer: "soft-light" sobre um fundo quase
// branco quase não muda nada.
//
// Os recortes saem no tamanho original da foto, sem reduzir: assim a fibra fica do tamanho
// que aparece na tela. Reduzir a foto virava vinco grande, e vinco grande espelhado vira
// desenho repetido, que tem cara de estampa e não de papel.
import sharp from "sharp";
import fs from "node:fs";

// scripts/papel/ guarda as fotos originais. A do quadriculado não é usada: apagar as
// linhas dela deixava uma marca em cada cruzamento, e o fundo virava grade de pontinhos.
const ORIGEM = "scripts/papel";
const DESTINO = "src/assets/papel";
const LADO = 500; // cada quadrante; o arquivo final tem o dobro
//
// Os recortes foram escolhidos medindo o desvio de cada pedaço depois de um borrão:
// quanto menos estrutura grande, menos o ladrilho espelhado parece estampa.

const PAPEIS = {
  claro: {
    foto: "pautado.webp",
    // pedaço mais uniforme da folha, escolhido pela medida descrita acima
    recorte: { left: 600, top: 600 },
    detalhe: 26, // o que for mais suave que isso é iluminação da foto, não papel
    contraste: 2.2,
    granulado: 3.5, // ruído fino por cima, para não ficar liso de perto
    forca: 0.9, // quanto a sombra escurece o papel
  },
};

const limitar = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

// Ruído gaussiano (Box-Muller), para a textura não ficar lisa de perto.
function sorteioNormal() {
  const a = Math.random() || 1e-9;
  return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * Math.random());
}

// Apaga o que for listra: desconta a média de cada fileira e de cada coluna.
// Linha impressa é exatamente isso — um desvio que vale para a fileira inteira.
// A fibra do papel não tem direção, então passa ilesa.
function tirarListras(valores) {
  for (const porFileira of [true, false]) {
    for (let a = 0; a < LADO; a++) {
      let soma = 0;
      for (let b = 0; b < LADO; b++) soma += valores[porFileira ? a * LADO + b : b * LADO + a];
      const media = soma / LADO;
      for (let b = 0; b < LADO; b++) valores[porFileira ? a * LADO + b : b * LADO + a] -= media;
    }
  }
}

async function relevo({ foto, recorte, detalhe, contraste, granulado, forca }) {
  const corte = { ...recorte, width: LADO, height: LADO };
  const base = sharp(`${ORIGEM}/${foto}`).extract(corte).greyscale();
  const nitido = await base.clone().raw().toBuffer();
  const borrado = await base.clone().blur(detalhe).raw().toBuffer();

  const valores = new Float32Array(nitido.length);
  for (let i = 0; i < valores.length; i++) valores[i] = (nitido[i] - borrado[i]) * contraste;
  tirarListras(valores);
  for (let i = 0; i < valores.length; i++) valores[i] += sorteioNormal() * granulado;

  // o ponto mais claro da fibra vira branco puro (não mexe no papel); o resto escurece
  const topo = [...valores].sort((a, b) => a - b)[Math.floor(valores.length * 0.98)];
  const saida = Buffer.allocUnsafe(valores.length);
  for (let i = 0; i < valores.length; i++) saida[i] = limitar(Math.round(255 - (topo - valores[i]) * forca));
  return saida;
}

// Quatro cópias espelhadas: as bordas do ladrilho batem entre si.
function espelhar(quadrante) {
  const total = LADO * 2;
  const ladrilho = Buffer.allocUnsafe(total * total);
  for (let y = 0; y < total; y++) {
    const oy = y < LADO ? y : total - 1 - y;
    for (let x = 0; x < total; x++) {
      const ox = x < LADO ? x : total - 1 - x;
      ladrilho[y * total + x] = quadrante[oy * LADO + ox];
    }
  }
  return ladrilho;
}

fs.mkdirSync(DESTINO, { recursive: true });
for (const [nome, receita] of Object.entries(PAPEIS)) {
  const ladrilho = espelhar(await relevo(receita));
  const saida = `${DESTINO}/textura-${nome}.webp`;
  // granulado é quase incompressível: abaixo de 78 ele vira manchão quadrado, acima disso
  // o arquivo dobra de tamanho sem diferença visível
  const info = await sharp(ladrilho, { raw: { width: LADO * 2, height: LADO * 2, channels: 1 } }).webp({ quality: 78 }).toFile(saida);
  console.log(`${saida}  ${info.width}x${info.height}  ${Math.round(info.size / 1024)} kB`);
}
