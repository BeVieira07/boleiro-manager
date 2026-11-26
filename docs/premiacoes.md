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

## Inglaterra (#449)

Em 2024/25, os clubes da Premier League registraram £3,4 bilhões de receitas de transmissão e pouco mais de £1 bilhão em dias de jogo. Na Championship, foram £461 milhões e £208 milhões, respectivamente. Por clube e por temporada, a Premier ficou aproximadamente 8,9 vezes acima em transmissão e 6 vezes em dias de jogo. As contas da Deloitte incluem pagamentos da UEFA na Premier League e pagamentos de paraquedas na Championship, que ajudam a explicar as diferenças observadas. [Deloitte, Premier League Clubs](https://www.deloitte.com/uk/en/services/consulting/research/annual-review-of-football-finance-premier-league-clubs.html) · [Deloitte, Football League Clubs](https://www.deloitte.com/uk/en/services/consulting/research/annual-review-of-football-finance-football-league-clubs.html)

O jogo usa os valores abaixo em milhões de reais. O clube de referência tem força 80 na Premier League e 72 na Championship. O caixa inicial e a bilheteria variam com a força do clube. A reserva inicial equivale a cerca de um quarto do valor dos elencos da amostra, que também é a referência usada para o caixa dos clubes europeus no mercado.

| Liga | TV por rodada regular | TV na temporada | Bilheteria-base por mando | Bilheteria-base na temporada | Prêmio do último ao campeão | Caixa inicial de referência |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Premier League | 2,05 | 77,90 | 1,50 | 28,50 | 0,53 a 10,60 | 65,00 |
| Championship | 0,84 | 38,64 | 0,40 | 9,20 | 0,10 a 2,40 | 26,00 |

A distância entre as ligas foi reduzida para 2,0 vezes na TV anual e 3,1 vezes na bilheteria anual de referência, antes dos bônus de classificação. A folha da fase regular dos clubes medianos da amostra é cerca de 2,4 vezes maior na Premier League (2,9 vezes por rodada, em calendários de 38 e 46 rodadas). Com a diferença real de receitas, os valores que cobrem a folha da Championship deixariam uma sobra muito alta na Premier League nesse modelo.

As duas ligas distribuem a premiação por cotas de mérito. O último recebe uma cota, o penúltimo duas e assim por diante até o campeão. A cota do jogo foi calibrada para cada divisão e a premiação do campeão da Premier League ficou 4,4 vezes acima da do campeão da Championship. [Premier League, pagamentos centrais de 2024/25](https://www.premierleague.com/en/news/4325409) · [EFL Handbook, artigo 40, Ladder Payment](https://www.efl.com/documents/efl-handbook.pdf)

A cada rodada regular da própria liga, o clube do técnico recebe TV e paga a folha. Encerrada a fase regular, quem disputa o mata-mata paga a folha nas datas em que joga. A bilheteria entra em partidas com mando, incluindo as semifinais do acesso, e o bicho corresponde a 15% da folha por vitória. A diretoria estima a receita regular como TV mais meia bilheteria-base, pois metade dos jogos regulares é em casa. Nas metas, a vaga europeia da Premier League corresponde ao quarto lugar ou melhor. A Championship tem acesso direto até o segundo lugar e mata-mata do terceiro ao sexto.

O teste de temporada usa a semente 449 e os clubes nas posições centrais por força, com a demissão ativa. A faixa de −10% a +60% do caixa inicial admite um déficit pequeno e uma reserva para reforços. As duas campanhas pagaram a folha inteira, mantiveram o caixa positivo a cada rodada e cumpriram a meta esportiva.

| Clube | Caixa inicial | Folha paga | Menor caixa | Caixa final | Variação | Posição final e meta |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Crystal Palace | 65,000 | 108,161 (38 rodadas) | 49,433 | 64,283 | −1,1% | 8º, meta de 11º |
| Swansea | 26,000 | 47,301 (46 rodadas e 2 jogos do mata-mata) | 22,657 | 26,791 | +3,0% | 5º, meta de 13º |

Saves ingleses da #443 passam a usar os valores nos próximos lançamentos e recalculam as metas dos técnicos ativos na temporada em curso. O caixa, os lançamentos e as temporadas já registradas conservam os valores gravados.
