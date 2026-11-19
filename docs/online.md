# Boleiro Manager online — arquitetura

Objetivo: jogar online de duas formas.

1. **Solo com conta:** o jogo hospedado num site, com login e os jogos salvos na nuvem (joga de qualquer computador).
2. **Liga com amigos:** várias pessoas na mesma campanha, cada uma técnica de um clube, na mesma liga, negociando entre si. A rodada é jogada quando todos confirmam a escalação.

Decisões tomadas: **Supabase** (banco Postgres, login, tempo real e funções no servidor) e rodada **quando todos confirmarem**.

## Recuperação de senha (#258)

O Supabase envia o link de recuperação com retorno para o mesmo endereço do jogo. Em **Authentication → URL Configuration → Redirect URLs**, inclua os endereços usados em produção e no desenvolvimento, como `https://bevieira07.github.io/boleiro-manager/` e `http://localhost:3000/`. O modelo de e-mail **Reset Password** deve manter o link de confirmação (`{{ .ConfirmationURL }}`).

O serviço de e-mail padrão do Supabase é limitado a dois envios por hora por projeto e a destinatários da equipe. Para entregar links de recuperação a jogadores externos, use SMTP próprio no Supabase. [Configuração de SMTP](https://supabase.com/docs/guides/auth/auth-smtp)

---

## 1. Como o jogo é hoje (ponto de partida)

- Tudo roda no navegador, sem build: ~1.300 linhas em `js/*.js`, carregadas como scripts comuns que compartilham variáveis globais (`S`, `P`, `view`).
- O estado da campanha é um objeto só, `S` (~580 KB em JSON após uma temporada), guardado no `localStorage` (`js/saves.js`, até 5 saves).
- Há um único técnico humano: `S.userClubId`. Caixa (`S.balance`, `S.fin`), confiança (`S.conf`, `S.meta`), propostas (`S.offers`) e notícias (`S.news`) são do usuário, no nível de cima do estado. `userClub()` aparece ~70 vezes.
- A lógica do jogo está misturada com a tela: `playRound` (`motor.js`), `mercado.js` e `emprestimos.js` chamam `alert`, `confirm`, `render` e `openModal` no meio das regras.
- O sorteio usa `Math.random` (`rnd` em `utils.js`), então a mesma rodada dá resultados diferentes a cada vez.
- A aceitação de propostas e empréstimos pela IA é sorteada no navegador, na hora do clique.

**Medição** (Node, temporada completa da Série A + B + C + D, 80 clubes): uma rodada leva em média **95 ms** (máx. 116 ms), a virada de temporada **28 ms**, e ler + gravar o estado em JSON **10 ms**. Tudo cabe com folga no limite de 2 s de CPU por chamada das funções do Supabase.

---

## 2. Princípios

1. **Na liga, o servidor é o dono do jogo.** Só uma função no servidor (Edge Function) simula rodadas, resolve propostas e altera o estado. O navegador só mostra e envia pedidos. Se cada navegador simulasse, os resultados divergiriam e daria para trapacear (recarregar a página até uma proposta ser aceita, por exemplo).
2. **No solo, o navegador continua simulando.** Não há com quem competir, então trapaça não importa. A nuvem só guarda o save. Assim o solo segue funcionando offline.
3. **Um único motor para os dois lados.** O mesmo código das regras roda no navegador (solo) e no servidor (liga). Para isso ele precisa ser separado da tela.
4. **Sorteio com semente.** Toda rodada usa um gerador com semente guardada no estado (`mulberry32`, que já existe). Mesma semente + mesmas entradas = mesmo resultado, o que permite refazer e auditar uma rodada.
5. **Segredos fora do navegador.** A chave da API-Football e a importação de dados continuam só na máquina do administrador (`scripts/`). O navegador só recebe a chave pública do Supabase, protegida pelas regras de acesso do banco (RLS).

---

## 3. Arquitetura alvo

```
 Navegador (site estático: GitHub Pages)            Supabase
 ┌────────────────────────────────────┐           ┌────────────────────────────────────┐
 │ ui/   telas, modais, cliques       │           │ Auth: login (e-mail ou Google)     │
 │ core/ motor puro (mesmo do servidor)│──solo───▶│ tabela saves (save na nuvem)        │
 │ dados-padrao.js                    │           │                                    │
 │                                    │──liga───▶ │ tabelas da liga (estado, entradas) │
 │                                    │◀─tempo──  │ Realtime: "a rodada foi jogada"    │
 │                                    │   real    │ Edge Functions (Deno):              │
 │                                    │──pedido─▶ │   core/ + regras da liga            │
 └────────────────────────────────────┘           └────────────────────────────────────┘
```

### 3.1 Separar o motor da tela (`core/` e `ui/`)

- `core/`: módulos ES puros com as regras: posições, dados, estado, motor, táticas, forma, diretoria, mercado, empréstimos. Recebem o estado como parâmetro e devolvem **eventos** (ex.: `{tipo:'proposta-recusada', ...}`, `{tipo:'lesao', ...}`), sem `alert`, `confirm`, `render`, `openModal`, `document` ou `localStorage`.
- `ui/`: telas e interação. Lê o estado, chama o `core/` (solo) ou a API do servidor (liga), e transforma eventos em mensagens e modais.
- **ES modules** (`<script type="module">`) rodam no navegador e no Deno (Supabase) sem build. Dois efeitos colaterais:
  - Módulos não criam variáveis globais, então os `onclick="fn()"` inline das telas param de funcionar. Solução: delegação de eventos (`data-acao="..."` + um único ouvinte) ou expor as funções em `window` durante a transição.
  - Abrir o `index.html` com duplo clique (`file://`) deixa de funcionar: módulos exigem um servidor. Passa a ser obrigatório usar `npm start` ou o Live Server.
- Testes automatizados de verdade: os scripts de teste que hoje ficam fora do repositório viram `tests/*.test.mjs` com `node --test`, rodando o `core/` sem tela. Isso protege a extração e tudo que vier depois.

### 3.2 Modelo de estado com vários técnicos

Hoje o estado mistura "o mundo" (clubes, jogadores, tabela) e "o usuário". Na liga, separa assim:

| Parte | Conteúdo | Quem altera |
|---|---|---|
| Mundo | clubes, jogadores, `fixtures`, resultados, temporada, rodada, empréstimos, semente | só a função de rodada / ações do servidor |
| Clube | `balance` e `fin` passam a ser **do clube** (qualquer clube pode ter técnico humano) | servidor |
| Técnico (`S.managers[userId]`) | `clubId`, `conf`, `meta`, `confBaixa`, `demitido`, `news`, `offers` | servidor |
| Entradas do técnico | escalação, formação, estilo, modo, "confirmei a rodada" | o próprio técnico (linhas próprias no banco) |

`userClub()` vira `clubDo(tecnico)`. No solo existe um técnico só, então o jogo continua igual. Saves antigos são migrados: `S.userClubId`, `S.balance` etc. viram `S.managers[local]` e o caixa vai para o clube.

### 3.3 Banco (Supabase)

```
profiles        (id = auth.uid, nome)
saves           (id, user_id, resumo jsonb, estado jsonb, atualizado_em)          -- solo
ligas           (id, nome, dono_id, codigo_convite, status, rodada, versao, criada_em)
liga_estado     (liga_id, versao, estado jsonb)                                    -- o "S" da liga
liga_membros    (liga_id, user_id, club_id, entrou_em)
liga_entradas   (liga_id, user_id, rodada, escalacao jsonb, formacao, estilo, modo, pronto bool)
liga_resultados (liga_id, temporada, rodada, semente, jogos jsonb)                 -- para o replay
```

- O estado da liga fica num **JSONB único** (`liga_estado.estado`, ~600 KB). É simples e aproveita o motor como está. Para grupos de amigos é suficiente. Tabelas normalizadas de jogadores só se um dia houver ligas grandes.
- Tamanho: uma liga ≈ 0,6 MB de estado + resultados. O plano gratuito tem 500 MB de banco, então cabem centenas de ligas.
- **Ações que não precisam do motor** (criar liga, entrar por código, escolher clube; #32) são **funções do banco** (`security definer`, chamadas por `rpc`), não Edge Functions: são atômicas, só para quem está logado, e conferem tudo no próprio banco. `ligas.series` guarda as séries escolhidas pelo dono. As Edge Functions ficam para o que roda o motor (`jogar-rodada`, mercado).

**Regras de acesso (RLS):**
- `saves`: cada usuário lê e grava só as suas linhas.
- `liga_estado`, `liga_resultados`, `liga_membros`: leitura só para membros da liga; **escrita só pelo servidor** (chave de serviço, nas Edge Functions).
- `liga_entradas`: cada membro grava só a própria linha (`user_id = auth.uid()`) e só da rodada atual.

### 3.4 Fluxo da rodada (liga)

1. Cada técnico ajusta escalação, formação, estilo e modo. Isso grava na própria linha de `liga_entradas`, sem conflito com os outros.
2. Ele clica **Confirmar rodada** (`pronto = true`). A tela mostra quem já confirmou (tempo real).
3. Quando todos confirmam, ou o dono da liga força (para não travar por quem sumiu), é chamada a função `jogar-rodada`:
   - **Idempotente:** só processa se `ligas.rodada` ainda for a esperada, num `update ... where rodada = X and versao = V`. Duas confirmações simultâneas não jogam a rodada duas vezes.
   - Carrega o estado, aplica as entradas (quem não confirmou joga com a escalação automática), gera a semente e simula com o `core/`.
   - Aplica as consequências: lesões, forma, diretoria de cada técnico, empréstimos que vencem, finanças de cada clube, e a virada de temporada quando for o caso.
   - Grava o novo estado (`versao + 1`), os jogos da rodada em `liga_resultados` e limpa os `pronto`.
4. O Realtime avisa os navegadores. Cada um baixa o resultado e mostra o "jogo ao vivo" como **replay** dos eventos que o servidor gerou.

**Como ficou (#34):** regras em `core/liga.mjs`; função `supabase/functions/jogar-rodada` (veja o README dela: o `core/` é importado fixado num commit e precisa ser publicado de novo quando mudar); o estado só é gravado pelas funções do banco `liga_iniciar` e `liga_gravar_rodada` (migração `..._liga_rodada.sql`), que só a chave de serviço chama. `ligas.rodada` conta as rodadas jogadas desde o começo da liga (não volta a 0 na virada) e é a rodada das `liga_entradas`. No navegador, `ui/ligajogo.mjs` abre o estado da liga nas telas do jogo (`ui.liga`), sem gravar save local nem na nuvem; mercado, empréstimos e temporada ficam bloqueados até a #35. Na liga ninguém é demitido por enquanto (#37).

**O que muda em relação ao solo:**
- **Mudar tática durante o jogo (#3)** não existe na liga, porque o jogo já foi simulado. Na liga, a tática vale para a rodada inteira.
- **Demissão:** na liga, o técnico demitido perde o clube (que volta para a IA) e escolhe outro clube livre.

### 3.5 Mercado na liga

- **Comprar ou emprestar de clube da IA:** o pedido vai para a função `acao-mercado`, que sorteia a resposta no servidor com a semente do estado e grava o resultado. Recarregar a página não muda nada.
- **Entre humanos:** proposta → o outro técnico aceita, recusa ou faz contraproposta → a função aplica a transferência com o mesmo controle de `versao` (se o estado mudou no meio, refaz a checagem).
- Opcional: janelas de transferência (ex.: só entre rodadas, ou só no início e no meio da temporada).

**Como ficou (#35):** com a IA, cada ação vai para `jogar-rodada` com `acao: 'mercado'` (uma função só, em vez de `acao-mercado`), que roda `acaoMercadoLiga` e grava por `liga_gravar_acao` com controle de `versao`. Negócio fechado vira notícia para todos (`addNews` de cada técnico). Os outros navegadores recebem a mudança de `versao` pelo tempo real e baixam o estado de novo, mantendo a escalação ainda não confirmada. Com clube de outro técnico não há negócio ainda. A tela **Liga** (só dentro da liga) mostra técnicos, clubes, posição e quem confirmou.

**Entre técnicos (#36):** as propostas (compra, venda, empréstimo com taxa, duração, quem paga o salário e opção de compra) ficam no estado da liga (`S.propostas`, regras em `core/propostas.mjs`) e passam pelo mesmo caminho do mercado: o servidor confere e grava com controle de versão, e o tempo real avisa o outro técnico. Ele aceita, recusa ou faz contraproposta na tela Liga; ao aceitar, tudo é conferido de novo (caixa, elenco, jogador ainda no clube).

### 3.6 Solo com conta e save na nuvem

- Mesmo jogo de hoje. O `ui/saves.mjs` ganha um segundo destino: além do `localStorage`, envia o save para a tabela `saves` quando o usuário está logado.
- Ao abrir, a tela inicial lista os saves locais e os da nuvem, e mostra qual é o mais recente quando houver os dois.
- Sem login, tudo continua funcionando como hoje (offline).
- Com o save na nuvem, o limite de 5 saves do `localStorage` deixa de valer para quem está logado.

### 3.7 Hospedagem e operação

- **Site:** GitHub Pages, servindo a pasta do jogo (estático, de graça, publica a cada push na `main`).
- **Supabase (plano gratuito):** 2 projetos ativos, 500 MB de banco, Edge Functions com **2 s de CPU** e **150 s de tempo total** por chamada, 256 MB de memória. O projeto **é pausado depois de cerca de uma semana sem uso** (os dados ficam guardados e dá para reativar pelo painel). Conferido na documentação do Supabase em novembro de 2026.
- Configuração no repositório: `supabase/migrations/*.sql` (tabelas e RLS) e `supabase/functions/*` (funções), aplicados com a CLI do Supabase.
- A URL e a chave pública do projeto ficam num `ui/config.mjs`. A chave de serviço nunca vai para o repositório nem para o navegador.

---

## 4. Plano em fases

Cada fase entrega algo jogável e pode virar uma ou mais issues.

**Fase 1: Motor separado e testado** (pré-requisito de tudo; mexe em quase todos os arquivos, então deve ser feita com as outras sessões paradas)
1. Testes automatizados com `node --test` cobrindo jogo novo, rodadas, temporada completa, empréstimo, saves antigos e save recarregado.
2. Sorteio com semente guardada no estado.
3. Extrair o `core/` em ES modules, sem `alert`, `render` nem DOM, com as regras devolvendo eventos. A tela passa a usar delegação de eventos.

**Fase 2: Vários técnicos no mesmo estado**
4. Modelo `S.managers` + caixa e finanças no clube + migração de saves antigos.
5. Modo "vários técnicos no mesmo computador" (revezando a vez), para validar o modelo sem internet.

**Fase 3: Solo com conta (Supabase)**
6. Projeto Supabase, login e site no GitHub Pages.
7. Saves na nuvem com sincronização e RLS.

**Fase 4: Liga com amigos**
8. Tabelas da liga e RLS; criar liga, convidar por código, escolher clube.
9. Função `jogar-rodada` (idempotente) + confirmação de rodada + Realtime + replay do jogo.
10. Mercado da liga resolvido no servidor (IA) e telas da liga (quem confirmou, dono força a rodada, notícias da liga).

**Fase 5: Interação entre técnicos e extras**
11. Propostas e empréstimos entre técnicos humanos.
12. Demissão na liga (clube volta para a IA), saída de membros e prazo para confirmar.

A fase 3 é independente das fases 1 e 2 e pode vir antes, para validar o Supabase cedo. As fases 4 e 5 dependem das fases 1 e 2.

---

## 5. Riscos e pontos em aberto

- **Refatoração grande (fase 1):** quase todos os arquivos mudam. Os testes da fase 1 vêm antes da extração para garantir que o jogo continue igual.
- **Projeto pausado por inatividade** no plano gratuito: uma liga parada por mais de uma semana precisa reativar o projeto. Mitigação: uma chamada periódica de manutenção, ou o plano pago se a liga for séria.
- **Estado em JSONB único:** cada ação grava ~600 KB. Ótimo para ligas de amigos. Para ligas grandes ou muitas ações por minuto, normalizar jogadores e mercado depois.
- **Dados reais de jogadores:** nomes e fotos vêm da API-Football e do Transfermarkt. Num site público isso pode ter questões de direitos. Avaliar antes de abrir para desconhecidos.
- **Em aberto:** número máximo de técnicos por liga, se a liga usa as 4 séries ou só uma, e se haverá prazo automático para confirmar a rodada.
