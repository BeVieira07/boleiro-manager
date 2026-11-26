/* Aposentadoria (#418): a idade e a regra num só lugar. Quem completa IDADE_APOSENTADORIA anos na virada da temporada
   (iniciarTemporada soma 1 à idade) sai do elenco; o jogo avisa antes (etiqueta, notícia do meio do campeonato, renovação). */
import { addNews, clubDo, S, tecnicos } from './estado.mjs';

export const IDADE_APOSENTADORIA = 37;

/** Regra: o jogador se aposenta no fim desta temporada? (a idade que ele terá depois da virada já chega à aposentadoria) */
// Number: save legado pode ter a idade em texto, e "35" + 1 viraria "351" (a virada faz p.age++, que converte).
export const seAposenta = p => Number(p.age) + 1 >= IDADE_APOSENTADORIA;

/** Regra: no fim da rodada que fecha a primeira metade do campeonato (a 19ª de 38), uma notícia por técnico com clube lista os jogadores dele que vão se
 *  aposentar. Depois das ofertas e da janela da IA, para ficar no topo do painel. S.round já conta as rodadas jogadas. */
export function avisarAposentadorias() {
  if (S.round !== Math.floor(S.fixtures.length / 2)) return;
  for (const t of tecnicos().filter(t => !t.demitido)) {
    const lista = clubDo(t).players.filter(seAposenta);
    if (lista.length) addNews(`🧓 Aposentadoria no fim da temporada: ${lista.map(p => `${p.name} (${p.age} anos)`).join(', ')}.`, t.clubId, S.round - 1);
  }
}
