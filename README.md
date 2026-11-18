# Brasfoot Web ⚽

Jogo de gerenciamento de futebol no navegador, estilo Brasfoot, com os clubes e elencos do Brasileirão Série A.

## Como rodar

**Opção 1: Live Server (recomendado no VS Code)**
1. Instale a extensão **Live Server** (o VS Code vai sugerir ao abrir a pasta).
2. Clique com o botão direito em `index.html` → **Open with Live Server**.

**Opção 2: terminal**
```bash
npm start        # abre em http://localhost:3000
```

O jogo usa módulos JavaScript (`<script type="module">`), então **precisa de um servidor local**: abrir o `index.html` com duplo clique (`file://`) não funciona. Com Live Server a página recarrega sozinha a cada alteração.

**Testes:** `npm test`.

## Jogar no navegador (GitHub Pages)

A cada push na `main`, o GitHub Actions roda os testes e publica o jogo em **https://bevieira07.github.io/boleiro-manager/** (`.github/workflows/pages.yml`). Os saves ficam no navegador de quem joga.

## Online (Supabase)

O login online é opcional: com `ui/config.mjs` vazio, o jogo funciona offline e o login não aparece. Para ligar:

1. Crie uma conta e um projeto em [supabase.com](https://supabase.com) (o plano gratuito basta).
2. Em **Project Settings → API**, copie a **Project URL** e a chave **anon / publishable** para `ui/config.mjs`. Essa chave é pública e pode ir para o repositório. **Nunca** coloque a chave `service_role` / `secret` em nenhum arquivo.
3. Crie as tabelas e as regras de acesso (pasta `supabase/migrations/`):
   ```bash
   npx supabase login
   npx supabase link --project-ref <id-do-projeto>
   npx supabase db push
   ```
4. Em **Authentication → URL Configuration**, coloque `https://bevieira07.github.io/boleiro-manager/` como **Site URL** e adicione `http://localhost:3000/` e `http://127.0.0.1:5500/` em **Redirect URLs** (para testar no computador).
5. **Login com Google** (#84; recomendado, porque o e-mail grátis do Supabase manda só uns 2 links por hora):
   - No [Google Cloud Console](https://console.cloud.google.com/), crie um projeto. Em **APIs e serviços → Tela de consentimento OAuth**, escolha **Externo** e preencha o nome do app e o e-mail de suporte.
   - Em **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**, tipo **Aplicativo da Web**. Em **URIs de redirecionamento autorizados**, coloque `https://<id-do-projeto>.supabase.co/auth/v1/callback`.
   - No Supabase, em **Authentication → Sign In / Providers → Google**, ligue o provedor e cole o **Client ID** e o **Client Secret**. O segredo fica só no painel do Supabase, **nunca** no repositório.
   - Quem já entrou pelo link mágico com o mesmo e-mail do Google cai na mesma conta.
6. Faça o push. Na tela inicial aparece "Jogar online": **Entrar com Google** ou, por e-mail, a pessoa recebe um link e entra (a conta é criada no primeiro acesso, sem senha).

O plano gratuito **pausa o projeto depois de cerca de uma semana sem uso**: os dados ficam guardados e dá para reativar pelo painel do Supabase.

## Dados do Brasileirão (API-Football)

O jogo já vem com as **Séries A, B, C e D de 2024** (80 clubes). Os registros importados ficam em `data/brasileirao-2024.json` e `data/brasileirao-serie-<b|c|d>-2024.json`. Rode `npm run dados:padrao` após mudar os JSONs para gerar os elencos jogáveis em `core/dados-padrao.mjs`.

Na geração, elencos grandes são reduzidos a até 26 jogadores. Minutos e partidas têm prioridade quando disponíveis, com vagas reservadas por posição. Sem estatísticas completas, a seleção conserva os elencos menores e considera as notas disponíveis, o valor de mercado e a presença do número da camisa. Em campanhas novas, o jogo completa os grupos que vieram com poucos jogadores.

1. Copie `.env.example` para `.env` e coloque sua chave.
2. Rode:
   ```bash
   npm run dados
   ```
3. Serão criados:
   - `data/brasileirao-2026.json` → formato do jogo
   - `data/brasileirao-2026-raw.json` → respostas brutas da API

No plano gratuito a temporada 2026 é bloqueada; o script monta os 20 clubes de 2026 com os **elencos atuais** (`/players/squads`, que não depende de temporada).

### Séries B, C e D

O jogo suporta até quatro divisões. Cada série tem sua tabela, e no fim da temporada sobem 4 e caem 4 entre séries vizinhas (A↔B, B↔C, C↔D). Quanto mais baixa a série, menores a cota de TV, a premiação e o caixa inicial. Todas as séries usam pontos corridos com ida e volta, sem as fases de grupos e mata-mata reais.

A Série D real tem 64 clubes. O jogo usa só 20: os que foram mais longe em 2024 (quem avança joga mais partidas). Alguns clubes pequenos vêm com poucos jogadores na API, e o jogo completa o elenco com jogadores gerados.

- **Pelo terminal:** `npm run dados:b`, `dados:c` ou `dados:d` gera `data/brasileirao-serie-<b|c|d>-2024.json`. Depois rode `npm run dados:padrao` para embutir no jogo.

As Séries B, C e D precisam de uma temporada liberada pelo plano da API (no plano gratuito, de 2022 a 2024). Jogadores que aparecem em dois elencos (empréstimos) devem ficar só em um clube, porque o `dados:padrao` recusa ids repetidos.

## Overall dos jogadores

A API só entrega nome, idade, posição e camisa, então o overall (40–95) vem de três fontes, em ordem de prioridade:

1. **Lista manual** (`data/overalls-manual.json`): overall escolhido à mão para craques e para quem veio de fora do Brasil (sem nota nas séries nacionais). É um arquivo editável, com valores estimados de memória. Depois de editar, rode `npm run dados:padrao`.
2. **Nota real** (`data/notas-2024.json`): a nota média e os minutos de 2024 de cada jogador, comparados com os outros da mesma série e posição (e, para atacantes e meias, com gols e assistências por 90 min). Quanto mais minutos, mais o jogo confia na nota (confiança total a partir de ~2000 min).
3. **Estimativa:** para quem não tem nota, usa a força do clube em relação à média da série, a idade e um sorteio pequeno. Quem jogou pouco ou nada em 2024 fica mais baixo.

O overall médio de um titular é 72 na Série A, 66 na B, 61 na C e 56 na D.

Para baixar as notas: `npm run notas`. O plano gratuito só libera 100 requisições por dia e 3 páginas por consulta, então a busca é feita clube a clube (~3 requisições cada, ~180 no total para as Séries A, B e C). O script **retoma de onde parou**: rode de novo a cada dia até aparecer "Concluído". Depois rode `npm run dados:padrao` para aplicar. Séries sem nota (como a D) usam só a estimativa.

> O `.env` está no `.gitignore` — nunca suba sua chave para o GitHub.

## Estrutura

```
index.html            página principal (carrega só ui/main.mjs)
css/                  visual
core/                 regras do jogo, sem tela (rodam no navegador e em Node/Deno)
  utils.mjs           sorteio com semente, números, formatação
  estado.mjs          estado do jogo (S), usarEstado, criarJogo, calendário e tabela
  dados.mjs           geração de jogadores, força e valor
  dados-padrao.mjs    dados padrão (Séries A, B, C e D), gerado por scripts/gerar-dados-padrao.mjs
  posicoes.mjs        posições detalhadas e penalidade fora de posição
  motor.mjs           força dos times, simulação e jogarRodada
  escalacao.mjs       vagas, escalação automática, lesões e suspensões
  taticas.mjs         estilos e modos de jogo
  partida.mjs         fim e começo de temporada
  mercado.mjs         compra, venda e propostas
  emprestimos.mjs     empréstimos
  diretoria.mjs       confiança da diretoria
  forma.mjs           evolução do overall
ui/                   telas e interação (usam o core/); config.mjs e conta.mjs: login online
supabase/             tabelas e regras de acesso do banco online (migrations/)
.github/workflows/    publicação no GitHub Pages
  main.mjs            entrada: liga os botões (data-acao / data-mudar) e abre a tela inicial
  telas.mjs           telas e abas · saves.mjs jogos salvos · ...
tests/                testes (npm test)
scripts/baixar-brasileirao.mjs   script Node para baixar os dados
scripts/baixar-notas.mjs         baixa nota e minutos dos jogadores (retomável)
scripts/gerar-dados-padrao.mjs   junta as séries, aplica notas e lista manual em core/dados-padrao.mjs
data/                 JSONs baixados
```

As regras ficam em `core/` e não sabem nada da tela: devolvem resultados (`{erro}`, `{ok, msg}`) que a `ui/` transforma em mensagens. Os botões não usam `onclick`: usam `data-acao="função|arg"` (clique) e `data-mudar="função|arg"` (mudança), ligados em `ui/main.mjs`; a função precisa ser exportada por um módulo de `ui/`.

## Salvamento

O progresso fica no `localStorage` do navegador e, com login, na sua conta (nuvem). Não há importar nem exportar save pelo jogo (#187).

> Atenção: o `localStorage` é separado por endereço. Um jogo salvo abrindo o arquivo direto não aparece no Live Server (e vice-versa) — entre com sua conta para levar o jogo de um endereço a outro.

## Ideias para próximas versões
- Lesões, suspensões e cartões acumulados
- Campo visual para escalação
- Libertadores e campeonatos estaduais
- Contratos e renovação
