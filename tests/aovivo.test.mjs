// #62: jogo ao vivo
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

test('marcadores da linha do tempo batem com os eventos e o gol do seu time tem destaque', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  const r = j.run(`(()=>{const g={h:userClub().id,a:S.clubs.find(c=>c.id!==userClub().id).id,ev:[{m:12,t:'gol',side:'h',name:'Fulano'},{m:46,t:'cartao',side:'a',name:'Beltrano'}]};
    const H=clubById(g.h),A=clubById(g.a);return {m:g.ev.map(e=>marcador(e,H,A)),i:g.ev.map(e=>itemEvento(e,H,A,userClub().id)),d:DURACAO}})()`);
  assert.match(r.m[0], new RegExp(`class="marca-ev gol h" style="left:${12 / r.d * 100}%"`));
  assert.match(r.m[1], new RegExp(`class="marca-ev cartao a" style="left:${46 / r.d * 100}%"`));
  assert.match(r.i[0], /class="ev gol nosso"/);
  assert.match(r.i[0], /aria-label="Gol"/, 'ícone com nome, não emoji');
  assert.match(r.i[1], /aria-label="Cartão amarelo"/);
  assert.doesNotMatch(r.i.join(''), /⚽|🟨/);
});

test('mudar a tática ao vivo refaz só os gols depois do minuto atual', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j)}')`);
  j.run(`const g={h:userClub().id,a:S.clubs.find(c=>c.id!==userClub().id).id,hg:2,ag:1,ev:[{m:10,t:'gol',side:'h',name:'A'},{m:70,t:'gol',side:'a',name:'B'},{m:80,t:'gol',side:'h',name:'C'}]};globalThis.__g=g;ui.tvAoVivo={g,min:()=>50}`);
  const outro = j.run(`Object.keys(MODOS).find(k=>k!==taticaUser(userClub()).modo)`);
  j.run(`mudarTatica('modo','${outro}');ressimularDepois(__g,50)`);
  assert.equal(j.run('taticaUser(userClub()).modo'), outro);
  const ev = j.run('__g.ev');
  assert.deepEqual(ev.filter(e => e.m <= 50).map(e => e.name), ['A'], 'o que já aconteceu fica');
  assert.ok(ev.filter(e => e.m > 50).every(e => e.m > 50 && e.m <= 93), 'os gols seguintes são refeitos depois do minuto 50');
  assert.equal(j.run('__g.hg+__g.ag'), ev.filter(e => e.t === 'gol').length, 'placar bate com os gols');
  j.run('ui.tvAoVivo=null');
});

test('sem animação com prefers-reduced-motion', () => {
  const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{animation:none!important;transition:none!important/);
});

test('bicho por vitória: o ajuste ao vivo usa o mesmo valor cobrado, mesmo com empréstimo (#43)', () => {
  const j = carregarJogo({ boot: true });
  j.run(`newGame('${clubeDaSerie(j, 'A', 0)}')`);
  // jogador caro emprestado ao meu clube, com salário pago pelo clube que cedeu: fica fora da minha folha
  j.run(`(()=>{const uc=userClub(),c=S.clubs.find(c=>c.id!==uc.id),p=[...c.players].sort((a,b)=>b.wage-a.wage)[0];
    startLoan({pid:p.id,from:c.id,to:uc.id,until:S.fixtures.length,payer:'from',buy:null})})()`);
  assert.notEqual(j.run('wageBill(userClub())'), j.run('userClub().players.reduce((s,p)=>s+p.wage,0)'));
  for (let i = 0; i < 10 && !j.run('(()=>{const g=ui.lastRound&&ui.lastRound.games.find(g=>g.h===userClub().id||g.a===userClub().id);return g&&(g.h===userClub().id?g.hg>g.ag:g.ag>g.hg)})()'); i++) j.run('if(validateLineup())userClub().lineup=autoXI(userClub());playRound(false)');
  const r = j.run(`(()=>{const uc=userClub(),g=ui.lastRound.games.find(g=>g.h===uc.id||g.a===uc.id),venceu=()=>g.h===uc.id?g.hg>g.ag:g.ag>g.hg;
    if(!venceu())return null;
    for(let k=0;k<30;k++)ressimularDepois(g,0);/* vira e desvira o resultado; a cobrança fica na rodada antes do S.round++ */
    const soma=uc.fin.filter(f=>f.desc.startsWith('Bicho por vitória')&&f.r>=S.round-1).reduce((s,f)=>s+f.amount,0);
    return {soma:Math.round(soma*1000)/1000,esperado:venceu()?-g.bicho[uc.id]:0,bicho:g.bicho[uc.id]}})()`);
  assert.ok(r, 'o time venceu alguma rodada');
  assert.equal(r.soma, r.esperado);
  assert.equal(r.bicho, j.run('bichoDe(userClub())'));
});
