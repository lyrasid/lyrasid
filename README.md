# lyrasid

Site pessoal do Sidcley Lyra, com cara de caderno: fundo de papel, adesivos e textos escritos à mão pelo próprio site.

Publicado em <https://lyrasid.github.io/lyrasid>.

Feito com [Eleventy](https://www.11ty.dev/), sem framework no navegador. O conteúdo são arquivos Markdown no repositório; o GitHub Actions publica no GitHub Pages a cada commit na `main`.

## Rodar aqui

```bash
npm install
npm start
```

Abre em <http://localhost:8080>. `npm run build` gera o site em `_site/` (não versionado).

## Como o conteúdo é escrito

Três jeitos, todos gravando no mesmo lugar (arquivos `.md` no repositório):

- **Painel** — `/admin/` no site publicado ([Sveltia CMS](https://github.com/sveltia/sveltia-cms), configurado em [config.yml](src/admin/config.yml)). Entra com o GitHub.
- **Edição pelo site** — o próprio site vira editor ([editar.js](src/assets/editar.js)). Pede um token do GitHub, que fica só na aba aberta.
- **Direto no arquivo** — editar o Markdown e commitar.

## Registro de mudanças

O [CHANGELOG.md](CHANGELOG.md) guarda o que mudou no funcionamento e na aparência do site, do mais novo para o mais antigo. **Toda mudança no código ou no visual ganha uma entrada no mesmo commit:** uma linha curta, em linguagem do site (o que muda para quem visita ou edita), sob a data do dia. Se já existe uma entrada daquele dia, entra junto dela.

Cada dia com mudanças é uma versão, com título `## Versão 0.x · DD.MM.AAAA` (por exemplo `## Versão 0.6 · 29.09.2026`): o primeiro dia novo ganha o número seguinte ao último. O site mostra esse arquivo em `/mudancas/`, com cada versão recolhível, e o pé de todas as páginas traz o link "versão 0.x", com o número lido do título mais recente — basta escrever a entrada para a versão do site subir.

Edições de conteúdo (textos, fotos, itens da estante) não entram: o histórico de commits já registra essas.

## Estrutura

| Pasta | O que tem |
|---|---|
| `src/paginas/` | As páginas do menu. O `tipo` no frontmatter escolhe o modelo: seção (padrão), `galeria`, `estante` ou `pastas`. |
| `src/conteudo/` | Os textos. Cada um pertence a uma página; em galerias vira página própria. |
| `src/estante/` | Livros, filmes, séries e jogos, com nota. |
| `src/now/` | Postagens da página Now (`/now/`), uma por arquivo, com data e texto. A mais recente fica em `/now/`; as outras, em `/now/antes/`. |
| `src/midia/` | Imagens e vídeos enviados pelo painel. |
| `src/_includes/` | Os modelos de página (Nunjucks). |
| `src/assets/` | CSS, scripts do site e fontes. |
| `scripts/` | Utilitários de build, fora do site. |

As regras de cada pasta (endereço, modelo, ordem) ficam nos `*.11tydata.js` dela; o resto está em [eleventy.config.js](eleventy.config.js).

## Detalhes que não são óbvios

- **Imagens** são comprimidas na publicação (WebP + JPEG de reserva, três larguras). `src/midia/` não é copiado como está — só vídeos passam direto.
- **Fontes e painel** são servidos pelo próprio site, sem CDN, com versão fixada pelo `package-lock.json`.
- **Texturas de papel** (`npm run texturas`) são geradas de fotos de papel de verdade em `scripts/papel/`. Só precisa rodar de novo se as fotos mudarem. Usa o `sharp`.
- **`npm run vendor`** reempacota as bibliotecas do editor visual para `src/assets/vendor/`. Só depois de mexer em [scripts/editor-libs.js](scripts/editor-libs.js).
- **`npm run adicionar`** busca um título em APIs externas (Open Library, TMDB, RAWG) e cria o rascunho de um item da estante em `src/estante/`, com capa, autor e ano já preenchidos — nota, datas e comentário ficam para você completar depois, no painel. Livro não precisa de chave; filme/série/jogo precisam (veja [.env.example](.env.example)). Uso: `npm run adicionar -- livro "Dom Casmurro"` (sem argumentos, pergunta o tipo e o título). No final, pergunta se quer commitar e enviar para o GitHub na hora — sem isso, o arquivo fica só no seu computador.
- **`/secreto/`** é piada interna, não cofre: a senha é conferida no navegador. Nada sigiloso ali.
- **`/papeis/`** são páginas de teste dos fundos, fora do menu. Dá para apagar depois de escolher.
