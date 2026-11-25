// #49: contratos (prazo, renovação e fim de contrato)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie, jogarRodada, jogarTemporada, virarTemporada, problemasNasTelas } from './jogo.mjs';

const novo = (div = 'A', i = 10) => { const j = carregarJogo({ boot: true }); j.run(`newGame('${clubeDaSerie(j, div, i)}')`); return j };
const todos = 'S.clubs.flatMap(c=>c.players)';

test('jogo novo: todo jogador tem contrato de 1 a 4 temporadas, e o mesmo jogador recebe sempre o mesmo prazo', () => {
  const j = novo();
  assert.equal(j.run(`${todos}.every(p=>Number.isInteger(p.contrato)&&p.contrato>=1&&p.contrato<=4)`), true);
  assert.deepEqual(j.run(`[1,2,3,4].map(n=>${todos}.some(p=>p.contrato===n))`), [true, true, true, true]);
  assert.equal(j.run(`${todos}.filter(p=>p.age>=33).every(p=>p.contrato<=2)`), true, 'veterano tem contrato curto');
  const antes = j.run(`JSON.stringify(userClub().players.map(p=>p.contrato))`);
  const k = novo();
  assert.equal(k.run(`JSON.stringify(userClub().players.map(p=>p.contrato))`), antes);
});

test('valor de mercado e salário são iguais com 1, 2, 3 ou 4 temporadas de contrato', () => {
  const j = novo();
  const r = j.run(`(() => {
    const p = userClub().players.find(p => valueOf(p) > 2);
    const esperado = [valueOf(p), salarioDe(p)];
    const porPrazo = [1, 2, 3, 4].map(anos => {
      p.contrato = anos;
      refreshEconomics(p);
      return [p.value, p.wage];
    });
    return { esperado, porPrazo };
  })()`);
  for (const resultado of r.porPrazo) assert.deepEqual(resultado, r.esperado);
});

test('renovar: o jogador pede aumento, o contrato cresce e a folha sobe', () => {
  const j = novo();
  const pid = j.run(`(()=>{const p=userClub().players.find(p=>p.age<=28&&p.contrato<=4);p.contrato=1;p.forma=0;refreshEconomics(p);return p.id})()`);
  const q = j.run(`pedidoRenovacao('${pid}')`), antes = j.run(`P['${pid}'].wage`), folha = j.run('wageBill(userClub())');
  assert.equal(q.anos, 3);
  assert.ok(q.aumento >= 0.08 && q.salario > antes && q.chance > 0 && q.chance <= 0.95);
  j.run(`S.rng=1;while(rnd()>=${q.chance}){}`); // deixa o sorteio num ponto qualquer
  const r = j.run(`(()=>{let r;for(let k=0;k<40;k++){r=renovarContrato('${pid}');if(r.ok||r.erro)break;delete P['${pid}'].renRound}return r})()`);
  assert.equal(r.ok, true);
  assert.equal(j.run(`P['${pid}'].contrato`), 3);
  assert.equal(j.run(`P['${pid}'].wage`), q.salario);
  assert.ok(j.run('wageBill(userClub())') > folha);
  assert.match(j.run(`pedidoRenovacao('${pid}').erro`), /ainda tem 3 temporadas/);
  // a evolução do overall mantém o aumento negociado
  assert.equal(j.run(`(()=>{const p=P['${pid}'];refreshEconomics(p);return p.wage})()`), q.salario);
});

test('renovar: recusa vale para a rodada, e emprestado ou jogador de outro clube não renova', () => {
  const j = novo();
  const pid = j.run(`(()=>{const p=userClub().players[3];p.contrato=1;return p.id})()`);
  // força a recusa: sorteio sempre acima da chance
  const r = j.run(`(()=>{let r;for(let k=0;k<200;k++){r=renovarContrato('${pid}');if(r.ok===false)break;P['${pid}'].contrato=1;delete P['${pid}'].aum}return r})()`);
  assert.equal(r.ok, false);
  assert.match(j.run(`renovarContrato('${pid}').erro`), /não quer conversar de novo nesta rodada/);
  jogarRodada(j);
  assert.equal(j.run(`renovarContrato('${pid}').erro`), undefined, 'na rodada seguinte dá para tentar de novo');
  const outro = j.run(`Object.values(P).find(p=>p.clubId!==userClub().id).id`);
  assert.match(j.run(`renovarContrato('${outro}').erro`), /inválido/);
  const emp = j.run(`(()=>{const o=S.clubs.find(c=>c.id!==userClub().id),p=o.players[20];p.contrato=1;startLoan({pid:p.id,from:o.id,to:userClub().id,until:S.round+3,payer:'to',buy:null});return p.id})()`);
  assert.match(j.run(`renovarContrato('${emp}').erro`), /emprestado/);
  assert.equal(j.run(`P['${emp}'].contrato`), 1, 'o empréstimo não mexe no contrato');
});

test('comprar dá contrato novo e tira o aumento antigo', () => {
  const j = novo();
  const pid = j.run(`(()=>{const p=Object.values(P).find(p=>!ehHumano(p.clubId)&&p.age<30&&p.value<3&&clubById(p.clubId).players.filter(x=>x.pos===p.pos).length>4);p.contrato=1;p.aum=1.3;refreshEconomics(p);return p.id})()`);
  j.run(`userClub().balance=500;userClub().players.length=28`); // abre vaga no elenco (máximo 32)
  const r = j.run(`proporCompra('${pid}',P['${pid}'].value*3)`);
  assert.equal(r.ok, true);
  assert.equal(j.run(`[P['${pid}'].contrato,P['${pid}'].aum]`)[0], 3);
  assert.equal(j.run(`P['${pid}'].aum`), undefined);
});

test('virada: os contratos perdem um ano; no meu clube quem ficou sem contrato sai de graça, e os elencos continuam completos', () => {
  const j = novo();
  jogarTemporada(j);
  const meus = JSON.parse(j.run(`JSON.stringify(userClub().players.map(p=>[p.id,p.contrato,p.age]))`));
  const acabam = meus.filter(x => x[1] === 1).map(x => x[0]), ficam = meus.filter(x => x[1] > 1 && x[2] < 36);
  assert.ok(acabam.length > 0, 'o clube tem contratos no fim');
  virarTemporada(j);
  const eu = j.run('userClub().id');
  for (const id of acabam) assert.notEqual(j.run(`P['${id}']&&P['${id}'].clubId`), eu, 'saiu do meu clube');
  for (const [id, c] of ficam) assert.equal(j.run(`P['${id}'].contrato`), c - 1);
  assert.match(j.run('tec().news.map(n=>n.t).join("|")'), /Fim de contrato: .+ saiu de graça/);
  assert.equal(j.run(`S.clubs.every(c=>c.players.length>=15)`), true, 'todo clube tem elenco');
  assert.equal(j.run(`S.clubs.every(c=>['G','D','M','A'].every((g,i)=>c.players.filter(p=>p.pos===g).length>=[2,5,5,3][i]))`), true, 'com o mínimo por posição');
  assert.equal(j.run(`${todos}.every(p=>Number.isInteger(p.contrato)&&p.contrato>=1&&p.contrato<=4)`), true, 'ninguém começa a temporada sem contrato');
  assert.equal(j.run(`${todos}.every(p=>p.clubId&&clubById(p.clubId).players.includes(p))`), true);
  assert.equal(j.run('validateLineup()'), null, 'a escalação foi refeita sem quem saiu');
  // quem saiu de graça foi para um clube da IA com contrato novo
  const foi = acabam.map(id => j.run(`P['${id}']?P['${id}'].contrato:null`)).filter(x => x != null);
  assert.ok(foi.every(c => c === 2));
  jogarRodada(j, 3);
  assert.deepEqual(problemasNasTelas(j), []);
});

test('várias temporadas: os elencos não esvaziam nem incham', () => {
  const j = novo('B');
  for (let t = 0; t < 4; t++) { jogarTemporada(j); virarTemporada(j) }
  const n = j.run('S.clubs.map(c=>c.players.length)');
  assert.ok(Math.min(...n) >= 15 && Math.max(...n) <= 45, `elencos entre ${Math.min(...n)} e ${Math.max(...n)}`);
  assert.equal(j.run(`${todos}.some(p=>[p.ovr,p.value,p.wage,p.contrato].some(x=>typeof x!=='number'||Number.isNaN(x)))`), false);
});

test('save antigo sem contratos: recebe o contrato padrão ao carregar e continua jogando', () => {
  const j = novo();
  jogarRodada(j, 2);
  const s = JSON.parse(j.run('JSON.stringify(S)'));
  for (const c of s.clubs) for (const p of c.players) delete p.contrato;
  s.versao = 4;
  const salarios = JSON.stringify(s.clubs[0].players.map(p => p.wage));
  globalThis.__save = s;
  assert.equal(j.run('migrarSave(globalThis.__save).ok'), true);
  assert.equal(j.run('S.versao'), j.run('VERSAO_SAVE'));
  assert.equal(j.run(`${todos}.every(p=>p.contrato>=1&&p.contrato<=4)`), true);
  assert.equal(j.run('JSON.stringify(S.clubs[0].players.map(p=>p.wage))'), salarios, 'os salários não mudam com a migração');
  jogarRodada(j);
  assert.deepEqual(problemasNasTelas(j), []);
});

test('save da versão 17 restaura o valor cheio e preserva salário e contrato', () => {
  const j = carregarJogo({ boot: true, continentais: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  const r = j.run(`(() => {
    const save = JSON.parse(JSON.stringify(S));
    save.versao = 17;
    const clube = save.clubs.find(c => c.base?.length);
    const estrangeiro = Object.values(save.continentais.estrangeiros)[0];
    const jogadores = [clube.players[0], clube.base[0], estrangeiro.players[0]];
    for (const [i, p] of jogadores.entries()) {
      p.ovr = 70;
      p.contrato = i === 0 ? 1 : 2;
      if (i === 0) p.aum = 1.25;
      p.wage = salarioDe(p);
      const fator = p.contrato === 1 ? 0.75 : 0.9;
      p.value = Math.max(0.1, Math.round(valueOf(p) * fator * 10) / 10);
    }
    const retrato = p => [p.value, p.wage, p.contrato, p.aum];
    const antes = jogadores.map(retrato);
    const esperado = jogadores.map(p => [valueOf(p), p.wage, p.contrato, p.aum]);
    const migracao = migrarSave(save);
    return { migracao, versao: S.versao, antes, esperado, depois: jogadores.map(retrato) };
  })()`);
  assert.deepEqual(r.migracao, { ok: true });
  assert.equal(r.versao, j.run('VERSAO_SAVE'));
  assert.ok(r.antes.every(([valor], i) => valor < r.esperado[i][0]));
  assert.deepEqual(r.depois, r.esperado);
});

test('Elenco mostra o contrato e o botão Renovar; o Clube avisa na reta final', () => {
  const j = novo();
  j.run(`userClub().players.forEach((p,i)=>{p.contrato=i===0?1:i===1?2:4})`);
  j.run(`go('elenco')`);
  const h = j.html();
  assert.match(h, /filtrarElenco\|ord\|contrato/);
  assert.match(h, /Última temporada/);
  assert.match(h, /2 temporadas/);
  assert.equal((h.match(/data-acao="renovar\|/g) || []).length, 2, 'só quem tem até 2 temporadas');
  const pid = j.run('userClub().players[1].id');
  j.acao(`renovar|${pid}`);
  assert.ok(j.alertas.some(a => /pede \d+% de aumento/.test(a)), 'o diálogo mostra o pedido');
  assert.ok(j.alertas.some(a => /renovou por 4 temporadas|recusou a renovação/.test(a)));
  j.run(`go('clube')`);
  assert.doesNotMatch(j.html(), /ao fim da temporada/, 'no começo da temporada não avisa');
  j.run('S.round=S.fixtures.length-5;go("clube")');
  assert.match(j.html(), /contratos? acabam? ao fim da temporada/);
});

test('liga: renovar pelo servidor confere o dono do jogador', async () => {
  const { acaoMercadoLiga } = await import(new URL('../core/liga.mjs', import.meta.url));
  const j = novo();
  const s = JSON.parse(j.run('JSON.stringify(S)'));
  const meu = s.clubs.find(c => c.id === s.managers.local.clubId).players[0], alheio = s.clubs.find(c => c.id !== s.managers.local.clubId).players[0];
  meu.contrato = 1;
  assert.match(acaoMercadoLiga(s, 'local', { tipo: 'renovar', pid: alheio.id }).erro, /inválido/);
  const r = acaoMercadoLiga(s, 'local', { tipo: 'renovar', pid: meu.id });
  assert.equal(typeof r.ok, 'boolean');
});

// #426: aviso dos contratos que acabam e renovar todos de uma vez
test('renovar todos: propõe a cada renovável, resume quem renovou e quem recusou, e quem recusou espera a rodada', () => {
  const j = novo();
  const r = j.run(`(()=>{const uc=userClub();uc.balance=500;for(const p of uc.players)p.contrato=3;
    const alvo=uc.players.slice(0,6);alvo.forEach((p,i)=>p.contrato=i<4?1:2);
    const antes=renovaveis().map(p=>p.id),r=renovarTodos();
    return {antes,alvo:alvo.map(p=>p.id),r:{ok:r.ok,msg:r.msg,renovaram:r.renovaram.length,recusaram:r.recusaram.length},
      depois:renovaveis().map(p=>p.id),contratos:alvo.map(p=>p.contrato),de_novo:renovarTodos()}})()`);
  assert.deepEqual(r.antes.sort(), r.alvo.sort(), 'só quem tem até 2 temporadas');
  assert.equal(r.r.renovaram + r.r.recusaram, 6);
  assert.ok(r.r.renovaram > 0);
  assert.match(r.r.msg, /\d+ renova(u|ram)/);
  assert.ok(r.contratos.filter(c => c > 2).length === r.r.renovaram, 'quem renovou ganhou temporadas');
  assert.deepEqual(r.depois, [], 'renovados saem da lista, e quem recusou só conversa na próxima rodada');
  assert.match(r.de_novo.erro, /Nenhum contrato para renovar agora/);
});

test('o Elenco avisa os contratos que acabam e o botão renova todos de uma vez', () => {
  const j = novo();
  j.run(`(()=>{for(const p of userClub().players)p.contrato=3;userClub().players[0].contrato=1;userClub().players[1].contrato=2;globalThis.nome=userClub().players[0].name;go('elenco')})()`);
  let h = j.html();
  assert.match(h, /<b>1 contrato acaba ao fim desta temporada<\/b>/);
  assert.ok(h.includes(j.run('globalThis.nome')));
  assert.match(h, /data-acao="renovarTodosUI">Renovar todos \(2\)<\/button>/);
  j.acao('renovarTodosUI');
  assert.match(j.alertas.at(-1), /renova|recus/);
  assert.equal(j.run('renovaveis().length'), 0);
  h = j.html();
  assert.doesNotMatch(h, /Renovar todos/);
  j.run('for(const p of userClub().players)p.contrato=3;render()');
  assert.doesNotMatch(j.html(), /elenco-contratos/, 'sem contrato curto, sem aviso');
  assert.deepEqual(problemasNasTelas(j, ['elenco']), []);
});

test('na liga online, renovar todos é uma ação do mercado (sorteada no servidor)', () => {
  const j = carregarJogo();
  const r = j.run(`(()=>{iniciarLiga([{user_id:'u1',nome:'Ana',club_id:getData().clubs.find(c=>c.division==='A').id}],['A'],DADOS_PADRAO);
    for(const p of userClub().players)p.contrato=3;userClub().players[0].contrato=1;
    const r=acaoMercadoLiga(JSON.parse(JSON.stringify(S)),'u1',{tipo:'renovarTodos'});return {r,contrato:userClub().players[0].contrato,renRound:userClub().players[0].renRound}})()`);
  assert.equal(r.r.erro, undefined);
  assert.ok(r.contrato > 1 || r.renRound, 'renovou ou recusou');
});
