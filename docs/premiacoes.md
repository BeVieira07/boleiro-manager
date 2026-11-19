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
