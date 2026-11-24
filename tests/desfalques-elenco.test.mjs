// #365: clube sem 11 disponíveis (ou com 2 goleiros entre os 11) joga com quem tem, sem travar a rodada
import { test } from 'node:test';
import assert from 'node:assert/strict';

const raiz = new URL('../core/', import.meta.url);
const { iniciarLiga, jogarRodadaLiga } = await import(new URL('liga.mjs', raiz));
const est = await import(new URL('estado.mjs', raiz));
const { autoXI, titularesPossiveis, validateLineup } = await import(new URL('motor.mjs', raiz));
const { unavailable } = await import(new URL('escalacao.mjs', raiz));
const { DADOS_PADRAO } = await import(new URL('dados-padrao.mjs', raiz));
(await import(new URL('estadual.mjs', raiz))).ESTADUAIS.ligados = false;

// deixa no clube só `linha` jogadores de linha e `gol` goleiros disponíveis (os outros lesionados)
function desfalcar(c, linha, gol) {
  let l = 0, g = 0;
  for (const p of c.players) {
    const fica = p.pos === 'G' ? g++ < gol : l++ < linha;
    p.inj = fica ? 0 : 3; p.susp = 0;
  }
}

test('9 de linha e 2 goleiros: a escalação automática tem 10, com 1 goleiro, e vale', () => {
  const r = iniciarLiga([{ user_id: 'u1', nome: 'Ana', club_id: DADOS_PADRAO.clubs.find(c => c.division === 'A').id }], ['A'], DADOS_PADRAO);
  assert.ok(r.ok, r.erro);
  const uc = est.userClub();
  desfalcar(uc, 9, 2);
  const xi = autoXI(uc);
  assert.equal(xi.length, 10);
  assert.equal(xi.filter(id => est.P[id].pos === 'G').length, 1);
  assert.ok(xi.every(id => !unavailable(est.P[id])), 'nenhum indisponível escalado');
  assert.equal(titularesPossiveis(uc), 10);
  uc.lineup = xi;
  assert.equal(validateLineup(uc), null);
  uc.lineup = [...xi, uc.players.find(p => p.pos === 'G' && !xi.includes(p.id)).id];
  assert.match(validateLineup(uc), /escolha 10 titulares/);
});

test('a rodada da liga é jogada mesmo com um clube desfalcado (antes lançava "A rodada não foi jogada")', () => {
  iniciarLiga([{ user_id: 'u1', nome: 'Ana', club_id: DADOS_PADRAO.clubs.find(c => c.division === 'A').id }], ['A'], DADOS_PADRAO);
  desfalcar(est.userClub(), 9, 2);
  const ia = est.S.clubs.find(c => !est.ehHumano(c));
  desfalcar(ia, 7, 1);
  assert.equal(autoXI(ia).length, 8);
  const r = jogarRodadaLiga(JSON.parse(JSON.stringify(est.S)), {});
  assert.ok(r.jogos.length > 0);
});
