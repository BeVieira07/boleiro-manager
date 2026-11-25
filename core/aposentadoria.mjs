/* Aposentadoria (#418): a idade e a regra num só lugar. Quem completa IDADE_APOSENTADORIA anos na virada da temporada
   (iniciarTemporada soma 1 à idade) sai do elenco; o jogo avisa antes (etiqueta, notícia do meio do campeonato, renovação). */
import { addNews, clubDo, S, tecnicos } from './estado.mjs';

export const IDADE_APOSENTADORIA = 37;

/** Regra: o jogador se aposenta no fim desta temporada? (a idade que ele terá depois da virada já chega à aposentadoria) */
export const seAposenta = p => p.age + 1 >= IDADE_APOSENTADORIA;

/** Regra: na metade do campeonato, uma notícia por técnico lista os jogadores do clube dele que vão se aposentar. */
export function avisarAposentadorias() {
  if (S.round !== Math.floor(S.fixtures.length / 2)) return;
  for (const t of tecnicos()) {
    const lista = clubDo(t).players.filter(seAposenta);
    if (lista.length) addNews(`🧓 Aposentadoria no fim da temporada: ${lista.map(p => `${p.name} (${p.age} anos)`).join(', ')}.`, t.clubId);
  }
}
