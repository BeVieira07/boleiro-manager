import { S, divOf } from './estado.mjs';
import { sorteiaPosD } from './posicoes.mjs';
import { clamp, hashStr, mulberry32, pick, ri } from './utils.mjs';

/* ================= dados base (Série A 2026) ================= */
// [nome, sigla, força base, cor, chaves de busca p/ casar com a API]
export const BASE_CLUBS=[
 ['Flamengo','FLA',80,'#c4122e',['flamengo']],
 ['Palmeiras','PAL',79,'#006437',['palmeiras']],
 ['Botafogo','BOT',75,'#222',['botafogo']],
 ['Cruzeiro','CRU',75,'#1d3fa0',['cruzeiro']],
 ['Atlético-MG','CAM',74,'#333',['atletico-mg','atletico mineiro','atletico mg']],
 ['Fluminense','FLU',74,'#7a1430',['fluminense']],
 ['Internacional','INT',73,'#d6001c',['internacional']],
 ['São Paulo','SAO',73,'#c8102e',['sao paulo']],
 ['Corinthians','COR',73,'#444',['corinthians']],
 ['Bahia','BAH',72,'#0057a8',['bahia']],
 ['Grêmio','GRE',72,'#0d80bf',['gremio']],
 ['Vasco da Gama','VAS',71,'#111',['vasco']],
 ['RB Bragantino','RBB',71,'#c8102e',['bragantino']],
 ['Santos','SAN',71,'#555',['santos']],
 ['Athletico-PR','CAP',69,'#c8102e',['paranaense','athletico']],
 ['Mirassol','MIR',69,'#d4a017',['mirassol']],
 ['Vitória','VIT',68,'#c8102e',['vitoria']],
 ['Coritiba','CFC',67,'#00843d',['coritiba']],
 ['Chapecoense','CHA',65,'#008f39',['chapecoense']],
 ['Remo','REM',65,'#1b2a6b',['remo']]
];
export const FN=['Lucas','Gabriel','Matheus','Pedro','João','Rafael','Bruno','Thiago','Vitor','Caio','Diego','Felipe','Gustavo','Igor','Leandro','Marcelo','Nicolas','Otávio','Renan','Samuel','Wesley','Yuri','André','Davi','Enzo','Fábio','Hugo','Kauã','Luan','Murilo','Ruan','Erick','Alan','Kaio','Jefferson'];
export const LN=['Silva','Santos','Oliveira','Souza','Lima','Pereira','Costa','Rodrigues','Almeida','Nascimento','Carvalho','Araújo','Ribeiro','Gomes','Martins','Rocha','Barbosa','Cardoso','Teixeira','Moreira','Batista','Freitas','Mendes','Pinto','Ramos','Vieira','Monteiro','Farias'];
export const SQUAD_SHAPE={G:3,D:8,M:9,A:6};

export function fakePlayer(clubId,i,strength,pos,r,ageRange){
  return {id:'s'+clubId+'_'+i+'_'+Math.floor(r()*1e6),name:pick(FN,r)+' '+pick(LN,r),age:ageRange?ri(ageRange[0],ageRange[1],r):ri(18,34,r),pos,pd:sorteiaPosD(pos,r),number:i+1,photo:null};
}
export function sampleData(){
  const r=mulberry32(2026);
  const clubs=BASE_CLUBS.map((b,ci)=>{
    const id='c'+ci; const players=[]; let i=0;
    for(const [pos,n] of Object.entries(SQUAD_SHAPE)) for(let k=0;k<n;k++) players.push(fakePlayer(id,i++,b[2],pos,r));
    return {id,name:b[0],short:b[1],color:b[3],logo:null,strength:b[2],players};
  });
  return {source:'sample',season:2026,createdAt:new Date().toISOString(),clubs};
}

/* ================= atributos e valores ================= */
// Overall médio de um titular de cada série. Mantenha igual ao CENTRO de scripts/gerar-dados-padrao.mjs.
export const OVR_CENTRO={A:72,B:66,C:61,D:56};
// Overall de referência de um clube: o centro da série, mais ou menos conforme o clube é mais forte ou mais fraco que a média dela.
export function refStrength(c,clubs){
  const dv=divOf(c),mesmos=clubs.filter(x=>divOf(x)===dv);
  return OVR_CENTRO[dv]+(c.strength-mesmos.reduce((s,x)=>s+x.strength,0)/mesmos.length);
}
// Overall do jogador, em ordem de prioridade:
//  1. p.ovrM  — valor escolhido à mão (data/overalls-manual.json)
//  2. p.base  — calculado da nota média e dos minutos reais (npm run notas), misturado com a estimativa conforme p.conf
//  3. Séries A e B: valor de mercado real do Transfermarkt (p.vm, em milhões de €; #174), com a idade pesando
//  4. estimativa pela força do clube e idade, com pouco sorteio; quem jogou pouco ou nada (p.mn) fica mais baixo
// Quem não tem nota manual nunca passa do teto da idade (jovem de base não é craque sem alguém escrever que é).
const fatorIdade=a=>a<=21?1.4:a<=24?1.2:a<=28?1:a<=31?0.7:0.4; // o mesmo de valueOf: jovem vale mais, veterano menos
/** Overall que um valor de mercado (milhões de €) sugere, para a idade: 0 → 55, 1 → 64, 5 → 72, 15 → 78, 40 → 85. */
const ACRESCIMO_SERIE={A:0,B:4}; // o valor de mercado cai de uma série para outra mais do que o nível de jogo: sem isso, a B ficava igual à C
export const ovrDeValor=(v,a,serie='A')=>62.4+(ACRESCIMO_SERIE[serie]||0)+6*Math.log(v/Math.sqrt(fatorIdade(a))+0.3);
export const tetoIdade=a=>a<=17?62:a<=19?68:a<=21?74:95;
export function rate(p,ref,serie){
  if(p.ovrM!=null)return clamp(Math.round(p.ovrM),40,95);
  const r=mulberry32(hashStr(p.id+'|'+p.name));
  const a=p.age||25;
  const ageAdj=a<=19?-6:a<=21?-3:a<=23?-1:a<=30?1:a<=32?0:a<=34?-2:-4;
  let h=ref-1+(r()+r()+r()-1.5)*6+ageAdj;
  if(p.mn!=null&&p.mn<600)h-=4;
  const porValor=serie==='A'||serie==='B';
  if(porValor&&p.vm!=null)h=ovrDeValor(p.vm,a,serie)+(r()+r()-1)*1.5; // o mesmo valor não empata: um pouco de sorteio fixo por jogador
  else if(porValor)h=Math.min(h-4,ref-5); // não casou com o Transfermarkt (reserva, base ou já saiu): nível de banco do clube, nunca de craque
  if(p.base!=null){const w=p.conf??1;h=w*p.base+(1-w)*h}
  return clamp(Math.round(Math.min(h,tetoIdade(a))),40,93);
}
/** Força de um clube pelo elenco: média dos 11 titulares de um 4-4-2 (os melhores de cada posição). */
export function forcaDoElenco(c){
  const por=pos=>c.players.filter(p=>p.pos===pos).map(p=>p.ovr).sort((a,b)=>b-a);
  const xi=[...por('G').slice(0,1),...por('D').slice(0,4),...por('M').slice(0,4),...por('A').slice(0,2)];
  return xi.length?Math.round(xi.reduce((s,x)=>s+x,0)/xi.length):c.strength;
}
export function valueOf(p){
  const af=p.age<=21?1.4:p.age<=24?1.2:p.age<=28?1:p.age<=31?0.7:0.4;
  return Math.round(0.3*Math.pow(1.13,p.ovr-50)*af*10)/10 || 0.1;
}
// contratos (#49): contrato curto vale menos no mercado; o salário segue o valor cheio, vezes o aumento negociado na renovação (p.aum)
export const fatorContrato=p=>p.contrato==null||p.contrato>=3?1:p.contrato===2?0.9:0.75;
export const salarioDe=(p,aum=p.aum||1)=>Math.round(Math.max(0.1,valueOf(p))*0.01*aum*1000)/1000;
export function refreshEconomics(p){p.value=Math.max(0.1,Math.round(Math.max(0.1,valueOf(p))*fatorContrato(p)*10)/10);p.wage=salarioDe(p)}

/* #47: ids e cores vão para atributos HTML. Dados de fora (aba Dados, save importado) só entram com ids simples,
   e a cor só é usada se for #rgb ou #rrggbb (conferida na hora de desenhar, vale para qualquer origem). */
const idOk=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,40}$/.test(x);
export const corOk=c=>typeof c==='string'&&/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c);
export function erroIds(clubs){
  for(const c of clubs||[]){
    if(!c||!idOk(c.id))return 'O arquivo tem um clube com id inválido (use só letras, números, _ e -).';
    for(const p of c.players||[])if(!p||!idOk(p.id))return `O arquivo tem um jogador com id inválido no clube ${c.name}.`;
  }
  return null;
}
