---
name: orquestrar-issues
description: Fazer issues do Boleiro-Manager com o Orca, com o Claude orquestrando, um worker Codex por issue implementando e o Claude revisando, corrigindo e fazendo o merge. Use quando o usuário pedir para o Codex fazer issues, para orquestrar issues no Orca, ou disser "orquestra a #N" / "manda o codex fazer".
---

# Orquestrar issues: Claude orquestra, Codex faz, Claude revisa

Papéis:
- **Claude (esta sessão)**: escolhe as issues, escreve a tarefa de cada uma, revisa, corrige, abre o PR, faz o merge e fecha a issue.
- **Codex (worker do Orca)**: implementa uma issue numa worktree própria, roda os testes, commita e dá push na branch. **Não** abre PR nem faz merge.

Responder ao usuário em PT-BR. As regras do projeto continuam valendo (skill `boleiro-manager`; conta GitHub **BeVieira07**; commits sem `Co-Authored-By`; merge sem pedir confirmação). Desde a #154 a função da liga usa o `core/` do repositório: não há core para fixar; o merge na `main` publica a função (`funcao.yml`).

## 0. Antes de começar (uma vez por sessão)

1. Carregar o guia do Orca: `orca skills get orchestration` (e seguir o que ele disser; se mudar algo daqui, vale o guia).
2. `orca status` deve dizer `runtimeState: ready`. Se não, esperar uns segundos e tentar de novo. **Não** rodar `orca open` sem o usuário pedir.
3. O repositório precisa estar no Orca: `orca repo list --json`. Se `C:\Users\Gyan\Documents\Boleiro-Manager` não estiver lá, `orca repo add --path C:\Users\Gyan\Documents\Boleiro-Manager`.
4. `gh auth switch -u BeVieira07` e `git fetch origin`.

## 1. Preparar cada issue

- `gh issue view N --repo BeVieira07/Boleiro-Manager` (título, descrição, critérios de aceite, comentários).
- Ler o código que a issue toca o bastante para escrever uma tarefa clara (arquivos, funções, testes parecidos). Não implementar.
- Issue vaga ou com decisão que é do usuário: perguntar ao usuário antes de mandar ao Codex.
- Mover a issue para **In progress** no quadro (projeto 1; ids na skill `boleiro-manager`/memória).
- Escrever a tarefa num arquivo do scratchpad, `tarefa-N.md`, a partir do modelo abaixo.

### Modelo de tarefa para o Codex

```markdown
# Issue #N: <título>

## O que fazer
<resumo da issue em 2 a 5 linhas, com os critérios de aceite copiados da issue>

## Onde mexer
<arquivos e funções; testes parecidos que servem de exemplo>

## Regras do projeto (obrigatórias)
- Branch: `issue-N-<resumo-curto>`. Se a worktree veio com outro nome de branch, renomeie: `git branch -m issue-N-<resumo>`.
- JS puro em módulos ES, sem build e sem dependências novas. `core/` = regras puras (sem DOM); `ui/` = telas.
- Sorteios só com `rnd()` (nunca `Math.random` nas regras). Nada de `alert`, `confirm` ou `prompt`: use `avisar`/`confirmar` de `ui/avisos.mjs`. Ícones de `ui/icones.mjs`, sem emoji nas telas. Visual: leia `docs/front.md`.
- Textos do jogo em português do Brasil.
- Nunca coloque chaves ou segredos no repositório.
- Teste novo para a regra nova (em `tests/`, no estilo dos que já existem).
- Rode `npm test` antes de commitar; tudo deve passar.
- Commit em português com a tag do tipo: `feat: ... (#N)`, `fix: ... (#N)`, `test: ...`. Sem `Co-Authored-By`.
- `git push -u origin HEAD`. **Não** abra PR, **não** faça merge, **não** mexa na `main`.

## Ao terminar (worker_done)
Informe: nome da branch, hash do último commit, arquivos alterados, resumo do que fez, saída final do `npm test` (linhas `# pass`/`# fail` e nomes dos que falharam), e o que ficou de fora ou com dúvida.
Se não conseguir terminar, informe a falha como falha (não como sucesso).
Em dúvida que muda o resultado, pergunte com `ask` em vez de adivinhar.
```

## 2. Disparar os workers Codex

Uma worktree nova por issue, a partir da `main` atualizada:

```text
orca orchestration worker-start --spec-file <scratchpad>/tarefa-N.md --worktree new-top-level --repo path:C:\Users\Gyan\Documents\Boleiro-Manager --base-branch origin/main --name issue-N-<resumo> --task-title "#N <título curto>" --agent codex
```

- Issues independentes podem ir juntas, até 4 por vez (forma paralela em `orca skills get orchestration --reference references/parallel-start.md`). Issues que mexem nos mesmos arquivos: uma depois da outra.
- Se `worker-start` falhar, **não** repetir: ler `failedStage` e o guia `references/recovery-and-cleanup.md`.
- **Tarefa que não entrou no Codex (acontece no Windows):** se o recibo disser `turn_start_unobserved`, ler o terminal (`orca terminal read --terminal <terminal do recibo>`). Se o Codex estiver parado com o campo vazio (sem `Working`), mandar a tarefa pelo correio do Orca, sem digitar no terminal: `orca orchestration send --to dispatch:<dispatchId> --subject "Tarefa #N" --body-file <scratchpad>/tarefa-N.md`. Ler o terminal de novo e confirmar `Working`. É automático: o usuário autorizou e não precisa ser consultado. Se nem assim começar: `orca orchestration worker-stop --dispatch <dispatchId>`, um único `worker-start --task <taskId> --retry-of <dispatchId> --run <runId> --worktree path:<pasta do worker> --agent codex` e a mesma checagem; falhando de novo, avisar o usuário.
- Depois de disparar e confirmar que o Codex começou, **encerrar o turno** e avisar o usuário quais issues estão com o Codex. O Orca acorda o Claude quando chegar mensagem. Nada de ficar consultando em loop.
- Pergunta do Codex (`question`): responder com `orca orchestration reply --id <id> --body "..."` quando a resposta sai da issue ou das regras; senão, perguntar ao usuário.

## 3. Revisar (quando chegar o `worker_done`)

Falha relatada não é sucesso: ler o motivo e decidir (devolver ao Codex, assumir ou avisar o usuário).

Para cada branch entregue:

1. `git fetch origin` e criar uma worktree de revisão: `git worktree add ../BM-REV-N origin/issue-N-<resumo>` (não mexer na worktree do Codex nem na pasta principal).
2. Ler o diff inteiro: `git diff origin/main...origin/issue-N-<resumo>`. Conferir:
   - [ ] Cumpre **todos** os critérios de aceite da issue (e nada fora do pedido).
   - [ ] Lógica certa nos casos de borda; sem quebrar saves antigos (migração, quando o formato do save muda).
   - [ ] Regras do projeto: `rnd()` e não `Math.random`, sem `alert/confirm/prompt`, sem segredo, `core/` sem DOM, imports explícitos.
   - [ ] Teste novo que falharia sem a mudança.
   - [ ] Tela nova ou mudada: conferir no Chrome (`scripts/navegador.mjs`, computador 1366 px e celular 390 px, sem rolagem horizontal).
   - [ ] Mexeu na liga online/servidor: seguir a skill `liga-online`.
3. `npm test` na worktree de revisão (tudo verde).
4. Decidir:
   - **Tudo certo**: seguir para o passo 4.
   - **Ajuste pequeno** (poucas linhas, claro): o Claude corrige na worktree de revisão, roda `npm test`, commita (`fix: ... (#N)`) e dá push na mesma branch.
   - **Problema grande** (critério não cumprido, abordagem errada): devolver ao Codex com `orca orchestration send --to dispatch:<dispatch_id> --subject "Revisão #N" --body "<lista objetiva do que corrigir>"` e encerrar o turno. Depois de **2 rodadas** sem resolver, o Claude assume e corrige.

## 4. Publicar

1. A branch fica aberta na pasta do Codex, então a revisão trabalha com HEAD solto: para enviar correções, `git push origin HEAD:issue-N-<resumo>`.
2. PR: `gh pr create --repo BeVieira07/Boleiro-Manager --head issue-N-<resumo> --title "<tag>: <título> (#N)" --body "Closes #N ..."`. No corpo: o que mudou, testes, "Feito pelo Codex, revisado pelo Claude" e o que o Claude corrigiu na revisão.
3. Merge sem perguntar: `gh pr merge <branch> --repo BeVieira07/Boleiro-Manager --merge`.
4. Conferir os workflows (`pages.yml`; `funcao.yml` quando `core/` mudou) e, para a função, 401 sem login (skill `liga-online`).
5. Issue fechada e em **Done** no quadro.
6. Limpar: `git worktree remove --force ../BM-REV-N`. A worktree do Codex é do Orca; deixar o Orca fechar.

## 5. Relatório ao usuário

Por issue: resultado (merge feito ou não), PR, o que o Codex fez, o que a revisão achou e corrigiu, testes e o que ficou de fora. Se alguma issue falhou ou ficou parada, dizer qual e por quê.
