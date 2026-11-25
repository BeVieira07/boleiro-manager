/* ================= Artilharia (#184; #409: na página Competições) =================
   Cada competição vira o mesmo modelo de linhas (linhasDe): {pid, nome, sub, clube, j, gols, meu, rank}.
   Liga: topScorers. Copas e estaduais: artilhariaCopa. */
import { clubeCont } from '../../core/continental.mjs';
import { artilhariaCopa } from '../../core/gols-copa.mjs';
import { S, clubById, divisions, table, tec, topScorers } from '../../core/estado.mjs';
import { posDNome } from '../../core/posicoes.mjs';

const COPA = { id: 'copa', nome: 'Copa do Brasil' };
const estaduais = () => S.estaduais?.temporada === S.season ? S.estaduais.torneios : [];
// posição do ranking com empate: 1º, 2º, 2º, 4º
const ranquear = L => L.map(x => ({ ...x, rank: 1 + L.filter(y => y.gols > x.gols).length }));
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
function artilheirosComId(tor, n) {
  const porRegistro = new Map(Object.entries(tor.gols || {}).map(([id, x]) => {
    const sufixo = ':' + x.clube;
    return [x, id.endsWith(sufixo) ? id.slice(0, -sufixo.length) : id];
  }));
  return artilhariaCopa(tor, n).map(x => ({ ...x, pid: porRegistro.get(x) }));
}

/** Ranking de gols de uma competição ({id, nome}: série A-D, copa, estadual-UF ou continental): {status, linhas, vazio}. */
export function linhasDe(c) {
  const me = tec().clubId;
  if (!divisions().includes(c.id)) {
    const tor = c.id === COPA.id ? S.copa : c.id.startsWith('estadual-') ? estaduais().find(t => 'estadual-' + t.uf === c.id)
      : S.continentais?.temporada === S.season ? S.continentais.torneios.find(t => t.id === c.id) : null;
    if (!tor) return { status: 'Sem torneio', linhas: [], vazio: `Não há ${c.nome} nesta temporada.` };
    const L = artilheirosComId(tor, 1000).map(x => ({ pid: x.pid, nome: x.nome, sub: '', clube: clubeCont(x.clube), j: null, gols: x.gols, meu: x.clube === me }));
    return { status: tor.campeao ? 'Encerrada' : 'Em andamento', linhas: ranquear(L), vazio: 'Nenhum gol registrado nesta competição.' };
  }
  const J = Object.fromEntries(table(c.id).map(t => [t.id, t.J]));
  const L = topScorers(1000, c.id).map(p => ({ pid: p.id, nome: p.name, sub: posDNome(p), clube: clubById(p.clubId), j: J[p.clubId] ?? 0, gols: p.goals, meu: p.clubId === me }));
  const total = S.fixtures.length;
  return { status: S.round >= total ? 'Encerrado' : S.round ? `Em andamento · após ${plural(S.round, 'rodada', 'rodadas')}` : 'Ainda sem jogos', linhas: ranquear(L), vazio: 'Nenhum gol ainda nesta série.' };
}
