// #48: finanças na confiança da diretoria (folha contra a receita, caixa em queda e caixa no fim da temporada)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, jogarRodada, jogarTemporada, problemasNasTelas } from './jogo.mjs';

const novo = (div = 'A', i = 10) => { const j = carregarJogo({ boot: true }); j.run(`newGame('${clubeDaSerie(j, div, i)}')`); return j };
const fatores = j => j.run('tec().confFat.map(f=>f.t)');
// multiplica os salários até a folha ficar em `q` vezes a receita esperada
const folhaEm = (j, q) => j.run(`(()=>{const uc=userClub(),k=${q}/folhaSobreReceita(uc);for(const p of uc.players)p.wage*=k})()`);

test('receita esperada: cota de TV mais meia bilheteria, e nenhum clube padrão passa do limite da folha', () => {
  const j = novo();
  assert.equal(j.run('receitaEsperada(userClub())'), j.run('tvQuota(userClub())+bilheteriaBase(userClub())/2'));
  assert.equal(j.run('S.clubs.every(c=>receitaEsperada(c)>0)'), true);
  assert.deepEqual(j.run('S.clubs.filter(c=>folhaSobreReceita(c)>FOLHA_LIMITE).map(c=>c.name)'), [], 'o elenco padrão não é cobrado');
});

test('clube equilibrado não é cobrado pelas finanças', () => {
  for (const div of ['A', 'D']) {
    const j = novo(div);
    for (let r = 0; r < 8; r++) { jogarRodada(j); assert.equal(fatores(j).some(t => /Folha|Caixa/.test(t)), false, `série ${div}, rodada ${r + 1}: ${fatores(j)}`) }
  }
});

test('folha bem acima da receita derruba a confiança mesmo com o caixa positivo', () => {
  const j = novo();
  j.run('userClub().balance=500');
  folhaEm(j, 2.5);
  jogarRodada(j);
  assert.ok(j.run('userClub().balance') > 0, 'o caixa continua positivo');
  const f = j.run(`tec().confFat.find(f=>f.t==='Folha acima da receita')`);
  assert.equal(f.v, -1.5, 'penalidade no teto');
  assert.equal(fatores(j).includes('Caixa negativo'), false);
  // logo acima do limite a cobrança é leve; abaixo dele, nenhuma
  folhaEm(j, 1.65); jogarRodada(j);
  assert.equal(j.run(`tec().confFat.find(f=>f.t==='Folha acima da receita').v`), -0.3);
  folhaEm(j, 1.55); jogarRodada(j);
  assert.equal(fatores(j).includes('Folha acima da receita'), false);
});

test('caixa em queda: várias rodadas no vermelho e nem a premiação da meta fecha a conta', () => {
  const j = novo();
  jogarRodada(j, 6);
  // lançamentos montados à mão: o saldo de cada uma das últimas rodadas (da mais recente para trás)
  const caso = (saldos, caixa) => j.run(`(()=>{const uc=userClub();uc.balance=${caixa};
    uc.fin=${JSON.stringify(saldos)}.map((v,k)=>({s:S.season,r:S.round-1-k,desc:'teste',amount:v}));
    return fatoresFinanceiros(uc,tec().meta).map(f=>f.t)})()`);
  const premio = j.run(`seasonPrize(divOf(userClub()),tec().meta.alvo)`), restam = j.run('S.fixtures.length-S.round');
  const folego = restam - premio; // perdendo 1 por rodada, é o caixa que zera a conta no fim, já com a premiação
  assert.deepEqual(caso([-1, -1, -1, -1], folego - 1), ['Caixa em queda há 4 rodadas']);
  assert.deepEqual(caso([-1, -1, -1, -1], folego + 1), [], 'com caixa para chegar ao fim, não é cobrado');
  assert.deepEqual(caso([-1, -1, -1], folego - 1), [], 'três rodadas ainda não bastam');
  assert.deepEqual(caso([-1, 0.2, -1, -1], folego - 1), [], 'uma rodada no azul interrompe a queda');
  assert.deepEqual(caso([-1, -1, -40, -1], folego - 1), ['Caixa em queda há 4 rodadas'], 'uma compra grande não muda o ritmo (mediana)');
  assert.deepEqual(caso([-1, -1, -40, -1], folego + 1), []);
  assert.deepEqual(caso([-1, -1, -1, -1], -0.5), ['Caixa negativo'], 'no vermelho, só o caixa negativo é cobrado');
  // de outra temporada não conta
  assert.deepEqual(j.run(`(()=>{const uc=userClub();uc.balance=1;uc.fin=[0,1,2,3].map(k=>({s:S.season-1,r:S.round-1-k,desc:'teste',amount:-1}));return fatoresFinanceiros(uc,tec().meta)})()`), []);
});

test('caixa negativo continua pesando, e fechar a temporada no vermelho pesa no balanço final', () => {
  const j = novo();
  j.run('userClub().balance=-50'); jogarRodada(j);
  assert.equal(fatores(j).includes('Caixa negativo'), true);
  assert.equal(fatores(j).some(t => /Caixa em queda/.test(t)), false, 'não cobra duas vezes');
  jogarTemporada(j);
  j.run('userClub().balance=-500;tec().conf=60;seasonEnd()');
  assert.equal(fatores(j).includes('Fechou a temporada com caixa negativo'), true);
  const k = novo(); jogarTemporada(k); k.run('userClub().balance=500;seasonEnd()');
  assert.equal(fatores(k).some(t => /caixa negativo/i.test(t)), false);
});

test('o fator financeiro aparece na tela do Clube, e as Finanças mostram a folha contra a receita', () => {
  const j = novo();
  j.run('userClub().balance=500'); folhaEm(j, 2.5); jogarRodada(j);
  j.run(`go('clube')`);
  assert.match(j.html(), /Folha acima da receita <b class="bad">-1\.5<\/b>/);
  assert.match(j.html(), /receita esperada:/);
  j.run(`go('financas')`);
  assert.match(j.html(), /250% da receita esperada/);
  assert.match(j.html(), /acima do que a diretoria aceita \(160%\)/);
  assert.deepEqual(problemasNasTelas(j, ['clube', 'financas']), []);
  const k = novo(); k.run(`go('financas')`);
  assert.doesNotMatch(k.html(), /acima do que a diretoria aceita/);
});
