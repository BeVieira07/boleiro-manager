---
name: boleiro-manager
description: Como o Boleiro-Manager guarda e atualiza jogadores, times, overalls e escudos, como rodar o jogo, e as regras de trabalho do projeto (issues, commits, idioma). Use ao mexer em dados, escudos, saves ou ao abrir issues.
---

# Boleiro-Manager

Manager de futebol estilo Brasfoot, em JS puro, sem build. Brasileirão Séries A, B, C e D de 2024 (dados da API-Football). Responder sempre em **PT-BR**.

## Regras de trabalho
- Repositório: `BeVieira07/Boleiro-Manager`. Usar a conta **BeVieira07** (o `gh` tem outras contas logadas).
- Commitar e dar push no `main` com a BeVieira07, **sem** `Co-Authored-By` do Claude.
- Issues: criar com `gh issue create --repo BeVieira07/Boleiro-Manager`, com título curto, descrição (contexto, proposta, critérios de aceite) e labels (ver "Labels" abaixo). Mostrar o rascunho antes de criar, salvo quando o pedido já for explícito. Tarefas independentes viram issues separadas.
- **Quadro (GitHub Projects):** https://github.com/users/BeVieira07/projects/1 (número 1, id `PVT_kwHOCcdjxs4Brmar`). Toda issue nova entra nele com Status `Todo` e uma Prioridade (P0 urgente, P1 importante, P2 quando der): `gh project item-add 1 --owner BeVieira07 --url <issue> --format json -q .id` e depois `gh project item-edit --project-id PVT_kwHOCcdjxs4Brmar --id <item> --field-id <campo> --single-select-option-id <opção>`. Campos: Status `PVTSSF_lAHOCcdjxs4Brmarzhp4Yw0` (Todo `f75ad846`, In Progress `47fc9ee4`, Done `98236657`), Prioridade `PVTSSF_lAHOCcdjxs4Brmarzhp4Y3g` (P0 `be54ec53`, P1 `5b013fd5`, P2 `13f748bd`). Ao começar uma issue, mudar para In Progress; fechada pelo PR, vai para Done sozinha. Ao escolher a próxima issue, seguir a prioridade do quadro.
- **Uma branch por issue:** ao resolver uma issue, criar a branch a partir do `main` atualizado, com o nome `issue-N-resumo-curto` (ex.: `issue-14-escalacao-so-na-escalacao`), commitar nela e abrir um PR com `Closes #N`. Não misturar issues na mesma branch nem trabalhar direto no `main`. Isso vale no lugar de "dar push no `main`" quando o trabalho é uma issue.
- **Labels:** uma de tipo e, se couber, uma ou duas de área. Tipo: `bug` (algo errado), `enhancement` (funcionalidade nova que não cabe numa área abaixo), `documentation`, `refatoração` (reorganizar sem mudar o comportamento), `limpeza` (remover código morto ou duplicado), `testes`, `infra` (scripts, ferramentas, fluxo). Área: `elenco` (jogadores, evolução, posições, base), `economia` (dinheiro, salários, contratos, diretoria), `competições` (campeonatos, copas, calendário), `save` (saves e migração), `dados` (jogadores, clubes, escudos, scripts de dados), `segurança`. Se faltar uma label, criar com `gh label create` e acrescentar aqui.
- **Commits:** a mensagem começa com a tag do tipo e dois pontos, em português, e termina com o número da issue quando houver: `feat:` (funcionalidade), `fix:` (correção), `refactor:`, `docs:`, `test:`, `dados:` (dados, escudos, posições geradas), `chore:` (ferramentas e skill). Ex.: `feat: confiança da diretoria (#11)`, `fix: bicho por vitória com empréstimos (#43)`. Os commits antigos não seguem isso e não precisam ser reescritos.
- **Issues numeradas:** o título começa com o número sequencial da issue, no formato `N. Título` (ex.: `5. Adicionar Copa do Brasil`). O número é o próximo do repositório, e issues e PRs dividem o mesmo contador: pegar o maior com `gh api "repos/BeVieira07/Boleiro-Manager/issues?state=all&per_page=1" -q ".[0].number"` e somar 1. Outras sessões também criam issues e PRs, então conferir o número real depois de criar e corrigir o título se ele tiver andado. Ao criar várias de uma vez, numerar em sequência. As #1 a #4 foram criadas antes desta regra e estão sem número no título.
- Issues abertas: #1 empréstimo de jogadores, #2 escalar o time, #3 estilos de jogo e modo ataque/defesa, #4 posições detalhadas (zagueiro/lateral, volante/meia). A #4 é base da #2 e da #3.

## Onde ficam os dados (já persistidos no git)
| O quê | Onde |
|---|---|
| Clubes e jogadores (2.435 jogadores, 80 clubes) | `data/brasileirao-2024.json` (Série A), `data/brasileirao-serie-{b,c,d}-2024.json` |
| Notas reais para calibrar o overall | `data/notas-2024.json` |
| Overalls escolhidos à mão (`ovrM`, valem mais que tudo) | `data/overalls-manual.json` |
| Escudos | `img/escudos/<id>.png` |
| Origem de cada escudo (para conferir) | `data/escudos-fontes.json` |
| Título do artigo da Wikipédia de cada clube | `data/escudos-wikipedia.json` |
| O que o jogo lê | `core/dados-padrao.mjs` (**gerado**, não editar à mão) |

`data/*-raw.json` é ignorado pelo git.

## Fluxo para mudar dados
1. Jogadores/times novos: `npm run dados` (ou `dados:b`, `dados:c`, `dados:d`) e `npm run notas`.
2. Overall à mão: editar `data/overalls-manual.json`.
3. Escudos: `npm run escudos`.
4. Mudou a temporada ou o clube trocou de divisão: conferir as listas na Wikipédia (`Campeonato Brasileiro de Futebol de AAAA - Série A/B/C/D`), editar os ids em `data/divisoes-2026.json` e rodar `node scripts/aplicar-divisoes-2026.mjs` (move os clubes entre os 4 JSONs; exige 20 por série e que todo id exista). Clube que não existe nos dados precisa ser baixado pela API antes; sem API, deixar um clube antigo no lugar e registrar em `_divergencias`.
5. **Sempre** terminar com `npm run dados:padrao` (regenera `core/dados-padrao.mjs`), conferir e commitar.

## API-Football
- A conta está **suspensa** ("Your account is suspended"), então `dados`, `dados:b/c/d` e `notas` não baixam nada novo. Os dados já salvos em `data/` continuam valendo.
- O navegador não importa mais da API (#52): a aba Dados só carrega e exporta JSON. A única fonte são os scripts (`npm run dados` etc.).
- O host de imagens `media.api-sports.io` está fora do ar (DNS não resolve). Por isso os escudos vêm da Wikipédia.

## Escudos
- `npm run escudos` baixa a imagem principal do artigo `pt.wikipedia.org` de cada clube (mapa em `data/escudos-wikipedia.json`) para `img/escudos/<id>.png`, 128 px. Pula os que já existem; apague o arquivo para baixar de novo.
- A Wikipédia limita o ritmo (HTTP 429). O script já faz pausa e tenta de novo; se ainda falhar, esperar alguns minutos.
- `gerar-dados-padrao.mjs` aponta o `logo` para o arquivo local quando ele existe; sem arquivo, mantém o link da API.
- Se a imagem falhar no navegador, `crest()` em `ui/partida.mjs` troca pela sigla colorida.
- Falta o escudo do **Iguatu** (`c15505`): sem imagem na Wikipédia. Salvar como `img/escudos/c15505.png` e rodar `npm run dados:padrao`.

## Rodando o jogo
- O jogo usa módulos ES: **precisa de servidor local**. Abrir `index.html` direto do disco (`file://`) não funciona.
- Com porta: `npm start` (`npx serve .`, normalmente `http://localhost:3000`) ou Live Server do VS Code (`http://127.0.0.1:5500`).
- O `localStorage` é separado por origem: save feito em `file://` não aparece em `localhost`. Para mudar de origem, usar **Exportar save** e **Importar save** na aba **Dados**.

## Online (#30)
- **Operar e depurar o online** (republicar a função da liga quando `core/` muda, migrações, logs do Supabase, login, testar no navegador): skill `liga-online`.
- Site: GitHub Pages (workflow `.github/workflows/pages.yml`, roda `npm test` antes), em https://bevieira07.github.io/boleiro-manager/ (minúsculas). Leva só `index.html`, `css/`, `img/`, `core/` e `ui/`.
- Supabase: `ui/config.mjs` (URL e chave **pública**; vazio = offline, sem login), `ui/conta.mjs` (login com Google, #84, ou link mágico). A chave service_role/secret **nunca** entra no repositório. Configurar: "Online (Supabase)" no README. Nos testes, `configurarConta({url, chave, cliente})` troca o Supabase por um cliente falso.
- Saves na nuvem (#31): `ui/nuvem.mjs`. Logado, `salvarJogo()` agenda o envio (`agendarEnvio`, junta envios em 2 s) para a tabela `saves` (chave `user_id, id` = `S.saveId`). No índice local, `x.nuvem` = data da versão já enviada; diferente de `x.data` = pendente (`pendente(x)`), reenviado ao entrar, ao abrir o jogo e no evento `online`. A tela inicial mistura os saves locais e os da nuvem (`savesNuvem()`, só o resumo; `abrirDaNuvem` baixa o estado). Logado não há limite de 5; se o navegador enche, `liberarEspaco()` apaga as cópias locais já enviadas.
- Ligas (#32 a #36): telas em `ui/liga.mjs` e `ui/ligajogo.mjs`; regras do servidor em `core/liga.mjs` e `core/propostas.mjs`, rodadas pela função `jogar-rodada` (**republicar quando `core/` mudar**: `npm run fixar-core`, veja a skill `liga-online`).
- `tests/jogo.mjs` importa os módulos um de cada vez: em paralelo, os ciclos entre módulos de `ui/` quebram no Node 22.

## Front (#56–#65)
- Visual da maquete do front (tema escuro verde): tokens e componentes em `css/style.css`, documentados em `docs/front.md` (leia antes de mexer em tela). Ícones SVG em `ui/icones.mjs` (`icone(nome)`), nada de emoji nas telas.
- Layout: menu lateral/barra inferior e barra de ações em `ui/layout.mjs`; cada tela do jogo tem título em `TITULOS`.
- Mensagens: `avisar(msg, tipo)`, `confirmar({...}, sim)` e `pedirValor({...}, enviar)` de `ui/avisos.mjs`. **Nunca** `alert`, `confirm` ou `prompt` (há teste). Nos testes, as mensagens vão para `j.alertas` e as confirmações respondem "sim".
- Testes de front: contraste dos tokens (`tests/contraste.test.mjs`), classes sem uso e telas (`tests/telas.test.mjs`), acessibilidade (`tests/acessibilidade.test.mjs`).

## Testes
- `npm test` roda `node --test` com os testes de `tests/` (uns 20 s). Rodar antes de commitar mudanças no jogo.
- `tests/jogo.mjs` importa os módulos de `core/` e `ui/` em Node com um DOM falso: `carregarJogo()` zera o estado e devolve `run(código)` (com todos os exports à vista), `acao('nome|arg')` (clica como o botão), o HTML da tela atual, os alertas e o localStorage em memória. Para trocar o jogo use `usarEstado(...)`. Use `jogarRodada`/`jogarTemporada` (corrigem a escalação quando há lesionados) e `problemasNasTelas` (acha "undefined", "NaN" e "[object" nas telas).
- Sorteio com semente (#26): as regras usam `rnd()` (`utils.js`), que avança `S.rng`; cada rodada recomeça de `semente(S.seed, temporada, rodada)`. Nunca usar `Math.random` nas regras (há um teste que confere). `jogarTemporada` impede a demissão, salvo com `{demissao:true}`.

## Persistência no navegador
- As campanhas ficam em `localStorage`, uma por save (até 5): `brasfoot_save_v2_<id>` mais o índice `brasfoot_saves_v2`. Tudo em `ui/saves.mjs` (`save()` de `core/estado.mjs` chama `salvarJogo()`). O jogo abre na tela inicial (Continuar, Novo jogo, lista de saves); o save antigo de slot único (`brasfoot_save_v1`) é migrado na primeira abertura. Backup: **Exportar save (JSON)**; importar cria um save novo.
- **Versão do save (#46):** `S.versao` e `migrarSave(s)` em `core/versao.mjs`. Todo save que vem de fora (local, nuvem, arquivo importado, slot antigo) passa por `migrarSave`, que recusa versão mais nova que o jogo. Campo novo no save = migração nova no **fim** de `MIGRACOES` (conferindo se o campo já existe); `reindex()` só monta o índice `P`. Nos testes, para simular um save antigo, apague também `versao`.
- Dados importados pela aba Dados (`DATA_KEY`) ficam só no navegador e **têm prioridade** sobre `dados-padrao.js`. Se o jogo mostrar menos jogadores ou escudos antigos: aba **Dados**, **Voltar aos dados padrão**, `Ctrl+F5` e começar campanha nova (dados novos só valem a partir de um jogo novo).
- Para guardar algo importado pela aba Dados: **Exportar dados**, salvar em `data/` e rodar `npm run dados:padrao`.
- O overall é recalculado a cada campanha nova (`rate()` em `core/dados.mjs`), exceto os `ovrM`.

## Mapa do código
- `core/`: regras puras (sem DOM, `alert`, `render` nem `localStorage`), testado em `tests/modulos.test.mjs`. O estado atual é `S` em `core/estado.mjs`; de fora, troque com `usarEstado(s)`. As regras devolvem `{erro}` / `{ok, msg}`.
- `ui/`: telas. Estado só da tela em `ui.view`, `ui.vDiv` etc. (`ui/estado.mjs`). Botões: `data-acao="função|arg"` e `data-mudar="função|arg"` (recebe valor e evento), ligados em `ui/main.mjs`; a função precisa ser exportada por um módulo de `ui/`.
- Imports são explícitos: ao usar uma função de outro módulo, importe-a.
- Técnicos (#28): `S.managers[id]` = {nome, clubId, conf, meta, confBaixa, confFat, demitido, news, offers}; `S.atual` é o técnico da vez (solo: `local`). `tec()`, `tecnicos()`, `userClub()` (clube do técnico da vez), `clubDo(t)`, `ehHumano(c)`, `usarTecnico(id)`. Caixa e finanças são do clube (`c.balance`, `c.fin`). `addNews(texto, clubeId?)` vai para o técnico daquele clube; `addNewsTodos` para todos. Saves antigos são migrados em `reindex()`.
- Diretoria (#11, #48): `core/diretoria.mjs`. `atualizarConfianca` soma os fatores da rodada em `t.confFat` (resultado, sequência, posição contra a meta e finanças). Finanças (`fatoresFinanceiros`): folha acima de `FOLHA_LIMITE` (1,6) vezes a `receitaEsperada` (cota de TV + meia bilheteria), caixa em queda por `QUEDA_RODADAS` (4) rodadas sem a premiação da meta cobrir, e caixa negativo. Fechar a temporada no vermelho pesa em `confiancaFimTemporada`. Tudo sai dos lançamentos do clube (`c.fin`), sem campo novo no save.
- Contratos (#49): `core/contratos.mjs`. `p.contrato` = temporadas que faltam (1 a 4; 1 = acaba ao fim desta temporada), sorteado por jogador em `contratoInicial` (fixo pelo id, sem gastar o sorteio da rodada). Contrato curto vale menos (`fatorContrato` em `core/dados.mjs`: 2 temporadas 90%, 1 temporada 75%); o salário segue o valor cheio vezes `p.aum` (aumento da renovação). `renovarContrato` (até 2 temporadas restantes; o jogador pode recusar, e aí só na rodada seguinte), `vencerContratos` na virada (IA renova por sorteio; sem contrato sai de graça para um clube da IA) e `novoContrato` em toda transferência (`movePlayer(p, to, true)` = empréstimo, não mexe no contrato). Na liga a renovação vai pelo servidor (`acao: mercado`, tipo `renovar`).
- Base e potencial (#50): `core/base.mjs` e `ui/base.mjs`. `p.pot` = potencial, teto do overall na forma e na idade (`tetoOvr`); vem de `potInicial` (fixo pelo id, pela idade e pelo overall). Na tela só aparece como estrelas (`estrelasPot`, `potTag`), **nunca o número**. `c.base` = jovens sub-20 dos clubes com técnico, fora de `c.players`, de `P`, da folha e do mercado; `promoverDaBase`, `venderDaBase` (metade do valor) e `virarBase` na virada (cresce até o potencial, dispensa acima de 20 anos, chegam 4 novos, máximo 12). Clubes da IA não têm base: seguem com `ensureSquad`. Na liga: `acao: mercado`, tipos `promoverBase` e `venderBase`.
- Copa do Brasil (#51): `core/copa.mjs` e `ui/copa.mjs` (tela `copa`). `S.copa` = {temporada, datas, fases, campeao}: mata-mata de ida e volta com os 64 clubes mais fortes (o de cada técnico sempre entra), sorteado em `criarCopa` no jogo novo e a cada temporada. `datas[k]` é a rodada da liga em que o jogo k é disputado: `jogarRodada` chama `jogarCopa(S.round)` antes de a rodada avançar, então a copa vale também na liga online. Empate na soma vai aos pênaltis (sorteio). Clube com técnico recebe bilheteria, premiação por fase (`PREMIO_COPA`) e um fator na confiança (`t.copaFat`, lido em `atualizarConfianca`). O jogo da copa não tem ao vivo, cartões, lesões, forma nem artilharia (há um `shortcut:` no arquivo). Sem estaduais: os dados não trazem o estado dos clubes.
- Carreira (#37): `core/carreira.mjs`. Demitido (diretoria) ou pedindo demissão (`pedirDemissao`), o técnico **continua no jogo**: `t.demitido = true`, `t.saida`, `t.propostasClube` (de 1 a 4 clubes da IA, pela `reputacao`, com sorteio) e escolhe com `escolherClube`; até lá `t.clubId` ainda é o clube antigo e a rodada não é jogada (solo) ou o servidor dá a melhor proposta na rodada seguinte (liga, `trocas`). `t.historico` guarda cada temporada para a reputação. Tela `carreira` (`ui/diretoria.mjs`).
- Revezamento (#29): com mais de um técnico, `jogarRodada()` exige que todos tenham `pronto`; `confirmarRodada()` (core) marca o técnico da vez e passa a vez ao próximo; na tela, `confirmarVez` e `botaoRodada()`. Novo jogo com vários técnicos: `ui.novos` + `adicionarTecnico` / `comecarComTecnicos` (até 4). Nos testes, `j.campo(id, valor)` define o valor de um campo de formulário.

## Posições detalhadas (#4)
- **No jogo há só 6 posições (#97): GOL, ZAG, LD, LE, MEI (meio-campista) e ATA (atacante).** Os dados (`data/`, `dados-padrao`) guardam a posição real do Transfermarkt (com VOL, MC, PE, PD), e `simplificarPosicoes` converte ao montar o jogo novo (VOL/MC/MEI → MEI; PE/PD/ATA → ATA); saves antigos e ligas passam pela migração 7.
- `p.pos` continua sendo o grupo (G/D/M/A); `p.pd` é a posição (nos dados, a detalhada: GOL, ZAG, LD, LE, VOL, MC meia central, MEI meia-atacante, PE e PD pontas, ATA centroavante; antes da #23 eram MEI, MAT, PON, CEN. Saves e dados antigos são convertidos por `converterPosicoesAntigas`, marcados com `posv:2`) e `p.ps` as secundárias. Tudo em `core/posicoes.mjs`.
- A API só traz o grupo. As posições reais vêm do Transfermarkt (#10): `npm run posicoes` baixa o elenco detalhado de cada clube para `data/posicoes-2024.json` (retomável, com pausa entre pedidos; os clubes que não casam por nome entram em `data/posicoes-clubes.json` como `"<id do jogo>": <id do Transfermarkt>`). O elenco baixado é o ATUAL (`--saison=2025`), porque a API devolve o elenco atual.
- `npm run dados:padrao` aplica, nesta ordem: `data/posicoes-manual.json` (à mão: `"Clube": {"Nome": "ZAG"}`, com secundárias opcionais, ex.: `"LD LE"`), as posições reais do Transfermarkt e, só para quem sobrar, a inferência pela camisa e pelo equilíbrio do elenco. Quem ficou na inferência está em `data/posicoes-pendentes.json`. Se a posição real mudar o grupo, `p.pos` acompanha. Saves e dados antigos são migrados no carregamento (`migrarPosicoes`).
- Para escalar: `penalidadePosicao(p, slot)` devolve `{pen, tipo, aviso}` e `ovrNaPosicao(p, slot)` o overall já penalizado.
