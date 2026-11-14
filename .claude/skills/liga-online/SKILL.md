---
name: liga-online
description: Operar e depurar o lado online do Boleiro-Manager (Supabase, login, saves na nuvem, liga com amigos, função jogar-rodada). Use ao mudar core/ (a função da liga precisa ser republicada), aplicar migrações, investigar erro ou travamento na liga/login pelos logs, ou testar telas num navegador de verdade.
---

# Liga online (Supabase)

Responder em **PT-BR**. As regras gerais (issues, branches, commits, testes) estão na skill `boleiro-manager`.

## Onde fica cada coisa
- Projeto Supabase: ref `nfctxdzapspnxwttrwym` (sa-east-1, plano free; pausa após ~1 semana sem uso, reativar no painel).
- Site: https://bevieira07.github.io/boleiro-manager/ (**minúsculas**; com maiúsculas dá 404). Publicado pelo workflow `pages.yml` a cada push na `main`.
- Navegador: `ui/config.mjs` (URL e chave **pública**), `ui/conta.mjs` (login), `ui/nuvem.mjs` (saves na nuvem), `ui/liga.mjs` (lista de ligas e lobby), `ui/ligajogo.mjs` (jogar a liga).
- Servidor: `supabase/functions/jogar-rodada/index.ts` (uma função só para começar a liga, jogar a rodada, o mercado (inclusive propostas entre técnicos, pedir demissão e escolher clube, #37) e `sair`/`remover` membros (#37: `removerTecnicoLiga` no estado + `liga_remover_membro`, que passa a liga ao membro mais antigo ou a encerra)), `supabase/migrations/*.sql`, `supabase/tests/*.sql`.
- Regras que o servidor roda: `core/liga.mjs` (`iniciarLiga`, `jogarRodadaLiga`, `acaoMercadoLiga`), `core/propostas.mjs`.
- A chave service_role/secret **nunca** entra no repositório (`tests/conta.test.mjs` confere).

## Publicar a função depois de mudar `core/`
A função importa o `core/` do GitHub pelo jsDelivr, **fixado num commit**. Mudou `core/` (merge de PR que mexe em `core/`): sem republicar, site e servidor rodam regras diferentes, e ações novas respondem "Ação de mercado desconhecida".
1. Com a `main` atualizada e no GitHub: `npm run fixar-core` (troca o commit nos 3 imports e confere se o jsDelivr já serve os arquivos; se não, espere uns segundos e rode de novo).
2. Publicar: MCP do Supabase `deploy_edge_function` (`name: jogar-rodada`, `verify_jwt: true`, o conteúdo do `index.ts`) ou `npx supabase functions deploy jogar-rodada --project-ref nfctxdzapspnxwttrwym`.
3. Conferir que sobe: um POST sem login deve responder **401 "Entre na sua conta."** (500 = os imports falharam).
4. Commit da fixação na `main`: `chore: função jogar-rodada fixada no core … (#N)`.
- Mudou só `ui/`: não precisa republicar.
- Ação nova do mercado: entra no mapa `MERCADO` de `core/liga.mjs`; a função não muda.

## Migrações
- Aplicar pelo MCP (`apply_migration`) ou `npx supabase db push`.
- Aplicada pelo MCP, ela ganha como versão o horário em que rodou: **renomear o arquivo** para `<versão>_<nome>.sql` (`list_migrations`), senão o `db push` tenta rodá-la de novo.
- Funções que gravam o estado da liga (`liga_iniciar`, `liga_gravar_rodada`, `liga_gravar_acao`) são `security definer` e só a chave de serviço chama (`revoke … from public, anon, authenticated`).
- Testar as regras no banco real: `supabase/tests/*.sql`, uma transação que termina em `rollback` (rodar com `execute_sql`). Cada mudança de regra ganha um caso aí.

## Estado da liga
- `liga_estado.estado` é o `S` da liga (JSON). O servidor passa todo estado por `migrarSave` (`core/versao.mjs`): campo novo no save = migração nova no fim de `MIGRACOES`, e as ligas antigas são atualizadas na primeira ação.
- Controle de versão: toda gravação exige a `versao` lida; se outra gravou antes, o servidor refaz (até 3 vezes). A rodada nunca é jogada duas vezes.
- O navegador nunca grava o estado; ao recarregar, mantém escalação, formação e tática ainda não confirmadas.

## Diagnosticar pelos logs
Ferramentas: `query_logs` do MCP (fontes `auth_logs`, `edge_logs`, `function_edge_logs`; a hora é UTC) e `execute_sql` (estado das ligas e membros).

Sequência de um usuário (login, logout, chamadas da função):
```sql
select timestamp, source, event_message from logs
where source in ('auth_logs','function_edge_logs')
  and event_message not ilike '%DEPRECATION%' and event_message not ilike '%apiworker%' and event_message not ilike '%reloader%'
order by timestamp desc limit 40
```

| Sinal | Causa provável |
|---|---|
| `session_not_found` em `/user` e função 401 | Logout da mesma conta em outro aparelho (antes da #95 o "Sair" era global). Sair agora é `scope: 'local'`; 401 faz a tela pedir login de novo. |
| Clique sem nenhum pedido no `edge_logs` | Página travada na trava de login do supabase-js. Corrigido em #93 (não chamar o Supabase dentro de `onAuthStateChange`) e #94 (trava por aba, `lock: travaDaAba`). Abas antigas abertas ainda travam: fechar todas. |
| Login do Google volta para outro endereço (`referer` do `/callback` diferente do `redirect_to`) | O endereço não está em **Redirect URLs** (Authentication → URL Configuration); o Supabase usou a Site URL. |
| `over_email_send_rate_limit` | Link mágico: o e-mail grátis manda ~2 por hora no projeto inteiro. Usar "Entrar com Google". |
| Função 500 | Ver `function_logs`; geralmente import do jsDelivr (commit não publicado) ou erro no `core/`. |

## Login com Google
- Credencial OAuth no Google Cloud (redirect: `https://nfctxdzapspnxwttrwym.supabase.co/auth/v1/callback`); provedor Google ligado em Authentication → Sign In / Providers.
- App em modo **Testando** no Google: só os e-mails em "Usuários de teste" entram; publicar o app libera todos.
- Redirect URLs: `https://bevieira07.github.io/boleiro-manager/**` e `http://localhost:3000/**`.
- Uma conta por navegador: duas pessoas não devem usar a mesma conta.

## Testar
- Node, com Supabase falso: `tests/liga-jogo.test.mjs` (servidor falso que roda as regras do `core/`), `tests/liga-rodada.test.mjs` (regras), `tests/conta.test.mjs` (login; o cliente falso imita a trava do supabase-js).
- Navegador de verdade (tempo de tela, fluxo real de botão, imagens): `npm start` e `node scripts/navegador.mjs <url> <arquivo.js>`, com uma expressão que importa os módulos (`await import('/ui/conta.mjs')`) e devolve o que medir.
- Medidas de referência (80 clubes): uma rodada ~27 ms no navegador; a mais lenta da liga no servidor ~66 ms (limite 2 s de CPU).
