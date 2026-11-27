# Calibração das premiações

A #232 considera a soma dos prêmios em uma temporada. A comparação usa os dados padrão das quatro séries, em uma campanha nova com o Palmeiras e a semente de teste 20261115. As colunas “antes” já incluem a calibração da #223. Todos os valores monetários abaixo estão em milhões de reais.

Para estimar um reforço, partimos dos titulares de cada clube na escalação inicial. O custo é o valor de mercado na proposta padrão da IA, incluindo o acréscimo de 30% para os três melhores do clube quando aplicável, mais 38 salários do próprio jogador. O preço final pode variar pela negociação. O titular de referência é a mediana desse custo por divisão. TV, bilheteria, vendas e despesas do elenco ficam fora da soma de premiações.

## Total por temporada

- **Campanha comum** — 10º no Brasileirão, uma classificação na Copa do Brasil, vice do estadual e, para a Série A, participação nos grupos da Libertadores.
- **Título nacional** — campeão da sua divisão, considerando apenas o prêmio do Brasileirão.
- **Temporada excepcional** — campeão do Brasileirão, da Copa do Brasil, do estadual e da Libertadores, com os valores de todas as fases pagas. Nas séries inferiores, disputar a Libertadores pressupõe vaga pelo título anterior da Copa do Brasil. A Sul-Americana é uma campanha alternativa.

| Série | Custo do titular de referência | Campanha comum antes → agora | Título nacional antes → agora | Temporada excepcional antes → agora | Titulares financiados na excepcional antes → agora |
| --- | ---: | ---: | ---: | ---: | ---: |
| A | 5,252 | 7,980 → 3,020 | 10,550 → 4,160 | 30,150 → 11,750 | 5,74 → 2,24 |
| B | 2,398 | 2,730 → 1,335 | 3,870 → 2,130 | 23,470 → 5,317 | 9,79 → 2,22 |
| C | 1,656 | 1,430 → 0,725 | 1,630 → 1,170 | 21,230 → 2,839 | 12,82 → 1,71 |
| D | 0,866 | 0,980 → 0,387 | 0,860 → 0,630 | 20,460 → 1,467 | 23,63 → 1,69 |

A referência é que uma campanha comum financie parte de um titular e que a soma de quatro títulos financie entre um e três titulares medianos por divisão. Com os dados desta amostra, o cenário excepcional também fica abaixo do menor caixa inicial de cada série. Os prêmios continuam fixos por divisão e conquista. Clubes com titulares mais baratos conseguem contratar mais com a mesma premiação.

## Comparação com clubes de portes diferentes

A amostra de cada divisão representa os caixas iniciais baixo, intermediário e alto. A taxa e o salário são do titular mediano do próprio clube, ordenados pelo custo total.

| Série | Clube | Caixa inicial | Transferência | Salário por rodada | Custo do reforço | Titulares financiados na excepcional antes → agora |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| A | Chapecoense | 14,500 | 1,200 | 0,012 | 1,656 | 18,21 → 7,10 |
| A | Internacional | 31,000 | 4,000 | 0,053 | 6,014 | 5,01 → 1,95 |
| A | Flamengo | 43,000 | 10,500 | 0,105 | 14,490 | 2,08 → 0,81 |
| B | Botafogo-SP | 5,500 | 1,000 | 0,010 | 1,380 | 17,01 → 3,85 |
| B | Operário-PR | 8,500 | 1,700 | 0,023 | 2,574 | 9,12 → 2,07 |
| B | Fortaleza | 11,000 | 3,400 | 0,038 | 4,844 | 4,85 → 1,10 |
| C | Maranhão | 2,900 | 0,600 | 0,008 | 0,904 | 23,48 → 3,14 |
| C | Figueirense | 3,900 | 1,300 | 0,013 | 1,794 | 11,83 → 1,58 |
| C | Paysandu | 4,500 | 1,800 | 0,024 | 2,712 | 7,83 → 1,05 |
| D | América-RN | 1,500 | 0,400 | 0,004 | 0,552 | 37,07 → 2,66 |
| D | Treze | 1,800 | 0,650 | 0,006 | 0,878 | 23,30 → 1,67 |
| D | Sampaio Corrêa | 2,200 | 0,900 | 0,010 | 1,280 | 15,98 → 1,15 |

Os prêmios por fase crescem dentro de cada divisão. Para as copas, os valores-base têm multiplicadores de 100%, 42%, 22% e 11% para A, B, C e D. Na Série A, os totais de campeão são 2,950 na Copa do Brasil em seis fases, 0,350 no estadual, 4,290 na Libertadores e 2,420 na Sul-Americana. Os lançamentos anteriores permanecem no valor original. O ajuste é aplicado apenas no momento de creditar os próximos prêmios, inclusive em saves existentes.

## Ligas europeias (#449)

> Desde a #456, TV, bilheteria e premiação seguem a seção **Receita pela folha** abaixo. Os valores fixos de TV, bilheteria e cotas desta seção e o teste de −10% a +60% são o histórico da #449; continuam valendo as referências reais, as metas e o caixa inicial.

As receitas reais orientam a escala de cada país e a diferença entre divisões. Os relatórios têm recortes diferentes. Alguns incluem receitas da UEFA ou compensações por rebaixamento, enquanto outros medem os contratos de TV domésticos.

- **Inglaterra.** Em 2024/25, a Premier League registrou £3,4 bilhões de transmissão e pouco mais de £1 bilhão em dias de jogo, ante £461 milhões e £208 milhões na Championship. Por clube, a Premier ficou aproximadamente 8,9 vezes acima em TV e 6 vezes em dias de jogo. [Deloitte, Premier League](https://www.deloitte.com/uk/en/services/consulting/research/annual-review-of-football-finance-premier-league-clubs.html) · [Deloitte, Football League](https://www.deloitte.com/uk/en/services/consulting/research/annual-review-of-football-finance-football-league-clubs.html)
- **Espanha.** Em 2024/25, os clubes da primeira e da segunda divisão registraram €1.268,1 milhões e €141,6 milhões em TV das competições nacionais, além de €815,8 milhões e €86,2 milhões em dias de jogo. Por clube, as diferenças foram de 9,9 e 10,4 vezes, respectivamente. [LaLiga, Informe Económico Financiero 2024/25, quadros 14 e 20](https://assets.laliga.com/assets/2026/03/18/originals/5658090da03d3a5134540accdc341c89.pdf)
- **Itália.** A Serie A registrou cerca de €1,5 bilhão de transmissão e €500 milhões de dias de jogo em 2024/25. A Lega B registrou queda na comercialização dos direitos de TV no mesmo exercício. [Deloitte, Europe’s Top Leagues](https://www.deloitte.com/global/en/industries/telecom-media-entertainment/perspectives/annual-review-of-football-finance-europe-premier-league.html) · [Lega B, balanço de 2024/25](https://www.legab.it/news/assemblea-lega-b-approvato-il-bilancio-di-esercizio-2024-25)
- **França.** Os contratos domésticos de 2024/25 previam €403,5 milhões para a Ligue 1 e €40 milhões para a Ligue 2, uma diferença de cerca de 10 vezes. Os clubes da Ligue 1 registraram ainda cerca de €300 milhões em dias de jogo. [Senado francês, relatório sobre o futebol profissional](https://www.senat.fr/rap/r24-087/r24-0871.pdf) · [Deloitte, Europe’s Top Leagues](https://www.deloitte.com/global/en/industries/telecom-media-entertainment/perspectives/annual-review-of-football-finance-europe-premier-league.html)
- **Portugal.** Em 2023/24, os direitos audiovisuais renderam €189 milhões na primeira divisão e €10 milhões na amostra da segunda. A primeira divisão registrou €58 milhões em bilheteria. As receitas da segunda excluem equipes B cujas contas pertencem a clubes da primeira. [Liga Portugal e EY, Anuário do Futebol Profissional 2023/24](https://www.ey.com/content/dam/ey-unified-site/ey-com/pt-pt/newsroom/2025/03/document/ey_anuarioligaportugal2023_24_af.pdf)

O jogo comprime essas diferenças para aproximar a soma da TV, da bilheteria e do prêmio em uma campanha intermediária da folha dos elencos. A comparação usa o calendário de cada liga. Na Inglaterra, por exemplo, a folha anual dos clubes de referência é cerca de 2,4 vezes maior na Premier League, embora a TV real por clube seja 8,9 vezes maior. A TV anual da primeira divisão fica entre 2,0 e 2,6 vezes a da segunda no jogo, e a bilheteria-base anual, entre 3,0 e 3,7 vezes. A reserva inicial parte de cerca de um quarto do valor de um elenco de referência, como no mercado europeu. Bilheteria e caixa sobem com a força acima da referência e têm um piso por liga.

Valores do jogo em milhões de reais. Os totais de TV e bilheteria cobrem a fase regular. A bilheteria-base precede os bônus pela posição na tabela.

| Liga | Força de referência | TV por rodada | TV na temporada | Bilheteria-base por mando | Bilheteria-base na temporada | Prêmio do último ao campeão | Caixa inicial de referência |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Premier League (GB1) | 80 | 2,05 | 77,90 | 1,50 | 28,50 | 0,53 a 10,60 | 65,00 |
| Championship (GB2) | 72 | 0,84 | 38,64 | 0,40 | 9,20 | 0,10 a 2,40 | 26,00 |
| LaLiga (ES1) | 77 | 1,50 | 57,00 | 1,15 | 21,85 | 0,40 a 8,00 | 45,00 |
| LaLiga 2 (ES2) | 71 | 0,69 | 28,98 | 0,35 | 7,35 | 0,08 a 1,76 | 21,00 |
| Serie A (IT1) | 77 | 1,34 | 50,92 | 0,87 | 16,53 | 0,36 a 7,20 | 41,00 |
| Serie B (IT2) | 70 | 0,68 | 25,84 | 0,28 | 5,32 | 0,07 a 1,40 | 20,00 |
| Ligue 1 (FR1) | 75 | 1,02 | 34,68 | 0,68 | 11,56 | 0,27 a 4,86 | 34,00 |
| Ligue 2 (FR2) | 67 | 0,39 | 13,26 | 0,22 | 3,74 | 0,05 a 0,90 | 13,00 |
| Liga Portugal (PO1) | 70 | 0,58 | 19,72 | 0,44 | 7,48 | 0,16 a 2,88 | 20,00 |
| Liga Portugal 2 (PO2) | 62 | 0,28 | 9,52 | 0,12 | 2,04 | 0,04 a 0,72 | 8,50 |

As dez ligas do jogo distribuem o prêmio por cotas de mérito. O último recebe uma cota, o penúltimo duas e assim por diante até o campeão. Cada liga tem seu próprio valor por cota. [Premier League, pagamentos centrais de 2024/25](https://www.premierleague.com/en/news/4325409) · [EFL Handbook, artigo 40, Ladder Payment](https://www.efl.com/documents/efl-handbook.pdf)

A cada rodada regular da própria liga, o clube do técnico recebe TV e paga a folha. Encerrada a fase regular, quem disputa o mata-mata ou a repescagem paga a folha nas datas em que joga. A bilheteria entra em partidas com mando e o bicho corresponde a 5% da folha por vitória (15% até a #459). A diretoria estima a receita regular como TV mais meia bilheteria-base, pois metade dos jogos regulares é em casa.

A meta de vaga europeia é chegar ao 4º lugar nas primeiras divisões da Inglaterra, da Espanha, da Itália e da França, e ao 3º em Portugal. Nas segundas divisões, os dois primeiros sobem diretamente e o mata-mata começa no 3º. A última vaga do mata-mata é o 6º lugar na Inglaterra e na Espanha, o 8º na Itália, o 5º na França e o 3º em Portugal. Na França e em Portugal, o 16º da primeira divisão disputa a repescagem. A meta de permanência nessas duas ligas é chegar ao 15º lugar ou melhor.

O teste de temporada usa a semente 449 e um clube próximo do meio da lista por força em cada divisão, com a demissão ativa. A faixa de −10% a +60% do caixa inicial admite um déficit pequeno e uma reserva para reforços. Os dez clubes pagaram a folha, mantiveram o caixa positivo a cada rodada, cumpriram a meta esportiva e conservaram o técnico.

| Liga | Clube | Caixa inicial | Folha paga | Menor caixa | Caixa final | Posição final e meta |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| GB1 | Crystal Palace | 65,000 | 108,161 | 49,433 | 64,283 | 8º, meta de 11º |
| GB2 | Swansea | 26,000 | 47,301 | 22,657 | 26,791 | 5º, meta de 13º |
| ES1 | Rayo Vallecano | 51,000 | 69,525 | 45,185 | 68,925 | 8º, meta de 9º |
| ES2 | Eibar | 21,000 | 34,803 | 19,323 | 22,431 | 8º, meta de 10º |
| IT1 | Lazio | 46,500 | 71,752 | 41,329 | 47,984 | 5º, meta de 9º |
| IT2 | Avellino | 20,000 | 32,018 | 18,560 | 19,610 | 6º, meta de 11º |
| FR1 | Paris FC | 34,000 | 45,630 | 29,864 | 36,534 | 3º, meta de 10º |
| FR2 | PAU | 13,000 | 17,335 | 11,448 | 13,392 | 7º, meta de 10º |
| PO1 | Estrela | 20,000 | 26,675 | 16,715 | 21,324 | 6º, meta de 10º |
| PO2 | Farense | 7,600 | 9,070 | 7,600 | 10,021 | 3º, meta de 12º |

Saves europeus anteriores à #449 usam a nova economia nos próximos lançamentos e recalculam as metas dos técnicos ativos na temporada em curso. O caixa, os lançamentos e as temporadas já registradas conservam os valores gravados.

## Receita pela folha (#456)

**Problema.** A folha cresce ~3,4 vezes a cada 10 pontos de força (folha/rodada ≈ e^(−9,11 + 0,122·força), R² 0,95 nas 14 ligas), mas a TV era fixa por liga e a bilheteria linear. Cada liga tinha uma força de equilíbrio: abaixo dela o clube enriquecia, acima quebrava. Numa simulação com três clubes por liga (forte, médio e fraco) e duas temporadas, a variação do caixa por temporada tinha mediana +33%, de −378% (Real Madrid) a +434% (Sampaio Corrêa); só 25 de 84 casos entre −25% e +35%.

**Regra.** `receitaPorRodada` (`core/estado.mjs`) = folha do clube no começo da temporada (`folhaRef`, fixada no jogo novo e na virada), limitada entre 0,8× e 1,25× da folha que a força justifica na liga (a curva acima vezes `economia.fator`, ou o fator da série no Brasil), dividida pela margem: 1,13 no Brasil (copas e estaduais dão bilheteria e prêmios a mais) e 1,08 na Europa (1,10 e 1,05 até a #459, quando o bicho caiu de 15% para 5%). Metade é cota de TV por rodada regular, metade bilheteria por mando (com o bônus pela posição). Contratar caro no meio da temporada sai do caixa; na seguinte, a receita acompanha só até o teto.

Os fatores são a mediana, por liga, da folha inicial de todos os clubes contra a curva: Série A 1,09, B 1,15, C 1,11, D 1,08; Premier League 1,28, Championship 1,41, LaLiga 1,31, LaLiga 2 1,43, Serie A 1,32, Serie B 1,41, Ligue 1 1,23, Ligue 2 1,32, Liga Portugal 1,35, Liga Portugal 2 1,48.

**Premiação.** Em rodadas de receita média da liga: o campeão leva 8 rodadas, o último 1, e as posições do meio em linha reta. No jogo novo isso dá ao campeão cerca de 8,0 milhões na Série A (antes 4,16), 2,8 na B, 1,7 na C e 0,9 na D.

**Resultado** (mesma simulação, semente 7): mediana +4% por temporada, metade dos casos entre −2% e +12%, de −19% a +40% (Flamengo campeão); 83 de 84 casos entre −25% e +35%. O caixa cresce com campanha boa, copas e vendas, e cai com folha acima do que a força vale. A folha só passa do limite da diretoria (`FOLHA_LIMITE`, 1,6 vez a receita esperada) se crescer uns 45% acima da do começo da temporada.

