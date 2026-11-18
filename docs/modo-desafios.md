# Modo Desafios

O modo coloca o jogador no comando de um clube em uma situação decisiva, com um objetivo e uma quantidade definida de partidas. A primeira versão é local, para um técnico, e oferece apenas a Operação Permanência.

## Operação Permanência

- **Ponto de partida:** Athletico-PR em 18º na Série A, com 24 pontos, cinco atrás do 16º, após a 30ª rodada. A tabela vem dos placares das 30 rodadas já disputadas e segue os desempates da liga.
- **Prazo:** oito rodadas, da 31ª à 38ª, com confronto contra o Remo na 36ª. K. Viveros, principal goleador entre os atacantes do clube no cenário, fica fora das rodadas 31 a 33. O elenco conta com o veterano S. Mendoza. O cenário precisa incluir um atacante saudável e promovível na base para que as duas escolhas estejam disponíveis.
- **Decisões:** o técnico escala, muda a tática, usa substituições ao vivo, poupa jogadores e pode promover atletas da base. Contratações, vendas e empréstimos ficam indisponíveis neste cenário. As rodadas do Brasileirão seguem o simulador atual, com as copas e os estaduais desativados. A diretoria pode reagir aos resultados, com a demissão suspensa até o fim do desafio.
- **Sucesso:** terminar a 38ª rodada em 16º ou acima. **Fracasso:** terminar em 17º ou abaixo. A classificação final usa os desempates normais da Série A. Sair temporariamente do Z4 não encerra a missão.

## Fluxo

1. **Menu inicial → Desafios.** O cartão da Operação Permanência mostra clube, posição, distância para o 16º, prazo e objetivo. Ao iniciar, o jogo abre o painel do clube com o objetivo e as rodadas restantes.
2. **Durante o desafio.** A campanha tem um save identificado como desafio. O jogador pode voltar ao menu e retomar da última rodada concluída, mantendo tabela, escalação, desfalques e decisões já tomadas.
3. **Após a última rodada.** Mostrar o resultado da missão, a posição, os pontos, o saldo, a campanha nas oito rodadas e o placar do confronto direto. Se o clube deixou o Z4, indicar em qual rodada ficou fora pela primeira vez. Para evitar manter todos os lances no save, usar o resumo das rodadas do desafio.
4. **Tentar novamente.** Após confirmação, restaurar o estado inicial, incluindo resultados anteriores, calendário, elenco, energia, desfalques e semente. Disponibilizar também o retorno à lista de desafios. A conversão para carreira normal fica para uma versão posterior, quando for possível definir o destino das competições paralelas e da diretoria.

## Implementação e verificação

- Preparar um estado inicial versionado e consistente com o formato de save. Validar no carregamento que o clube, o atacante, a tabela e o calendário existem na versão de dados usada. A janela fechada depende das regras do desafio e vale para as ações do técnico, independentemente da janela da IA.
- Reutilizar a simulação da rodada, a classificação e as telas de clube, escalação e jogo ao vivo. Encerrar a missão antes da transição de temporada.
- Testar a abertura e a retomada do save, os dois resultados após a rodada 38, o retorno do atacante após três rodadas e a repetição a partir do mesmo estado inicial.
- Antes de publicar o cenário, comparar ao menos duas abordagens com o mesmo estado inicial. O objetivo é encontrar uma rota plausível para escapar e uma para cair. Revalidar o equilíbrio quando os elencos padrão mudarem, em especial após a #218.

### Simulação preliminar

Com os dados do commit `4ba6038`, a semente `92` permitiu preparar o cenário jogando 30 rodadas com escalação automática, tática equilibrada e o Palmeiras como clube controlado. Depois da 30ª rodada, o técnico assume o Athletico-PR e Viveros recebe três rodadas de lesão. Na preparação e nos testes, as copas ficaram desligadas e a demissão foi suspensa. O elenco gerado da base veio sem atacante nessa amostra, então a inclusão de um jovem da posição faz parte da preparação do cenário definitivo.

| Estratégia a partir da rodada 31 | Posição final | Pontos | Desfecho |
| --- | ---: | ---: | --- |
| 4-4-2, estilo e modo equilibrados | 16º | 37 | Permaneceu |
| 3-5-2, jogo direto e modo ofensivo | 17º | 33 | Caiu |

As duas execuções partem do mesmo estado e usam escalação automática a cada rodada. Isso verifica a viabilidade dos dois desfechos no motor atual. O cenário final ainda precisa testar a promoção do jovem e o elenco que será distribuído com o jogo.

## Cenários futuros

- **O Acesso dos Garotos:** buscar o acesso na Série D cumprindo uma meta de minutos para jogadores promovidos da base.
- **A Virada na Copa:** começar o jogo de volta em casa, depois de perder a ida por 2 a 0.
