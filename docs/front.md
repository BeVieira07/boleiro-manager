# Front do Boleiro Manager

Visual baseado na maquete do front (tema escuro verde). Tudo fica em `css/style.css` (tokens e componentes) e `css/escalacao.css` (campo da escalação). Não há build: as telas são HTML montado em `ui/*.mjs`.

## Tokens (`:root` em `css/style.css`)

| Grupo | Tokens | Uso |
|---|---|---|
| Fundos | `--bg`, `--lateral`, `--painel`, `--painel2`, `--painel3` | página, menu lateral, cartões, campos e linhas internas, cabeçalho de tabela |
| Linhas | `--linha`, `--linha2` | bordas de cartão e divisórias de tabela |
| Texto | `--texto`, `--texto2`, `--muted` | principal, secundário, apoio |
| Acento | `--verde` (+ `--verde-esc`, `--verde-claro`, `--tinta-verde`) | ação principal, item ativo, valores bons |
| Destaque | `--ouro` (+ `-esc`, `-borda`, `-claro`) | títulos de seção, seleção, avisos |
| Perigo | `--perigo` (texto) e `--perigo-forte` (fundo de botão), `-esc`, `-borda`, `-claro` | erros, rebaixamento, lesão |
| Informação | `--info` | zona de classificação, notas |
| Neutro | `--neutro` | empate, estados sem cor |
| Posição | `--pos-g/d/m/a` e `--pos-*-t` | sigla da posição por grupo (fundo e texto) |
| Forma | `--r-sm` 8, `--r` 12, `--r-lg` 16, `--r-pill`; `--sombra` | cantos e sombra de modal |
| Espaço | `--e1` 4 … `--e6` 28 px | espaçamentos |
| Fontes | `--f-titulo` Barlow Condensed, `--f-texto` Inter | títulos e números grandes; texto |
| Foco | `--foco` | anel de foco dourado (`:focus-visible`) |

Os nomes antigos (`--panel`, `--accent`, `--danger`…) apontam para os novos e servem só para estilos antigos ainda inline.

**Contraste:** todo par de texto e fundo usado passa 4,5:1. O teste `tests/contraste.test.mjs` lê os tokens deste arquivo e confere a lista de pares; ao criar um par novo, acrescente-o lá. Cores que precisam ser distinguidas (vitória, empate e derrota; ok e erro) diferem também na luminosidade, não só no tom, e têm texto ou ícone junto.

## Componentes

| Classe | Como usar |
|---|---|
| `.card` | cartão com borda e cantos de 16 px. `.card.destaque` tem fundo em degradê (próximo jogo); `.card.tabela-card` não tem padding, para tabelas encostarem na borda. `.card-topo` alinha título e ações. |
| `.btn` | botão primário (verde). `.sec` secundário, `.perigo` (ou `.red`) para perda, `.fantasma` sem fundo, `.icone-so` só com ícone (precisa de `aria-label`). Tamanhos `.sm` e `.big`. |
| `.chip` | opção ou filtro; `.on` ou `aria-pressed="true"` marca o ativo. Agrupe em `.chips` com `role="group"` e `aria-label`. JS: `chip(rotulo, acao, on)` em `ui/componentes.mjs`. |
| `.pill` | informação curta, sem clique. |
| `.tag` | status: `.ok`, `.aviso`, `.erro`, `.info`. JS: `tag(texto, tipo)`. |
| `.pos.G/.D/.M/.A` | sigla da posição colorida pelo grupo (`posTag(p)` em `ui/posicoes.mjs`). |
| `.ovr.alto/.medio/.baixo` | overall em chip: alto 76+, médio 68–75, baixo até 67. JS: `ovrChip(v)`. |
| `.tend` | seta de tendência do overall (`tendenciaTag(p)`). |
| `.barra` | progresso (8 px; `.fina` 6 px). JS: `barra(pct, cor)`. |
| `.stats` + `.stat` | linha de indicadores com rótulo, valor grande (`.stat-valor`), unidade, barra e subtexto. JS: `stat({rotulo, valor, unid, sub, cor, pct})`. |
| `table` / `.tw` / `.tabela-rolavel` | O contêiner da tabela rola na horizontal quando precisa. Use `tabindex="0"`, `role="region"` e um nome acessível para permitir que as setas desloquem a tabela. `tr.me` destaca o seu clube, `tr.tit` os titulares, `td.n` alinha números à direita e `td.c` centraliza. |
| `.busca` | campo de busca com ícone. |
| `.crest` | escudo redondo (`.m` 40 px, `.g` 68 px). `crest(c)` em `ui/partida.mjs` troca pela sigla colorida se a imagem falhar. |

## Ícones

`ui/icones.mjs`: `icone(nome, {tam, rotulo})` devolve um `<svg>` de traço que herda a cor do texto. Sem `rotulo` ele é decorativo (`aria-hidden`); com `rotulo` vira imagem com nome. A lista está em `ICONES`. Use ícones no lugar de emoji.

## Módulos das telas

| Módulo | O que tem |
|---|---|
| `ui/layout.mjs` | menu lateral (barra inferior no celular) e barra de ações do topo (#58) |
| `ui/clube.mjs` | painel do clube (#59) |
| `ui/elenco.mjs`, `ui/jogadores.mjs` | tabela do Elenco; filtros, busca e ordenação reaproveitados pelo Mercado (#60) |
| `ui/base.mjs`, `css/temporada-figma.css` | aba Base do grupo Time, com resumo de vagas e chegada de jovens, lista e ações de promoção e venda (#270) |
| `ui/escalacao.mjs`, `css/escalacao.css` | campo com cartas (#61) |
| `ui/partida.mjs` | linha do tempo, escudo e modal; `ui/aovivo.mjs` é a tela da rodada ao vivo (#62, #135) |
| `ui/competicoes.mjs` | painel de Competições: próximos jogos, uma linha por competição e as que ficaram de fora; cada competição devolve o cartão dela (#175, maquete em `docs/maquetes/competicoes.png`) |
| `ui/mercado.mjs` | tela Mercado: indicadores (`stat`), abas com contagem, filtros (país, liga, clube, posição, busca, valor máx.) e tabela com situação e negociação (#186, maquete em `docs/maquetes/mercado.png`); o botão de ver o jogador fica de fora até haver tela de detalhe |
| `ui/artilharia.mjs` | tela Artilharia: filtros por competição, pódio, ranking com empate e "seus artilheiros"; todas as competições viram o mesmo modelo de linhas (`linhasDe`) (#184, maquete em `docs/maquetes/artilharia.png`) |
| `ui/avisos.mjs` | `avisar` (toasts), `confirmar` e `pedirValor` no lugar de `alert`, `confirm` e `prompt` (#64) |

Atributos de evento (ligados em `ui/main.mjs`): `data-acao` (clique), `data-mudar` (change) e `data-digitar` (cada tecla; use quando a tela não pode ser redesenhada inteira, para o campo não perder o foco).

## Acessibilidade (#65)

- Tudo que se clica é `<button>`, `<a>` ou campo. Nunca `data-acao` em `div`, `li` ou `tr`.
- Botão só com ícone (`.icone-so`) tem `aria-label`. Ícone decorativo é `aria-hidden`; ícone que carrega sentido usa `icone(nome, {rotulo})`.
- Todo campo tem `<label>` (ou `aria-label`). Grupos de chips têm `role="group"` e `aria-label`. Tabelas têm `<caption>` (pode ser `.sr`) e `scope` nos cabeçalhos.
- Cor nunca é a única informação: V/E/D têm a letra (e a derrota tem outra forma), zonas da tabela têm texto para leitor de tela, lesão e penalidade aparecem escritas.
- Foco: anel dourado em `:focus-visible`; `render()` devolve o foco ao mesmo botão ou campo depois de redesenhar; trocar de tela leva o foco ao conteúdo; o primeiro Tab mostra "Pular para o conteúdo". Modais prendem o foco e fecham com Esc.
- Alvos de toque de 44 px em tela de toque (`@media(pointer:coarse)`). No computador, botões `.sm` continuam compactos.
- Animações e transições somem com `prefers-reduced-motion`.
- A página faz a rolagem vertical do conteúdo. Menus e modais que excedem a altura disponível rolam no próprio painel. Um modal pausa a rolagem da página enquanto estiver aberto.
- Para auditar largura e painéis roláveis no Chrome, execute `npm start` e `node scripts/navegador.mjs http://localhost:3000/ scripts/medir-rolagem.js` com `LARGURA` em 360, 390, 1366 e 1920. Use `ALTURA` para testar janelas baixas.
- Ao vivo (#310, #314): tática, formação e trocas ficam numa janela só (`ui/expulsao.mjs`, camada `#av-expulsao`), em duas variantes: **pausa** (aberta pelo botão Pausar, cabeçalho dourado) e **expulsão** (abre sozinha no vermelho do seu time, cabeçalho vermelho). As mudanças ficam num rascunho e só valem ao continuar. Abaixo de 800 px a janela vira folha de baixo, com a tática em linhas que rolam para o lado. No replay da liga a janela não abre.
- `tests/acessibilidade.test.mjs` percorre todas as telas e confere essas regras; `tests/telas.test.mjs` garante que nenhuma classe do CSS fica sem uso.
