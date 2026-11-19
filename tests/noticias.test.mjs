import { test } from 'node:test';
import assert from 'node:assert/strict';
import { icone } from '../ui/icones.mjs';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

test('notícias do painel e de um save antigo exibem texto limpo e ícones decorativos', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  const noticias = [
    { t: '🏆 Clube & Amigos é o campeão!', r: 4 },
    { t: '⬆ Sobem para a Série A: Clube & Amigos.', r: 4 },
    { t: 'Clube: 💰 Fulano vendido por R$ 1 mi. 👩🏽‍💻', r: 4 },
    { t: '🇧🇷 Temporada encerrada.', r: 4 }
  ];
  j.run(`tec().news = ${JSON.stringify(noticias)}; go('clube')`);
  const painel = j.html().match(/<ul class="noticias">([\s\S]+?)<\/ul>/)[1];

  j.run(`store.set(SAVE_PREFIX + S.saveId, { news: tec().news }); usarEstado(null); go('menu')`);
  const resumo = j.html().match(/<section class="inicio-noticias"[^>]*>([\s\S]+?)<\/section>/)[1];
  for (const html of [painel, resumo]) {
    assert.doesNotMatch(html, /\p{RGI_Emoji}|⬆/v);
    assert.ok(html.includes(`${icone('trofeu')}<span>Clube &amp; Amigos é o campeão!</span>`));
    assert.ok(html.includes(`${icone('subir')}<span>Sobem para a Série A: Clube &amp; Amigos.</span>`));
    assert.ok(html.includes(`${icone('financas')}<span>Clube: Fulano vendido por R$ 1 mi.</span>`));
    assert.ok(html.includes('<span class="noticia"><span>Temporada encerrada.</span>'));
  }
  assert.deepEqual(j.run('store.get(SAVE_PREFIX + indiceSaves().cur).news'), noticias);

  j.acao('mudarPref|noticias.mercado', 'on', { target: { type: 'checkbox', checked: false } });
  assert.doesNotMatch(j.html(), /Fulano vendido/);
  assert.match(j.html(), /é o campeão/);
});
