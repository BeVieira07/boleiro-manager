/* ================= versão do save e migrações (#46) =================
   S.versao = quantas migrações o save já recebeu (save sem versão = 0, de antes da #46). Todo save que vem de fora
   (local, nuvem, arquivo importado, save antigo de slot único) passa por migrarSave, e só por ela.
   Para acrescentar uma migração: ponha a função no FIM de MIGRACOES (nunca no meio nem mudando as de antes). Ela recebe
   o estado já em S e deve deixar o save no formato novo; VERSAO_SAVE acompanha sozinho. Saves sem versão rodam todas,
   por isso cada uma confere se o campo já existe (vários saves antigos já tinham parte das mudanças). */
import { garantirBase, migrarBase } from './base.mjs';
import { BRASIL } from './campeonatos.mjs';
import { adicionarTitulo, abrirPassagem, fecharPassagem, garantirCarreira, gerarPropostas } from './carreira.mjs';
import { migrarContratos } from './contratos.mjs';
import { COPA } from './copa.mjs';
import { emprestavel } from './emprestimos.mjs';
import { limparSuspensao } from './escalacao.mjs';
import { valueOf } from './dados.mjs';
import { DADOS_PADRAO } from './dados-padrao.mjs';
import { definirMeta, migrarDiretoria } from './diretoria.mjs';
import { DIVS, S, clubDo, divOf, ehHumano, jogaNoBrasil, migrarTecnicos, reindex, startBalance, tecnicos, usarEstado } from './estado.mjs';
import { limparEventosAntigos } from './aovivo.mjs';
import { prepararEstrangeiro } from './estrangeiros.mjs';
import { migrarPenaltis } from './penaltis.mjs';
import { migrarPosicoes, numerarElenco, simplificarPosicoes } from './posicoes.mjs';
import { novaSemente } from './utils.mjs';

export function migrarCarreira(t) {
  if (t.carreira) return;
  const { temporadas } = garantirCarreira(t), c = clubDo(t);
  if (!c) return;
  const historico = t.historico || [], ligas = S.history || [];
  const desde = Math.min(S.season, ...historico.map(h => h.s), ...ligas.map(h => h.season));
  abrirPassagem(t, { s: desde, r: 0 });
  if (t.demitido) fecharPassagem(t, t.saida ?? 'demitido');

  // O save antigo não guardava as trocas de clube nem a data da saída. O último clube é a estimativa para as campanhas.
  for (const h of historico) temporadas.push({ s: h.s, clube: c.id, nome: c.name, div: h.div, pos: h.pos, alvo: h.alvo });
  for (const h of ligas) {
    const resultado = h.tecnicos ? h.tecnicos[t.id] : t.id === 'local' ? { pos: h.me, div: h.div ?? 'A' } : null;
    if (resultado?.pos !== 1) continue;
    const d = resultado.div, campeao = h.champs?.[d] ?? ({ A: h.champ, B: h.champB })[d];
    const clube = S.clubs.find(o => o.name === campeao);
    if (clube && DIVS[d]) adicionarTitulo(t, { s: h.season, comp: 'serie', nome: DIVS[d], clube: clube.id });
  }

  // As copas antigas não identificavam quem treinava o campeão na final. Na temporada atual, usamos o vínculo ativo.
  if (t.demitido) return;
  const incluir = (comp, nome, campeao) => {
    if (campeao === c.id) adicionarTitulo(t, { s: S.season, comp, nome, clube: c.id });
  };
  if (S.copa?.temporada === S.season) incluir('copa', COPA, S.copa.campeao);
  if (S.estaduais?.temporada === S.season) for (const tor of S.estaduais.torneios) incluir('estadual', tor.nome, tor.campeao);
  if (S.continentais?.temporada === S.season) for (const tor of S.continentais.torneios) incluir(tor.id, tor.nome, tor.campeao);
}

export function migrarValoresDeMercado(s) {
  if (Number.isInteger(s.versao) && s.versao >= 18) return;
  const estrangeiros = Object.values(s.continentais?.estrangeiros ?? {});
  for (const c of [...s.clubs, ...estrangeiros]) for (const p of [...c.players, ...(c.base || [])]) p.value = valueOf(p);
}

const MIGRACOES = [
  s => migrarPosicoes(s), // 1: posições detalhadas novas (#23; antes marcado só com posv)
  s => migrarTecnicos(s), // 2: técnicos em S.managers, caixa e finanças no clube (#28)
  s => { if (s.seed == null) { s.seed = novaSemente(); s.rng = s.seed } }, // 3: semente do sorteio (#26)
  s => migrarDiretoria(s), // 4: confiança e meta da diretoria (#11); precisa dos técnicos
  s => migrarContratos(s), // 5: contrato de cada jogador (#49)
  s => migrarBase(s), // 6: potencial de cada jogador e base dos clubes com técnico (#50)
  s => { for (const c of s.clubs) { simplificarPosicoes(c.players); if (c.base) simplificarPosicoes(c.base) } }, // 7: só 6 posições (#97)
  s => { for (const t of Object.values(s.managers)) if (t.demitido && !t.propostasClube) { t.saida = 'demitido'; t.propostasClube = gerarPropostas(t) } }, // 8: demitido antes da #37 recebe propostas em vez de fim de jogo
  s => { const uf = Object.fromEntries(DADOS_PADRAO.clubs.map(c => [c.id, c.uf])); for (const c of s.clubs) if (!c.uf && uf[c.id]) c.uf = uf[c.id] }, // 9: estado de cada clube (#132); os estaduais começam na temporada seguinte
  s => { for (const c of s.clubs) for (const p of [...c.players, ...(c.base || [])]) if (p.energia == null) p.energia = 100 }, // 10: energia dos jogadores (#136)
  s => { for (const c of s.clubs) for (const p of [...c.players, ...(c.base || [])]) delete p.ps }, // 11: sem posição secundária (#181)
  s => { if (s.continentais) for (const c of Object.values(s.continentais.estrangeiros)) prepararEstrangeiro(c) }, // 12: jogadores dos clubes estrangeiros no mercado (#172)
  s => limparEventosAntigos(s.formaPendente ? s.formaPendente.r : s.round), // 13: apaga os lances das rodadas antigas, que o save carregava à toa (#195)
  s => { // 14: artilharia nacional. Os placares anteriores à #197 ficam sem autoria.
    if (s.copa) s.copa.gols ??= {};
    for (const tor of s.estaduais?.torneios || []) tor.gols ??= {};
  },
  s => migrarPenaltis(s), // 15: disputa de pênaltis com placar e cobranças (#267); os antigos guardam só o vencedor
  () => tecnicos().forEach(migrarCarreira), // 16: passagens, temporadas e títulos do técnico (#273)
  s => { // 17: amarelos acumulados durante a temporada (#341)
    const estrangeiros = Object.values(s.continentais?.estrangeiros ?? {});
    for (const c of [...s.clubs, ...estrangeiros]) for (const p of [...c.players, ...(c.base || [])]) p.amar ??= 0;
  },
  migrarValoresDeMercado, // 18: valor de mercado sem desconto pelo prazo do contrato (#350)
  s => { for (const c of s.clubs) if (c.balance == null) c.balance = startBalance(divOf(c), c.strength) }, // 19: caixa dos clubes da IA em saves de antes da #28 (#373)
  () => { for (const t of tecnicos()) if (!t.demitido) garantirBase(clubDo(t)) }, // 20: base de quem assumiu um clube no meio da temporada (#414)
  s => { s.pais ??= BRASIL }, // 21: país da campanha (#443)
  s => { // 22: metas das ligas europeias (#449)
    if (!jogaNoBrasil() && s.seasonClosed !== s.season) {
      for (const t of tecnicos()) if (!t.demitido) definirMeta(t);
    }
  },
  s => { // 23: overall 80+ sai da lista de empréstimo; nos clubes da IA vai à venda (#463)
    const clubes = [...s.clubs, ...Object.values(s.continentais?.estrangeiros || {})];
    for (const c of clubes) for (const p of c.players) if (p.emprestar && !emprestavel(p)) { delete p.emprestar; if (!ehHumano(c)) p.listed = true }
  },
  s => { // 24: suspensão que passou para a temporada nova, em saves ainda antes do 1º jogo dela (#467)
    const comecando = s.round === 0 && !(s.estaduais?.temporada === s.season && s.estaduais.dia > 0);
    if (comecando) for (const c of [...s.clubs, ...Object.values(s.continentais?.estrangeiros || {})]) for (const p of [...c.players, ...(c.base || [])]) limparSuspensao(p);
  },
  s => { // 25: camisas de quem ficou sem número no elenco (#472)
    const clubes = [...s.clubs, ...Object.values(s.continentais?.estrangeiros ?? {})];
    clubes.forEach(numerarElenco);
  },
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
