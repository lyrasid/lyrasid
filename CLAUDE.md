# Projeto: lyrasid — site pessoal do Sidcley Lyra

Site pessoal com cara de caderno: fundo de papel (texturas de fotos reais de papel, pauta, quadrícula, margem vermelha), adesivos, letra "à mão" e detalhes no estilo das janelas antigas do Windows (bordas em relevo).
- Publicado em: https://lyrasid.github.io/lyrasid
- Repositório: github.com/lyrasid/lyrasid (branch main)
- Idioma: tudo em português do Brasil (código, nomes de arquivos, commits, textos).

## Tecnologia
- Eleventy 3 (site estático), modelos em Nunjucks, conteúdo em Markdown com frontmatter.
- Nenhum framework no navegador: JS puro em src/assets/ (site.js, editar.js, habitos.js, semanas.js, secreto.js, markdown.js).
- CSS único: src/assets/estilo.css. Variáveis principais: --vinho #6e2437, --tinta #111, --papel #fff, --esmeralda #3bf0a6. Fontes: Narnoor (texto) e Schoolbell (títulos), servidas pelo próprio site (@fontsource), sem CDN.
- Imagens otimizadas na publicação com @11ty/eleventy-img + sharp (WebP + JPEG de reserva, 3 larguras).
- Deploy: GitHub Actions (.github/workflows/publicar.yml) publica no GitHub Pages a cada commit na main. Commits só em dados/ não republicam o site.
- Comandos: npm start (localhost:8080), npm run build (_site/), npm run vendor (reempacota as libs do editor com esbuild), npm run texturas (gera as texturas de papel), npm run adicionar -- livro "Título" (cria um item da estante buscando na Open Library, TMDB ou RAWG).

## Três jeitos de editar o conteúdo (todos gravam .md no repositório)
1. Painel em /admin/ (Sveltia CMS, configurado em src/admin/config.yml), com login pelo GitHub.
2. Edição direto no site (editar.js), com token do GitHub guardado só na aba aberta.
3. Editar o Markdown e commitar.

## Estrutura
- src/paginas/: páginas do menu. O campo `tipo` no frontmatter escolhe o modelo: seção (padrão), galeria, estante, pastas, habitos ou semanas.
- src/conteudo/: textos, cada um ligado a uma página (divulgação científica, receitas, textos, outros hobbys...).
- src/estante/: livros, filmes, séries, jogos, músicas e shows, podcasts e coisas da internet, com nota, pausas e marca de releitura.
- src/now/: postagens da página Now (/now/ e /now/antes/).
- src/midia/: imagens e vídeos enviados pelo painel.
- src/_data/: site.json, categorias.json, now.json, semanas.json, mundo.json, secreto.json, secoes.js.
- src/_includes/: modelos (base, secao, galeria, estante, pastas, habitos, semanas, now, sobre, blocos...).
- Regras de cada pasta nos *.11tydata.js; o resto em eleventy.config.js.

## Páginas
Divulgação científica (filtro por tipo e ano), Textos, Fotografias, Desenhos & Pinturas, Plantas, Receitas (filtro por tipo e versão para impressão), Esportes (filtro por esporte), Estante, Outros hobbys, Trabalhos, Now, Hábitos, Vida em semanas, Mudanças (/mudancas/) e Secreto (/secreto/).

## Páginas especiais
- /habitos/: tracker mensal com 20 parâmetros em 5 grupos. Cores verde, amarelo, vermelho e cinza, pintura por arraste, gráfico de linha e visão do ano. Os dados ficam em dados/habitos.json, cifrados com AES-GCM (chave por PBKDF2 a partir da senha da página) e gravados pela API do GitHub. Perder a senha perde os dados.
- /semanas/: a vida até os 80 anos numa grade de 52 semanas por linha, montada no navegador. Pode colorir por fase, estudo, trabalho ou moradia, e mostra acontecimentos pessoais e do mundo/Brasil (dados em semanas.json e mundo.json, editáveis no painel).
- /secreto/: piada interna. A senha é conferida no navegador, então nada ali é sigiloso.

## Convenções de trabalho
- Toda mudança vai por pull request com descrição, nunca direto na main.
- Toda mudança de código ou de visual ganha uma entrada no CHANGELOG.md no mesmo commit: uma linha curta, em linguagem de quem visita ou edita o site, sob a data do dia. Cada dia com mudanças é uma versão: `## Versão 0.x · DD.MM.AAAA`, com o número seguinte ao último. O rodapé do site lê a versão desse título.
- Edições de conteúdo (textos, fotos, estante) não entram no changelog.
- Preferir soluções simples: recursos nativos do navegador, sem dependências novas sem necessidade e sem CDN.
- Ao mudar o `tipo` de uma página, conferir que o painel (config.yml) aceita esse tipo.
