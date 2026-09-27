# Mudanças

O que mudou no site, do mais novo para o mais antigo. Só entram mudanças no funcionamento e na aparência; textos, fotos e itens da estante editados pelo painel ficam de fora (estão no [histórico de commits](https://github.com/lyrasid/lyrasid/commits/main)).

## Versão 5 · 2026-09-27

- **Registro de mudanças no site:** esta página, em `/mudancas/`, com o link "dev versão" no pé de todas as páginas.
- **Filtros abrem no período mais recente.** Estante, galerias e seções já entram no ano mais recente e, na estante, no último mês dele. O "tudo" continua a um clique.
  - Item ainda sem data conta como do período mais recente, para não sumir da tela inicial.
  - Link direto para um item de outro período (`#item`) abre sem filtro, para o item aparecer.
  - Dá para trocar de ano com um mês escolhido; o mês do ano antigo é solto sozinho.
- **`npm run adicionar` pergunta, no final, se quer commitar e enviar** o rascunho para o GitHub na hora.

## Versão 4 · 2026-09-26

- **`npm run adicionar`**: busca um título em APIs externas (Open Library, TMDB, RAWG) e cria o rascunho do item da estante com capa, autor e ano preenchidos.

## Versão 3 · 2026-09-20

- **Painel com uma coleção por página**, cada uma só com os campos que usa. ([#11](https://github.com/lyrasid/lyrasid/pull/11))
- **Filtros encadeados:** as opções acompanham o que sobrou na tela, e o mês carrega o ano junto. ([#10](https://github.com/lyrasid/lyrasid/pull/10))
- **Marca de versão no CSS e no JS**, para o navegador não segurar a versão antiga depois de publicar. ([#9](https://github.com/lyrasid/lyrasid/pull/9))
- **Filtros por ano, mês e tipo** nas páginas, montados a partir do próprio conteúdo. ([#7](https://github.com/lyrasid/lyrasid/pull/7))
- Corrigido o ano duplicado que quebrou a publicação. ([#8](https://github.com/lyrasid/lyrasid/pull/8))
- Corrigida a capa esticada na ficha da estante, que também ficou menor. ([#6](https://github.com/lyrasid/lyrasid/pull/6))
- Corrigido o formato da data da estante, que o painel gravava torto. ([#5](https://github.com/lyrasid/lyrasid/pull/5), e antes no próprio campo do painel)
- Adesivos: sai o efeito de descolar o canto ([#4](https://github.com/lyrasid/lyrasid/pull/4)); dá para ligar e desligar cada um pelo painel, e adesivo sem link vira só enfeite ([#2](https://github.com/lyrasid/lyrasid/pull/2)).
- **README** criado. ([#1](https://github.com/lyrasid/lyrasid/pull/1))
- **Seções novas:**
  - Estante de livros, filmes, séries e jogos, com ficha que abre sobre a página (absorve a antiga página Jogos).
  - Fotografias vira galeria, com página própria por coleção; Pinturas (antes Desenhos) segue o mesmo modelo, ainda oculta.
  - Outros projetos em pastas que abrem numa janela de computador antigo (absorve Apps).
  - Área restrita em `/secreto/`, pelo adesivo de cadeado.
- **Modo cozinha** nas receitas: tela que não apaga, ingredientes que se riscam ao toque e versão para imprimir.
- **Marca-texto** (`==assim==`) em amarelo, verde e vermelho, com botões no painel.
- **Papel de fundo** por seção (quadriculado, pautado ou liso), com textura tirada de fotos de papel de verdade.
- O gato mia com cinco cliques.

## Versão 2 · 2026-09-14

- **Prévia de compartilhamento** (Open Graph), favicon, menu aberto no computador até a primeira vez que o visitante fecha, e fotos em tela cheia com setas, teclado e deslize.
- **Segurança:** painel e bibliotecas do editor servidos pelo próprio site, sem CDN; fontes sem Google Fonts; token do editor guardado só na aba aberta; links externos em nova aba.
- **Correções da revisão:** editor avisa se o arquivo mudou em outro lugar antes de salvar; site publicado caiu de 57 MB para 7,4 MB; página 404 própria; menu e adesivos ajustados para o celular.
- **Editor visual:** editar títulos, organizar blocos em colunas e editar o texto de qualquer bloco; fontes maiores e quadriculado mais leve.
- **Modo de edição pelo site** (`?editar`): arrastar adesivos, pastas e subtítulos, editar textos com prévia real e ajustar a largura de imagens e vídeos.
- **Blocos com tipo** (texto, imagem, vídeo, receita, planta), lado a lado em até 3 colunas.
- **Imagens comprimidas** na publicação (WebP em três larguras).

## Versão 1 · 2026-09-13

- **Primeira versão:** site com Eleventy, barra lateral em pastas, seções retráteis e painel Sveltia CMS apontando para este repositório.
- Adesivos arrastáveis; páginas e textos editáveis pelo painel.
