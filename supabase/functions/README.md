# Funções do servidor (Supabase Edge Functions)

As funções que rodam o motor do jogo para a liga com amigos (veja `docs/online.md`). As ações que não precisam do motor
(criar liga, entrar, escolher clube) são funções do banco, em `supabase/migrations/`.

## `jogar-rodada` (#34)
Chamada pelo navegador com `{ liga, acao }`, sempre com o login (o `verify_jwt` fica ligado):
- `acao: 'iniciar'`: só o dono, com a liga `aberta`. Monta o estado com `iniciarLiga` (`core/liga.mjs`) e grava pela função do banco `liga_iniciar`.
- `acao: 'jogar'`: qualquer membro. Se alguém não confirmou, devolve `{ faltam }` sem jogar, salvo `forcar: true` (só o dono).
  Joga com `jogarRodadaLiga` e grava por `liga_gravar_rodada`, que só aceita a rodada e a versão lidas. Se outra chamada
  gravou antes, devolve `{ jaJogada: true }` (a rodada nunca é jogada duas vezes). Se quem gravou antes foi uma ação de
  mercado (a versão mudou, a rodada não), a rodada é refeita com o estado novo (até 3 tentativas).
- `acao: 'mercado', mercado: { tipo, ... }` (#35): comprar, vender já, pôr à venda, aceitar ou recusar proposta, empréstimo e
  opção de compra, sempre com clubes da IA. Roda `acaoMercadoLiga` (`core/liga.mjs`), que confere tudo o que vem do navegador
  e sorteia a resposta da IA no servidor (recarregar a página não muda nada). Grava por `liga_gravar_acao` (só com a versão lida;
  senão refaz). Negócio fechado vira notícia para todos os técnicos. Fica na mesma função da rodada para ter um deploy só e um
  commit do `core/` só.
- Entre técnicos (#36), pelo mesmo `acao: 'mercado'`: `proporTecnico`, `aceitarProposta`, `recusarProposta`, `cancelarProposta` e
  `contraproposta` (`core/propostas.mjs`). As propostas ficam no estado da liga (`S.propostas`);
  ao aceitar, tudo é conferido de novo.

As funções do banco só podem ser chamadas com a chave de serviço, que a função recebe do Supabase
(`SUPABASE_SERVICE_ROLE_KEY`); ela nunca entra no repositório.

## O `core/` vai junto no deploy (#154)
A função importa o `core/` do próprio repositório por caminho relativo (`../../../core/liga.mjs` etc.), e o deploy empacota
esses arquivos: o servidor roda sempre o mesmo motor do site. Não há commit fixado.
Quem publica é o workflow `.github/workflows/funcao.yml`, a cada push na `main` que muda `core/` ou `supabase/functions/`.
À mão (só se o workflow falhar), da raiz do repositório:
`npx supabase functions deploy jogar-rodada --project-ref nfctxdzapspnxwttrwym --use-api`.

## Testes
- Imports do `core/`: `tests/funcao-core.test.mjs`.
- Regras: `tests/liga-rodada.test.mjs` (Node, incluindo o tempo de uma temporada inteira).
- Tela da liga com um Supabase falso: `tests/liga-jogo.test.mjs`.
- Banco real: `supabase/tests/liga_rodada.sql` (rodar com `execute_sql` ou no SQL Editor; termina em rollback).
