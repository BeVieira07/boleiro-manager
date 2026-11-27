import { P, S, addFin, clubById, ehHumano, tec, userClub } from './estado.mjs';
import { creditarGolCopa } from './gols-copa.mjs';
import { bichoDe, wageBill } from './emprestimos.mjs';
import { acertarEnergiaDaPartida, energiaDaSaidaForcada, energiaDaTroca, energiaDoElenco, MINUTOS_JOGO, minutosDaPartida, perdaPorEnergia, TRECHO_CANSACO } from './energia.mjs';
import { cancelarDesfalque, conciliarAmarelos } from './escalacao.mjs';
import { aplicarLanceAoElenco, escalacaoInicial, escalacaoNoMinuto, melhorReserva, saidaForcada } from './lances.mjs';
import { chancesDoJogo, noticiarPenaltisDaLiga, pickScorer, power } from './motor.mjs';
import { NOMES_ALVOS_PENALTI, cobrarPenalti, timeNaDisputa } from './penaltis.mjs';
import { MAX_TROCAS } from './substituicoes.mjs';
import { clamp, hashStr, mulberry32, poisson, ri, rnd } from './utils.mjs';

/* ================= estilos de jogo e modo (ataque/defesa) ================= */
// att = multiplica os gols que o time cria; sof = multiplica os gols que o adversário cria;
// fad = desgaste: a eficiência cai (e a defesa se abre) ao longo dos 93 minutos.
export const ESTILOS={
  equilibrado:{nome:'Equilibrado',desc:'Sem ajustes.',att:1,sof:1,fad:0.02},
  toque:{nome:'Toque de bola',desc:'Controla o jogo: cede menos chances, cria um pouco mais.',att:1.04,sof:0.94,fad:0.03},
  direto:{nome:'Jogo direto',desc:'Bola longa: mais finalizações, mas também mais espaço para o rival.',att:1.10,sof:1.06,fad:0.02},
  contra:{nome:'Contra-ataque',desc:'Defende fechado e sai rápido; rende muito contra times ofensivos.',att:0.96,sof:0.90,fad:0.03},
  laterais:{nome:'Jogo pelas laterais',desc:'Cruzamentos: ataque mais forte, laterais expostas e mais cansaço.',att:1.08,sof:1.04,fad:0.05}
};
export const MODOS={
  ofensivo:{nome:'Ofensivo',desc:'Mais atacantes e risco maior.',att:1.25,sof:1.22,fad:0.06},
  equilibrado:{nome:'Equilibrado',desc:'Sem ajustes.',att:1,sof:1,fad:0},
  defensivo:{nome:'Defensivo',desc:'Time recuado: cria pouco, sofre pouco.',att:0.78,sof:0.78,fad:0.02}
};
// saves antigos não têm tática: assume o padrão
export function taticaUser(club){
  const t=club.tatica||{};
  return {estilo:ESTILOS[t.estilo]?t.estilo:'equilibrado',modo:MODOS[t.modo]?t.modo:'equilibrado'};
}
// computador: modo pela diferença de força, estilo por sorteio fixo do clube
export function autoTatica(club,opp,a=power(club),b=power(opp)){
  const d=a.att+a.def-b.att-b.def;
  const modo=d>14?'ofensivo':d<-14?'defensivo':'equilibrado';
  const estilo=modo==='defensivo'?'contra':modo==='ofensivo'?'toque':['toque','direto','laterais','equilibrado'][hashStr(club.id)%4];
  return {estilo,modo};
}
export function taticaDe(club,opp,a,b){return ehHumano(club)?taticaUser(club):autoTatica(club,opp,a,b)}
// multiplicadores de um time contra um adversário no minuto médio `mid`
export function efeitoTatica(t,tOpp,mid){
  const e=ESTILOS[t.estilo],m=MODOS[t.modo],f=(e.fad+m.fad)*mid/93;
  let att=e.att*m.att*(1-f);
  if(t.estilo==='contra'&&tOpp.modo==='ofensivo')att*=1.15; // espaço nas costas do rival
  return {att,sof:e.sof*m.sof*(1+f)};
}
// gols esperados dos dois lados entre os minutos de..ate (lh/la = jogo todo, sem tática)
export function golsSegmento(lh,la,tH,tA,de,ate){
  const mid=(de+ate)/2,n=(ate-de+1)/93,eh=efeitoTatica(tH,tA,mid),ea=efeitoTatica(tA,tH,mid);
  return {h:clamp(lh*eh.att*ea.sof,0.05,6)*n,a:clamp(la*ea.att*eh.sof,0.05,6)*n};
}
// A Copa do Brasil credita os gols ao fechar a partida. Os estaduais atualizam a própria artilharia por lance.
const torneioDoJogo=g=>g.uf&&S.estaduais?S.estaduais.torneios.find(t=>t.uf===g.uf):null;
function creditarGol(g,side,p,delta){if(g.copa||g.playoff)return;const tor=torneioDoJogo(g);if(tor)creditarGolCopa(tor,g[side],p,delta);else p.goals=Math.max(0,(p.goals||0)+delta)}
function registrarGol(g, side, p, m, pen = false) {
  creditarGol(g, side, p, 1);
  const lance = { m, t: 'gol', side, pid: p.id, name: p.name };
  if (pen) lance.pen = true;
  g.ev.push(lance);
  if (side === 'h') g.hg++;
  else g.ag++;
}
export function novosGols(g,ph,pa,nh,na,de,ate){
  const gol=(side,xi)=>{if(xi.length)registrarGol(g,side,pickScorer(xi),ri(de,ate))};
  for(let i=0;i<nh;i++)gol('h',ph.xi);for(let i=0;i<na;i++)gol('a',pa.xi);
}

// Cerca de 0,2 cobrança por partida na amostra de 2,5 gols esperados por jogo (#304; era 0,12 → ~0,3).
const PENALTIS_POR_GOL_ESPERADO = 0.08;
const CONVERSAO_MEDIA = 0.75;
function taxaDePenaltis(golsEsperados, xi) {
  return xi.some(p => p.pos !== 'G') ? golsEsperados * PENALTIS_POR_GOL_ESPERADO : 0;
}
function novosPenaltis(g, clube, side, xi, adversarios, n, de, ate) {
  if (!n) return;
  const { cobradores } = timeNaDisputa(clube.id, xi, clube.cobradores);
  const batedor = cobradores.find(p => p.pos !== 'G');
  const { goleiro } = timeNaDisputa(g[side === 'h' ? 'a' : 'h'], adversarios);
  const alvo = clube.cantos?.[batedor.id];
  for (let i = 0; i < n; i++) {
    const m = ri(de, ate), cobranca = cobrarPenalti(batedor, goleiro, rnd, { alvo });
    g.ev.push({ m, t: 'penalti', side, pid: batedor.id, name: batedor.name, gk: goleiro?.id ?? null, ...cobranca });
    if (cobranca.res === 'gol') registrarGol(g, side, batedor, m, true);
  }
}

// A força da escalação muda nos lances. Um time que perdeu jogadores tem
// também um teto menor de criação, mesmo que a média dos que ficaram suba.
export function chancesComDesfalques(ph,pa,base,inicial,neutro){
  const chances=chancesDoJogo(ph,pa,neutro);
  for(const [side,p] of [['h',ph],['a',pa]]){
    const faltam=inicial[side].xi.length-p.xi.length;
    if(faltam>0)chances[side]=Math.min(chances[side],base[side]*0.9**faltam);
  }
  return chances;
}

function recomporGol(elenco, vermelho) {
  const sai = elenco.xi.map(id => P[id]).filter(p => p && p.pos !== 'G').sort((a, b) => a.ovr - b.ovr)[0];
  const goleiro = [...elenco.banco].map(id => P[id])
    .filter(p => p?.pos === 'G').sort((a, b) => b.ovr - a.ovr)[0];
  if (!sai || !goleiro) return null;
  return { m: vermelho.m, t: 'troca', side: vermelho.side, auto: true, goleiroNoGol: true, sai: sai.id, entra: goleiro.id,
    name: `${goleiro.name} entra no lugar de ${sai.name} (expulsão do goleiro)` };
}

export function energiaDaRecomposicao(g, antes = []) {
  const atuais = g.ev.filter(e => e.auto && e.goleiroNoGol);
  const chave = e => `${e.side}|${e.m}|${e.sai}|${e.entra}`;
  const ajustar = (e, sai, entra) => energiaDaTroca(P[sai], P[entra], e.m, clubById(g[e.side]));
  for (const e of antes) if (!atuais.some(a => chave(a) === chave(e))) ajustar(e, e.entra, e.sai);
  for (const e of atuais) if (!antes.some(a => chave(a) === chave(e))) ajustar(e, e.sai, e.entra);
}

export function simularLances(g,min,revisao=false){
  const clubes={h:clubById(g.h),a:clubById(g.a)};
  const h=clubes.h,a=clubes.a;
  const elencos={h:escalacaoInicial(g.escalacoes.h),a:escalacaoInicial(g.escalacoes.a)};
  const forca=(side,m)=>power(clubes[side],elencos[side],g.cansacoNoJogo?p=>energiaDoElenco(p,elencos[side],m):undefined);
  const minutosAntes=revisao&&g.cansacoNoJogo?{h:minutosDaPartida(g,'h'),a:minutosDaPartida(g,'a')}:null;
  const inicial={h:forca('h',0),a:forca('a',0)};
  const base=chancesDoJogo(inicial.h,inicial.a,g.neutro);
  const th=taticaDe(h,a,inicial.h,inicial.a),ta=taticaDe(a,h,inicial.a,inicial.h);
  const amarelos=new Set();
  const lanceDeAtaque=e=>e.t==='gol'||e.t==='penalti';
  const recomposicoes=g.ev.filter(e=>e.auto&&e.goleiroNoGol);
  const desfalques=g.ev.filter(saidaForcada);
  const chaveCartao=e=>`${e.side}|${e.pid}|${e.m}`;
  const segundosVistos=new Set(desfalques.filter(e=>e.segundo&&e.m<=min).map(chaveCartao));
  const pendentes=g.ev.filter(e=>!lanceDeAtaque(e)&&(e.m<=min||!e.segundo)&&(!e.auto||(e.goleiroNoGol&&e.m<=min))).sort((x,y)=>x.m-y.m);
  g.ev=g.ev.filter(lanceDeAtaque);
  let de=min+1;
  const sortearTrecho=ate=>{
    const meio=(de+ate-1)/2;
    const ph=forca('h',meio),pa=forca('a',meio);
    const chances=chancesComDesfalques(ph,pa,base,inicial,g.neutro);
    const s=golsSegmento(chances.h,chances.a,th,ta,de,ate);
    const taxaH=taxaDePenaltis(s.h,ph.xi),taxaA=taxaDePenaltis(s.a,pa.xi);
    novosGols(g,ph,pa,poisson(s.h-taxaH*CONVERSAO_MEDIA),poisson(s.a-taxaA*CONVERSAO_MEDIA),de,ate);
    novosPenaltis(g,h,'h',ph.xi,pa.xi,poisson(taxaH),de,ate);
    novosPenaltis(g,a,'a',pa.xi,ph.xi,poisson(taxaA),de,ate);
    de=ate+1;
  };
  const sortearAtaques=ate=>{
    if(de>ate)return;
    // Trechos sem variação de rendimento mantêm os mesmos sorteios.
    if(g.cansacoNoJogo&&ate-de>=TRECHO_CANSACO&&Object.values(elencos).some(elenco=>elenco.xi.some(id=>P[id]&&
      perdaPorEnergia(energiaDoElenco(P[id],elenco,ate))>perdaPorEnergia(energiaDoElenco(P[id],elenco,de-1))))){
      while(de+TRECHO_CANSACO-1<ate)sortearTrecho(de+TRECHO_CANSACO-1);
    }
    sortearTrecho(ate);
  };
  const feitas={h:0,a:0},vermelhosNoGol=new Map();
  // Espera os outros desfalques do minuto antes de escolher quem sai.
  const recompor=()=>{
    for(const [side,e] of vermelhosNoGol){
      if(elencos[side].xi[0]||feitas[side]>=MAX_TROCAS)continue;
      const troca=recomporGol(elencos[side],e);
      if(troca){g.ev.push(troca);aplicarLanceAoElenco(elencos[side],troca);feitas[side]++}
    }
    vermelhosNoGol.clear();
  };
  let minuto;
  for(const lance of pendentes){
    if(lance.m!==minuto){recompor();minuto=lance.m}
    const elenco=elencos[lance.side];
    if(lance.pid&&!elenco.xi.includes(lance.pid))continue;
    let e=lance;
    if(e.t==='cartao'){
      g.ev.push(e);
      if(!amarelos.has(e.pid)){amarelos.add(e.pid);continue}
      if(segundosVistos.has(chaveCartao(e)))continue;
      e={...e,t:'vermelho',segundo:true};
    }
    sortearAtaques(e.m);
    if(e.t==='lesao'){
      let entra=e.entra;
      if(e.m>min)entra=ehHumano(clubes[e.side])?melhorReserva(elenco,e.pid):null;
      e={...e,entra};
      if(entra)g.ev.push(e,{m:e.m,t:'troca',side:e.side,auto:true,name:`${P[entra].name} entra no lugar de ${e.name} (lesão)`});
      else g.ev.push(e);
    }else g.ev.push(e);
    if(e.t==='troca')feitas[e.side]++;
    if(e.t==='vermelho'&&e.m>min&&elenco.xi[0]===e.pid&&g.expulsaoAoVivo!==g[e.side])vermelhosNoGol.set(e.side,e);
    aplicarLanceAoElenco(elenco,e);
  }
  recompor();
  sortearAtaques(MINUTOS_JOGO);
  g.ev.sort((x,y)=>x.m-y.m);
  if(revisao)for(const e of desfalques){
    const atual=g.ev.find(n=>n.t===e.t&&n.pid===e.pid&&n.m===e.m);
    if(!atual)cancelarDesfalque(g,e);
    if(!g.cansacoNoJogo)energiaDaSaidaForcada(clubes[e.side],e,atual);
  }
  if(minutosAntes)for(const side of ['h','a'])acertarEnergiaDaPartida(g,side,minutosAntes[side]);
  else if(revisao)energiaDaRecomposicao(g,recomposicoes);
  if(revisao)conciliarAmarelos(g);
}
export function mudarTatica(campo,valor){
  const uc=userClub();uc.tatica=Object.assign(taticaUser(uc),{[campo]:valor});
}
// jogo ao vivo: refaz os gols e pênaltis dos minutos seguintes com a tática nova
const saldoDe=g=>{const uid=tec().clubId;return g.h===uid?g.hg-g.ag:g.ag-g.hg};
// depois de o placar mudar ao vivo: notícia dos pênaltis da rodada e o bicho por vitória (lançado antes do jogo acabar)
function acertarDepois(g,antes){
  if(g.uf||g.copa)return; // as copas não pagam bicho por vitória
  if(S.fixtures[S.round-1]?.includes(g))noticiarPenaltisDaLiga(g,S.round-1);
  const bicho=g.bicho?.[tec().clubId]??bichoDe(userClub()),depois=saldoDe(g); // o valor cobrado em jogarRodada (#43)
  if(antes>0&&depois<=0)addFin('Bicho por vitória (ajuste)',bicho);
  if(antes<=0&&depois>0)addFin('Bicho por vitória (ajuste)',-bicho);
}
/** #292: no ao vivo, o técnico escolhe quem bate (em campo no minuto) e o canto de um pênalti do seu time.
 *  O pulo do goleiro é o que já estava sorteado (ele não sabe a escolha); o chute sai de um sorteio fixo pela escolha.
 *  Devolve {erro} ou {ok, res}; placar, artilharia, notícia e bicho acompanham. */
export function recobrarPenalti(g,lance,{pid,alvo}){
  if(!g.ev.includes(lance)||lance.t!=='penalti')return {erro:'Pênalti inválido.'};
  if(!Object.hasOwn(NOMES_ALVOS_PENALTI,alvo))return {erro:'Escolha um canto.'};
  if(!(escalacaoNoMinuto(g,lance.side,lance.m)?.xi||[]).includes(pid)||!P[pid])return {erro:'Esse jogador não está em campo.'};
  const antes=saldoDe(g),batedor=P[pid];
  const i=g.ev.findIndex(e=>e.t==='gol'&&e.pen&&e.m===lance.m&&e.side===lance.side&&e.pid===lance.pid);
  if(i>=0){const [e]=g.ev.splice(i,1);if(P[e.pid])creditarGol(g,e.side,P[e.pid],-1);e.side==='h'?g.hg--:g.ag--}
  const r=mulberry32(hashStr(`${g.h}|${g.a}|${lance.m}|${pid}|${alvo}|pen`));
  const {res}=cobrarPenalti(batedor,P[lance.gk]??null,r,{alvo,pulo:lance.pulo});
  Object.assign(lance,{pid,name:batedor.name,alvo,res,escolhido:true});
  if(res==='gol')registrarGol(g,lance.side,batedor,lance.m,true);
  g.ev.sort((x,y)=>x.m-y.m);
  acertarDepois(g,antes);
  return {ok:true,res};
}
export function ressimularDepois(g,min){
  const H=clubById(g.h),A=clubById(g.a),antes=saldoDe(g);
  g.ev=g.ev.filter(e=>{
    if(e.m<=min)return true;
    if(e.t==='penalti')return false;
    if(e.t!=='gol')return true;
    if(P[e.pid])creditarGol(g,e.side,P[e.pid],-1);
    e.side==='h'?g.hg--:g.ag--;return false;
  });
  if(g.escalacoes)simularLances(g,min,true);
  else if(min<93){
    // Em partidas legadas, uma mudança de posição também precisa atualizar as chances restantes.
    const moveu=g.ev.some(e=>e.t==='posicao'&&e.m<=min);
    const ph=power(H,moveu?escalacaoNoMinuto(g,'h',min):null),pa=power(A,moveu?escalacaoNoMinuto(g,'a',min):null);
    const chances=moveu?chancesDoJogo(ph,pa,g.neutro):{h:g.lh,a:g.la};
    const s=golsSegmento(chances.h,chances.a,taticaDe(H,A),taticaDe(A,H),min+1,93);
    novosGols(g,ph,pa,poisson(s.h),poisson(s.a),min+1,93);
    g.ev.sort((x,y)=>x.m-y.m);
  }
  acertarDepois(g,antes);
}
