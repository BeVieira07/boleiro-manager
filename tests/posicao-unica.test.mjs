// #181: cada jogador tem uma posição só; não existe posição secundária
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DADOS_PADRAO } from '../core/dados-padrao.mjs';
import { DADOS_CONTINENTAIS } from '../core/dados-continentais.mjs';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

const novo = () => { const j = carregarJogo({ boot: true }); j.run(`newGame('${clubeDaSerie(j)}')`); return j };

test('os dados e o jogo novo não têm posição secundária em ninguém', () => {
  const nos = [...DADOS_PADRAO.clubs, ...DADOS_CONTINENTAIS.clubs].flatMap(c => c.players);
  assert.equal(nos.filter(p => 'ps' in p).length, 0, 'dados padrão e continentais');
  const j = novo();
  assert.equal(j.run('Object.values(P).filter(p=>"ps" in p).length'), 0);
  assert.equal(j.run('S.clubs.flatMap(c=>c.base||[]).filter(p=>"ps" in p).length'), 0, 'nem a base');
});

test('fora da posição principal só há penalidade pela tabela de afinidade: nunca "secundária"', () => {
  const j = carregarJogo();
  const r = j.run(`(()=>{const tipos=new Set(),pens=[];
    for(const pd of POSD_ORDEM)for(const slot of POSD_ORDEM){const x=penalidadePosicao({id:'t',name:'T',pos:POSD[pd].grupo,pd,ovr:70},slot);tipos.add(x.tipo);if(pd!==slot)pens.push(x.pen)}
    return {tipos:[...tipos].sort(),min:Math.min(...pens),secundaria:typeof PEN_SECUNDARIA,sorteia:typeof sorteiaSecundarias}})()`);
  assert.deepEqual(r.tipos, ['fora', 'principal']);
  assert.ok(r.min >= 0.08, `lateral jogando de lateral do outro lado já perde ${r.min}`);
  assert.equal(r.secundaria, 'undefined');
  assert.equal(r.sorteia, 'undefined');
  assert.equal(j.run(`penalidadePosicao({id:'t',name:'T',pos:'D',pd:'LD',ps:['LE'],ovr:70},'LE').tipo`), 'fora', 'um ps antigo esquecido no save não vale mais');
});

test('save antigo perde a posição secundária ao abrir (migração 11) e continua escalável', () => {
  const j = novo();
  const r = j.run(`(()=>{const s=JSON.parse(JSON.stringify(S));
    for(const c of s.clubs){for(const p of c.players)p.ps=['LE'];for(const p of c.base||[])p.ps=['MEI']}
    s.versao=10;migrarSave(s);
    return {versao:S.versao,min:VERSAO_SAVE,sobrou:S.clubs.flatMap(c=>[...c.players,...(c.base||[])]).filter(p=>"ps" in p).length,mesmoPd:S.clubs.every(c=>c.players.every(p=>p.pd))}})()`);
  assert.equal(r.sobrou, 0);
  assert.equal(r.mesmoPd, true);
  assert.equal(r.versao, r.min);
  assert.ok(r.min >= 11);
  assert.equal(j.run('validateLineup()'), null);
});

test('as telas não falam de posição secundária', () => {
  const j = novo();
  j.run('userClub().players.forEach(p=>{p.ps=["LE"]})'); // mesmo que sobrasse algum ps, a tela não o mostra
  for (const t of ['escalacao', 'elenco', 'mercado']) {
    j.run(`go('${t}')`);
    assert.doesNotMatch(j.html(), /Também joga|secundária|também:/i, t);
  }
});
