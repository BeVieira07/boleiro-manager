import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, problemasNasTelas } from './jogo.mjs';

test('fim de temporada registra o título da série e a campanha uma vez; carreira conserva mais de dez campanhas', () => {
  const j = carregarJogo();
  const clube = clubeDaSerie(j);
  j.run(`criarJogo('${clube}', getData())`);
  const s = j.run('S.season'), nome = j.run('userClub().name'), alvo = j.run('tec().meta.alvo');
  j.run(`
    for (const g of S.fixtures.flat()) {
      g.hg = g.h === tec().clubId ? 1 : 0;
      g.ag = g.a === tec().clubId ? 1 : 0;
    }
    S.round = S.fixtures.length;
    fecharTemporada();
  `);
  assert.equal(j.run('fecharTemporada()'), null);
  assert.deepEqual(j.run('tec().carreira.titulos'), [{ s, comp: 'serie', nome: 'Série A', clube }]);
  assert.deepEqual(j.run('tec().carreira.temporadas'), [{ s, clube, nome, div: 'A', pos: 1, alvo }]);
  j.run('for (let i = 0; i < 11; i++) { S.season++; registrarTemporada(tec(), 2) }');
  assert.equal(j.run('tec().carreira.temporadas.length'), 12);
  assert.equal(j.run('tec().historico.length'), 10);
  assert.equal(j.run('tec().historico[0].s'), s + 2);
  assert.deepEqual(Object.keys(j.run('tec().historico[0]')).sort(), ['alvo', 'div', 'pos', 's']);
});

test('final da Copa do Brasil registra o título uma vez e só para o técnico que comanda o campeão', () => {
  for (const humanoCampeao of [true, false]) {
    const j = carregarJogo();
    const clube = clubeDaSerie(j);
    j.run(`criarJogo('${clube}', getData())`);
    j.run(`{
      const meu = tec().clubId, ia = S.clubs.find(c => divOf(c) === 'A' && c.id !== meu).id;
      const [h, a] = ${humanoCampeao} ? [meu, ia] : [ia, meu];
      S.copa.datas = [2, 4];
      S.copa.fases = [{ jogos: [{ h, a, ida: { h: 2, a: 0 } }] }];
      const [volta] = jogarCopa(4, true);
      volta.hg = 0; volta.ag = 1;
    }`);
    assert.deepEqual(j.run('tec().carreira.titulos'), []);
    j.run('concluirCopa(); concluirCopa(); jogarCopa(4)');
    const campeao = j.run('S.copa.campeao');
    assert.equal(campeao === clube, humanoCampeao);
    assert.deepEqual(j.run('tec().carreira.titulos'), humanoCampeao ? [{ s: j.run('S.season'), comp: 'copa', nome: 'Copa do Brasil', clube }] : []);
  }
});

test('o título estadual entra na carreira quando a volta é concluída, uma chamada depois do jogo', () => {
  const j = carregarJogo({ estaduais: true });
  const clube = 'c121'; // Palmeiras
  j.run(`criarJogo('${clube}', getData())`);
  const nome = j.run(`torneioDe('${clube}').nome`);
  j.run(`{
    const tor = torneioDe('${clube}'), outro = tor.grupos.flat().find(id => id !== '${clube}');
    S.estaduais.torneios = [tor];
    S.estaduais.dia = S.estaduais.datas - 1;
    tor.final = { h: '${clube}', a: outro, ida: { h: 2, a: 0 } };
    const [volta] = jogarPreTemporada().jogos;
    volta.hg = 0; volta.ag = 1;
  }`);
  assert.equal(j.run(`torneioDe('${clube}').campeao`), null);
  assert.deepEqual(j.run('tec().carreira.titulos'), []);
  j.run('jogarPreTemporada(); jogarPreTemporada()');
  assert.equal(j.run(`torneioDe('${clube}').campeao`), clube);
  assert.deepEqual(j.run('tec().carreira.titulos'), [{ s: j.run('S.season'), comp: 'estadual', nome, clube }]);
});

test('migração recupera campanhas, vínculo e títulos identificáveis sem alterar o histórico nem o sorteio', () => {
  const j = carregarJogo({ estaduais: true, continentais: true });
  const ana = clubeDaSerie(j, 'A', 0), bia = clubeDaSerie(j, 'B', 0), antigo = clubeDaSerie(j, 'A', 2);
  j.run(`criarJogo([{ id: 'a', nome: 'Ana', clubId: '${ana}' }, { id: 'b', nome: 'Bia', clubId: '${bia}' }], getData())`);
  const s = j.run('S.season'), nome = j.run('userClub().name');
  j.run(`
    S.versao = 15; // antes da carreira na versão 16
    for (const t of tecnicos()) delete t.carreira;
    S.round = 8;
    S.managers.a.historico = [{ s: S.season - 1, div: 'A', pos: 1, alvo: 3 }];
    S.managers.b.demitido = true; S.managers.b.saida = 'pediu';
    S.history = [
      { season: S.season - 1, champs: { A: clubById('${antigo}').name, B: clubById('${bia}').name }, tecnicos: { a: { pos: 1, div: 'A' } } },
      { season: S.season - 3, champs: { A: userClub().name }, tecnicos: { a: { pos: 8, div: 'A' } } }
    ];
    S.copa.campeao = '${ana}';
    const estadual = torneioDe('${ana}'); estadual.campeao = '${ana}';
    S.continentais.torneios[0].campeao = '${ana}';
    S.continentais.torneios[1].campeao = '${bia}';
  `);
  const rng = j.run('S.rng'), estadual = j.run(`torneioDe('${ana}').nome`);
  assert.equal(j.run('migrarSave(S).ok'), true);
  const carreira = j.run('tec().carreira');
  assert.deepEqual(carreira, {
    passagens: [{ clube: ana, nome, de: { s: s - 3, r: 0 }, ate: null, saida: null }],
    temporadas: [{ s: s - 1, clube: ana, nome, div: 'A', pos: 1, alvo: 3 }],
    titulos: [
      { s: s - 1, comp: 'serie', nome: 'Série A', clube: antigo },
      { s, comp: 'copa', nome: 'Copa do Brasil', clube: ana },
      { s, comp: 'estadual', nome: estadual, clube: ana },
      { s, comp: 'libertadores', nome: 'Libertadores', clube: ana }
    ]
  });
  assert.deepEqual(j.run('S.managers.b.carreira'), {
    passagens: [{ clube: bia, nome: j.run(`clubById('${bia}').name`), de: { s: s - 3, r: 0 }, ate: { s, r: 8 }, saida: 'pediu' }],
    temporadas: [], titulos: []
  });
  assert.deepEqual(j.run('tec().historico'), [{ s: s - 1, div: 'A', pos: 1, alvo: 3 }]);
  const json = j.run('JSON.stringify(S.managers)');
  j.run('S.versao = 15; migrarSave(S)');
  assert.equal(j.run('JSON.stringify(S.managers)'), json);
  assert.equal(j.run('S.rng'), rng);
});

test('aba Carreira mostra a faixa sem a nota, os estados vazios e as metas dos resultados', () => {
  const j = carregarJogo();
  const clube = clubeDaSerie(j);
  j.run(`criarJogo([{ id: 'a', nome: '<Ana>', clubId: '${clube}' }], getData()); go('clube')`);
  assert.match(j.run('lateral()'), /data-acao="go\|tecnico">Carreira/);
  j.acao('go|tecnico');
  assert.match(j.html(), /<h1>Carreira<\/h1>/);
  assert.match(j.html(), /&lt;Ana&gt;/);
  assert.match(j.html(), /Reputação <strong>Respeitado<\/strong><\/p><div class="barra/);
  assert.doesNotMatch(j.html(), new RegExp(`Reputação[^<]*${j.run('reputacao(tec())')}`));
  assert.match(j.html(), /Nenhum título ainda\./);
  assert.match(j.html(), /Nenhuma temporada encerrada ainda\./);
  assert.match(j.html(), /Clube atual/);
  j.run(`registrarTemporada(tec(), 1); registrarTitulo('serie', 'Série A', tec().clubId); S.season++; registrarTemporada(tec(), 20)`);
  assert.deepEqual(problemasNasTelas(j, ['tecnico']), []);
  assert.match(j.html(), /<h3>Série A<\/h3>/);
  assert.match(j.html(), /aria-label="Meta cumprida"/);
  assert.match(j.html(), /aria-label="Meta não cumprida"/);
});
