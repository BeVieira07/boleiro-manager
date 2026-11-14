/* ================= versão do save e migrações (#46) =================
   S.versao = quantas migrações o save já recebeu (save sem versão = 0, de antes da #46). Todo save que vem de fora
   (local, nuvem, arquivo importado, save antigo de slot único) passa por migrarSave, e só por ela.
   Para acrescentar uma migração: ponha a função no FIM de MIGRACOES (nunca no meio nem mudando as de antes). Ela recebe
   o estado já em S e deve deixar o save no formato novo; VERSAO_SAVE acompanha sozinho. Saves sem versão rodam todas,
   por isso cada uma confere se o campo já existe (vários saves antigos já tinham parte das mudanças). */
import { migrarBase } from './base.mjs';
import { gerarPropostas } from './carreira.mjs';
import { migrarContratos } from './contratos.mjs';
import { migrarDiretoria } from './diretoria.mjs';
import { migrarTecnicos, reindex, usarEstado } from './estado.mjs';
import { migrarPosicoes, simplificarPosicoes } from './posicoes.mjs';
import { novaSemente } from './utils.mjs';

const MIGRACOES = [
  s => migrarPosicoes(s), // 1: posições detalhadas novas (#23; antes marcado só com posv)
  s => migrarTecnicos(s), // 2: técnicos em S.managers, caixa e finanças no clube (#28)
  s => { if (s.seed == null) { s.seed = novaSemente(); s.rng = s.seed } }, // 3: semente do sorteio (#26)
  s => migrarDiretoria(s), // 4: confiança e meta da diretoria (#11); precisa dos técnicos
  s => migrarContratos(s), // 5: contrato de cada jogador (#49)
  s => migrarBase(s), // 6: potencial de cada jogador e base dos clubes com técnico (#50)
  s => { for (const c of s.clubs) { simplificarPosicoes(c.players); if (c.base) simplificarPosicoes(c.base) } }, // 7: só 6 posições (#97)
  s => { for (const t of Object.values(s.managers)) if (t.demitido && !t.propostasClube) { t.saida = 'demitido'; t.propostasClube = gerarPropostas(t) } } // 8: demitido antes da #37 recebe propostas em vez de fim de jogo
];
export const VERSAO_SAVE = MIGRACOES.length;

/** Põe o save em S e o leva até a versão atual. Devolve {erro} (save de versão mais nova; S fica vazio) ou {ok}. */
export function migrarSave(s) {
  const v = Number.isInteger(s.versao) ? s.versao : 0;
  if (v > VERSAO_SAVE) { usarEstado(null); return { erro: 'Este save é de uma versão mais nova do jogo. Atualize a página (Ctrl+F5) e tente de novo.' } }
  usarEstado(s);
  for (let i = v; i < VERSAO_SAVE; i++) MIGRACOES[i](s);
  s.versao = VERSAO_SAVE;
  reindex();
  return { ok: true };
}
