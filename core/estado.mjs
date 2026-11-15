import { criarBases, darPotencial } from './base.mjs';
import { contratoInicial } from './contratos.mjs';
import { criarCopa } from './copa.mjs';
import { criarEstaduais } from './estadual.mjs';
import { SQUAD_SHAPE, fakePlayer, rate, refStrength, refreshEconomics } from './dados.mjs';
import { migrarDiretoria } from './diretoria.mjs';
import { autoXI } from './motor.mjs';
import { atribuirPosicoes, converterPosicoesAntigas, simplificarPosicoes } from './posicoes.mjs';
import { hashStr, money, mulberry32, novaSemente, shuffle } from './utils.mjs';
import { VERSAO_SAVE } from './versao.mjs';

/* ================= estado ================= */
export let S=null;        // jogo salvo
export let P={};          // índice jogador por id
// técnicos humanos (#28): S.managers[id] = {id, nome, clubId, conf, confBaixa, confFat, meta, demitido, news, offers}
// S.atual é o técnico da vez (no solo, sempre 'local'). Caixa e finanças ficam no clube (c.balance, c.fin).
export const tecnicos=()=>Object.values(S.managers||{});
export const tec=()=>S.managers[S.atual];
export const tecDoClube=id=>tecnicos().find(t=>t.clubId===id);
export const ehHumano=c=>!!tecDoClube(typeof c==='string'?c:c.id);
export const clubDo=t=>clubById(t.clubId);
export const userClub=()=>clubById(tec().clubId);
export function usarTecnico(id){if(!S.managers[id])throw new Error('Técnico desconhecido: '+id);S.atual=id}
const novoTecnico=(id,nome,clubId)=>({id,nome,clubId,conf:null,confBaixa:0,confFat:[],meta:null,demitido:false,news:[],offers:[]});
// saves de antes da #28: o usuário único vira o técnico 'local' e o caixa vai para o clube
export function migrarTecnicos(s){
  if(s.managers)return;
  const t=novoTecnico('local','Você',s.userClubId);
  for(const k of ['conf','confBaixa','confFat','meta','demitido','news','offers'])if(s[k]!=null)t[k]=s[k];
  s.managers={local:t};s.atual='local';
  const c=s.clubs.find(x=>x.id===s.userClubId);if(c){c.balance=s.balance??0;c.fin=s.fin||[]}
  for(const k of ['userClubId','balance','fin','conf','confBaixa','confFat','meta','demitido','news','offers'])delete s[k];
}
export const clubById=id=>S.clubs.find(c=>c.id===id);
export function usarEstado(s){S=s} // único jeito de trocar o jogo atual de fora deste módulo
// índice de jogadores; as migrações de saves antigos ficam em core/versao.mjs (#46)
export function reindex(){
  P={};for(const c of S.clubs)for(const p of c.players){p.clubId=c.id;P[p.id]=p}}
/* ================= divisões ================= */
export const DIVS={A:'Série A',B:'Série B',C:'Série C',D:'Série D'};
export const divOf=c=>(c&&c.division)||'A';
export const divsOf=clubs=>[...new Set(clubs.map(divOf))].sort();
export const divisions=()=>divsOf(S.clubs);
export const hasTwoDivs=()=>divisions().length>1;
export const tvQuota=div=>({A:1.2,B:0.5,C:0.2,D:0.1})[div];
// bilheteria de um jogo em casa, antes do bônus pela posição na tabela
export const bilheteriaBase=c=>0.5+(c.strength-60)*0.06;
// premiação de fim de temporada e caixa inicial, por série
export const seasonPrize=(div,pos)=>Math.round(({A:5+(20-pos)*2.1,B:1+(20-pos)*0.5,C:0.3+(20-pos)*0.15,D:0.1+(20-pos)*0.08})[div]*10)/10;
export const startBalance=(div,s)=>Math.round(({A:10+(s-60)*1.5,B:Math.max(2,3+(s-55)*0.5),C:Math.max(1,1.5+(s-50)*0.2),D:Math.max(0.8,1+(s-48)*0.1)})[div]*10)/10;
export const MOVE_N=()=>Math.min(4,...divisions().map(d=>S.clubs.filter(c=>divOf(c)===d).length-1));

// regra: monta a campanha nova a partir dos dados (sem tela nem armazenamento).
// `quem` é o id do clube (um técnico, o solo) ou uma lista [{id, nome, clubId}] (vários técnicos).
export function criarJogo(quem,data){
  const lista=Array.isArray(quem)?quem:[{id:'local',nome:'Você',clubId:quem}];
  if(!lista.length||new Set(lista.map(t=>t.clubId)).size!==lista.length)throw new Error('Cada técnico precisa de um clube diferente.');
  const clubs=JSON.parse(JSON.stringify(data.clubs));
  for(const c of clubs){
    if(data.posv!==2)converterPosicoesAntigas(c.players); // dados antigos (aba Dados) usam as siglas de antes da #23
    simplificarPosicoes(c.players); // os dados guardam a posição real (Transfermarkt); o jogo usa só 6 (#97)
    if(c.players.length<16){const r=mulberry32(hashStr(c.id));let k=0;for(const [pos,n] of Object.entries(SQUAD_SHAPE))while(c.players.filter(p=>p.pos===pos).length<n)c.players.push(fakePlayer(c.id,k++,c.strength,pos,r))}
    atribuirPosicoes(c.players);
    const ref=refStrength(c,clubs);
    c.players.forEach(p=>{p.ovr=rate(p,ref);p.contrato=contratoInicial(p);refreshEconomics(p);p.goals=0;p.listed=false});
    c.formation='4-4-2';c.fin=[];
  }
  const seed=novaSemente();
  S={versao:VERSAO_SAVE,seed,rng:seed,posv:2,season:data.season||2026,dataSource:data.source,round:0,clubs,
     fixtures:makeAllFixtures(clubs),history:[],
     managers:Object.fromEntries(lista.map(t=>[t.id,novoTecnico(t.id,t.nome,t.clubId)])),atual:lista[0].id};
  for(const c of S.clubs)c.balance=startBalance(divOf(c),c.strength); // clubes da IA também têm caixa
  darPotencial(S.clubs);
  reindex();criarBases();criarCopa();criarEstaduais();
  for(const t of tecnicos()){const uc=clubDo(t);uc.lineup=autoXI(uc);addNews(`${lista.length>1?t.nome+', você':'Você'} assumiu o comando do ${uc.name}! Caixa inicial: ${money(uc.balance)}.`,uc.id)}
  migrarDiretoria(S);
  return S;
}
// notícia: sem clube vai para o técnico da vez; com clube, para o técnico daquele clube (clube da IA: descarta)
export function addNews(t,clubeId){
  const alvo=clubeId?tecnicos().filter(x=>x.clubId===clubeId):[tec()];
  for(const m of alvo){m.news.unshift({r:S.round,t});m.news=m.news.slice(0,40)}
}
export function addNewsTodos(t){for(const m of tecnicos()){m.news.unshift({r:S.round,t});m.news=m.news.slice(0,40)}}
// movimento de caixa (padrão: clube do técnico da vez)
export function addFin(desc,amount,clube=userClub()){
  clube.balance=Math.round((clube.balance+amount)*1000)/1000;
  if(!clube.fin)clube.fin=[];
  clube.fin.unshift({s:S.season,r:S.round,desc,amount});clube.fin=clube.fin.slice(0,80);
}

/* ================= calendário e tabela ================= */
export function makeFixtures(ids){
  const t=shuffle([...ids]);if(t.length%2)t.push(null);
  const n=t.length,rounds=[];
  for(let r=0;r<n-1;r++){
    const games=[];
    for(let i=0;i<n/2;i++){
      let h=t[i],a=t[n-1-i];
      if((i===0&&r%2===1)||(i>0&&(r+i)%2===1))[h,a]=[a,h];
      if(h&&a)games.push({h,a});
    }
    rounds.push(games);t.splice(1,0,t.pop());
  }
  return [...rounds,...rounds.map(g=>g.map(x=>({h:x.a,a:x.h})))];
}
// calendário de todas as divisões: a rodada r junta os jogos da rodada r de cada série
export function makeAllFixtures(clubs){
  const per=divsOf(clubs).map(d=>makeFixtures(clubs.filter(c=>divOf(c)===d).map(c=>c.id)));
  const n=Math.max(...per.map(f=>f.length));
  return Array.from({length:n},(_,r)=>per.flatMap(f=>f[r]||[]));
}
export function table(div){
  div=div||divOf(userClub());
  const T={};for(const c of S.clubs)if(divOf(c)===div)T[c.id]={id:c.id,J:0,V:0,E:0,D:0,GP:0,GC:0,Pts:0};
  for(let r=0;r<S.round;r++)for(const g of S.fixtures[r]){
    if(g.hg==null||!T[g.h])continue;const h=T[g.h],a=T[g.a];
    h.J++;a.J++;h.GP+=g.hg;h.GC+=g.ag;a.GP+=g.ag;a.GC+=g.hg;
    if(g.hg>g.ag){h.V++;a.D++;h.Pts+=3}else if(g.hg<g.ag){a.V++;h.D++;a.Pts+=3}else{h.E++;a.E++;h.Pts++;a.Pts++}
  }
  return Object.values(T).sort((x,y)=>y.Pts-x.Pts||y.V-x.V||(y.GP-y.GC)-(x.GP-x.GC)||y.GP-x.GP||clubById(x.id).name.localeCompare(clubById(y.id).name));
}

export function topScorers(n=20,div){return Object.values(P).filter(p=>p.goals>0&&(!div||divOf(clubById(p.clubId))===div)).sort((a,b)=>b.goals-a.goals||b.ovr-a.ovr).slice(0,n)}
