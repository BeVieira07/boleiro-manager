// #381: na rodada 1 a tabela zerada (ordem alfabética) não dá bônus de bilheteria
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo } from './jogo.mjs';

test('primeiro jogo em casa paga a bilheteria base, sem bônus de posição', () => {
  const j = carregarJogo();
  const r = j.run(`(()=>{const c=getData().clubs.find(c=>c.name==='Athletico-PR'&&c.division==='A');usarEstado(criarJogo(c.id,getData()));
    const uc=userClub();for(let n=0;n<4;n++){uc.lineup=autoXI(uc);const r0=S.round,base=bilheteriaBase(uc);jogarRodada();
      const f=uc.fin.find(f=>f.desc.startsWith('Bilheteria vs')&&f.r===r0);if(f)return {r0,fator:f.amount/base}}return null})()`);
  assert.ok(r, 'jogou em casa nas 4 primeiras rodadas');
  assert.equal(r.r0, 0, 'o Athletico-PR joga em casa na rodada 1');
  assert.ok(Math.abs(r.fator - 1) < 0.01, `fator ${r.fator}`);
});
