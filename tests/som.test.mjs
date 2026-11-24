// #344: sons da partida ao vivo (gols, apitos, expulsões, pênaltis), volume nas Configurações
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';
import { ARQUIVOS_SONS } from '../ui/partida/som.mjs';

test('gravações da torcida: existem, são leves, têm origem CC0 registrada e o site publica sons/ (#346)', () => {
  const raiz = new URL('..', import.meta.url), fontes = readFileSync(new URL('sons/FONTES.md', raiz), 'utf8');
  assert.equal(ARQUIVOS_SONS.length, 3);
  let total = 0;
  for (const arq of ARQUIVOS_SONS) {
    assert.ok(existsSync(new URL(arq, raiz)), arq);
    total += statSync(new URL(arq, raiz)).size;
    assert.ok(fontes.includes('`' + arq.replace('sons/', '') + '`'), `${arq} sem origem em FONTES.md`);
  }
  assert.ok(total < 400 * 1024, `os sons pesam ${Math.round(total / 1024)} KB`);
  assert.match(fontes, /CC0 1\.0/);
  assert.match(readFileSync(new URL('.github/workflows/pages.yml', raiz), 'utf8'), /\bcp -r (?:\S+ )*sons (?:\S+ )*_site\//);
});

const novo = () => { const j = carregarJogo({ boot: true }); j.run(`newGame('${clubeDaSerie(j)}')`); j.run('S.estaduais=null'); return j };

// joga a próxima rodada ao vivo com o relógio nas mãos do teste; devolve os sons pedidos e o passo do relógio
function aoVivo(j) {
  j.run('globalThis.__sons=[];usarTocadorDeSom((n,a)=>__sons.push({n,a,min:ui.vivo?.min}))');
  const setI = globalThis.setInterval; let fn = null, agora = 0;
  globalThis.setInterval = f => { fn = f; return { unref() {} } };
  try { j.run('if(validateLineup())userClub().lineup=autoXI(userClub());playRound()') } finally { globalThis.setInterval = setI }
  const passo = () => { agora += 4000; const t = mock.method(performance, 'now', () => agora); try { fn() } finally { t.mock.restore() } };
  const andar = (limite = 400) => {
    for (let i = 0; i < limite && !j.run('ui.vivo.fim'); i++) {
      passo();
      if (j.run('!!ui.vivo.expulsao')) j.acao('avExpFechar');
      if (j.run('!!ui.vivo.escolhaPen')) { const t = mock.method(performance, 'now', () => agora); try { j.acao('avPenChutar|auto') } finally { t.mock.restore() } }
    }
  };
  return { sons: () => j.run('__sons'), passo, andar };
}

test('ao vivo: apitos de início, intervalo e fim, um som por gol (a favor ou contra) e apito em cada expulsão', () => {
  const j = novo();
  let r = null;
  // procura uma rodada com gol dos dois lados para o teste valer
  for (let k = 0; k < 15; k++) {
    const vivo = aoVivo(j); vivo.andar();
    const g = j.run('(()=>{const v=ui.vivo,eu=v.clube.id;return {meus:v.g.ev.filter(e=>e.t==="gol"&&v.g[e.side]===eu).length,deles:v.g.ev.filter(e=>e.t==="gol"&&v.g[e.side]!==eu).length,vermelhos:v.g.ev.filter(e=>e.t==="vermelho").length}})()');
    r = { g, sons: vivo.sons() };
    j.acao('avContinuar');
    if (g.meus && g.deles) break;
  }
  const n = nome => r.sons.filter(s => s.n === nome).length;
  assert.ok(r.g.meus && r.g.deles, 'achou um jogo com gols dos dois lados');
  assert.equal(r.sons[0].n, 'inicio');
  assert.equal(r.sons.find(s => s.n === 'intervalo')?.min, 45);
  assert.equal(n('fim'), 1);
  assert.equal(n('golFavor'), r.g.meus, 'um grito por gol do seu time');
  assert.equal(n('golContra'), r.g.deles, 'um lamento por gol do adversário');
  assert.equal(n('expulsao'), r.g.vermelhos);
  assert.equal(n('rede'), r.sons.filter(s => /^gol/.test(s.n) && s.a > 0).length, 'rede só nos gols de pênalti (que soam no impacto)');
});

test('pular para o fim e som desligado: nada toca; o botão de som fica na tela ao vivo', () => {
  const j = novo();
  let vivo = aoVivo(j);
  vivo.passo();
  assert.match(j.html(), /data-acao="alternarSom" aria-pressed="true"/);
  const antes = vivo.sons().length;
  j.acao('avPular');
  assert.equal(vivo.sons().length, antes, 'pular para o fim não toca nada');
  j.acao('avContinuar');
  vivo = aoVivo(j);
  j.acao('alternarSom');
  assert.equal(j.run('prefs().som'), false);
  assert.match(j.html(), /data-acao="alternarSom" aria-pressed="false"/);
  vivo.andar();
  assert.deepEqual(vivo.sons(), [], 'com o som desligado nada toca');
});

test('configurações: liga/desliga e volume salvos, com apito de amostra; volume zero é mudo', () => {
  const j = novo();
  j.run('globalThis.__sons=[];usarTocadorDeSom(n=>__sons.push(n))');
  j.acao('go|config');
  let h = j.html();
  assert.match(h, /<input id="cfgVolume" type="range" min="0" max="100" step="5" value="70" data-mudar="mudarVolume">/);
  assert.match(h, /data-mudar="mudarPref\|som" checked/);
  j.run('mudarVolume("35")');
  assert.equal(j.run('prefs().volume'), 35);
  assert.deepEqual(j.run('__sons'), ['inicio'], 'amostra no volume novo');
  assert.equal(j.run('volumeSom()'), 0.35);
  j.run('mudarVolume("0")');
  assert.equal(j.run('__sons.length'), 1, 'volume zero não toca');
  j.run('mudarVolume("80")');
  j.run('mudarPref("som", false)');
  h = j.html();
  assert.match(h, /data-mudar="mudarVolume" disabled/);
  assert.equal(j.run('volumeSom()'), 0);
  j.run('tocar("golFavor")');
  assert.equal(j.run('__sons.length'), 2);
  j.run('usarTocadorDeSom(null); tocar("golFavor")'); // sem Web Audio (Node): não quebra
  assert.doesNotMatch(h, /undefined|NaN/);
});
