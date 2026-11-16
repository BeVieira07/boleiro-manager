import { clamp, hashStr } from './utils.mjs';

/* ================= posições detalhadas =================
   p.pos  = grupo (G/D/M/A), mantido para o motor e para saves antigos
   p.pd   = posição principal detalhada (chave de POSD)
   Uma posição só por jogador (#181): não há posição secundária; jogar fora da posição tem penalidade (PEN).
   Carregado depois de utils.js e antes de dados.js; também é lido por scripts/gerar-dados-padrao.mjs. */
export const POSD={
  GOL:{nome:'Goleiro',grupo:'G'},
  ZAG:{nome:'Zagueiro',grupo:'D'},
  LD:{nome:'Lateral direito',grupo:'D'},
  LE:{nome:'Lateral esquerdo',grupo:'D'},
  MEI:{nome:'Meio-campista',grupo:'M'},
  ATA:{nome:'Atacante',grupo:'A'}
};
// #97: só 6 posições. As detalhadas que ainda vêm dos dados (Transfermarkt) e de saves antigos viram estas.
export const POS_SIMPLES={VOL:'MEI',MC:'MEI',MEI:'MEI',PE:'ATA',PD:'ATA',ATA:'ATA'};
export function simplificarPosicoes(players){
  const s=k=>POS_SIMPLES[k]||k;
  for(const p of players){if(p.pd)p.pd=s(p.pd);delete p.ps} // #181: sem posição secundária
}
export const POSD_ORDEM=Object.keys(POSD);
export const GRUPO_DETALHES={G:['GOL'],D:['ZAG','LD','LE'],M:['MEI'],A:['ATA']};
// proporção aproximada de cada posição dentro do grupo, no elenco
export const POSD_PESO={GOL:1,ZAG:.5,LD:.25,LE:.25,MEI:1,ATA:1};
// dica pelo número da camisa (quando a API não traz a posição detalhada)
export const POSD_CAMISA={2:'LD',13:'LD',23:'LD',6:'LE',16:'LE',26:'LE',3:'ZAG',4:'ZAG',14:'ZAG',15:'ZAG',5:'MEI',8:'MEI',10:'MEI',7:'ATA',11:'ATA',9:'ATA',19:'ATA'};

// Atributos que importam em cada posição (peso 0-1). O jogo mostra os mais relevantes.
export const ATRIBUTOS={vel:'Velocidade',cruz:'Cruzamento',marc:'Marcação',aereo:'Jogo aéreo',passe:'Passe',drible:'Drible',fin:'Finalização',visao:'Visão de jogo',fisico:'Físico',refl:'Reflexo',jogoPes:'Jogo com os pés'};
export const POSD_ATRIB={
  GOL:{refl:1,aereo:.7,jogoPes:.5,fisico:.3},
  ZAG:{marc:1,aereo:1,fisico:.7,passe:.3},
  LD:{vel:1,cruz:1,marc:.6,fisico:.4},
  LE:{vel:1,cruz:1,marc:.6,fisico:.4},
  MEI:{passe:1,visao:.9,drible:.6,marc:.5,fin:.4},
  ATA:{fin:1,drible:.7,vel:.6,aereo:.5}
};
// Valor de um atributo: o overall mais um desvio estável (derivado do id, sem sorteio novo a cada abertura).
export function atributosDe(p){
  const peso=POSD_ATRIB[p.pd]||POSD_ATRIB.MEI;
  return Object.entries(peso).map(([k,w])=>{
    const ruido=(hashStr(p.id+'|'+k)%9)-4;
    return {k,nome:ATRIBUTOS[k],v:clamp(Math.round(p.ovr+(w-.6)*8+ruido),20,99),w};
  }).sort((a,b)=>b.w-a.w);
}

// Perda de rendimento (fração do overall) de quem joga em outra posição: PEN[principal][posição jogada].
export const PEN={
  GOL:{},
  ZAG:{LD:.12,LE:.12,MEI:.20,ATA:.35},
  LD:{LE:.08,ZAG:.12,MEI:.18,ATA:.25},
  LE:{LD:.08,ZAG:.12,MEI:.18,ATA:.25},
  MEI:{ATA:.10,LD:.18,LE:.18,ZAG:.18},
  ATA:{MEI:.10,LD:.25,LE:.25,ZAG:.32}
};
export const PEN_GOLEIRO=0.6; // goleiro na linha (ou o contrário) é quase inútil
/* Penalidade de escalar o jogador p na posição `slot` (chave de POSD).
   Retorna {pen, tipo, aviso}: pen é a fração perdida (0 a 0.6); tipo é 'principal' ou 'fora';
   aviso é um texto para mostrar ao usuário (null quando está na posição). */
export function penalidadePosicao(p,slot){
  const pd=p.pd||inferirPosicao(p);
  if(pd===slot)return {pen:0,tipo:'principal',aviso:null};
  const pen=(pd==='GOL'||slot==='GOL')?PEN_GOLEIRO:(PEN[pd]&&PEN[pd][slot])||.35;
  return {pen,tipo:'fora',aviso:`${p.name} é ${POSD[pd].nome.toLowerCase()} e jogará de ${POSD[slot].nome.toLowerCase()}: -${Math.round(pen*100)}% no desempenho.`};
}
// Overall do jogador já com a penalidade da posição em que joga.
export function ovrNaPosicao(p,slot){return Math.round(p.ovr*(1-penalidadePosicao(p,slot).pen))}
export const posDNome=p=>POSD[p.pd||inferirPosicao(p)].nome;
export const posDSigla=p=>p.pd||inferirPosicao(p);

/* ---- atribuição e migração ---- */
export function inferirPosicao(p){ // sem contexto do elenco: só pelo grupo e pela camisa
  const g=GRUPO_DETALHES[p.pos]||['MEI'],h=POSD_CAMISA[p.number];
  return h&&g.includes(h)?h:g[hashStr(p.id)%g.length];
}
// Dá pd a quem ainda não tem, equilibrando o elenco (proporção de POSD_PESO). Idempotente: não mexe em quem já tem pd.
export function atribuirPosicoes(players){
  const cont={},tam={};
  for(const p of players){tam[p.pos]=(tam[p.pos]||0)+1;if(p.pd)cont[p.pd]=(cont[p.pd]||0)+1}
  for(const p of players){
    if(p.pd&&POSD[p.pd])continue;
    const g=GRUPO_DETALHES[p.pos]||['MEI'],soma=g.reduce((s,k)=>s+POSD_PESO[k],0);
    let pd=POSD_CAMISA[p.number];
    // a dica da camisa vale até a cota da posição no elenco (+1)
    if(!pd||!g.includes(pd)||(cont[pd]||0)>=Math.ceil(tam[p.pos]*POSD_PESO[pd]/soma)+1)
      pd=[...g].sort((a,b)=>(cont[a]||0)/POSD_PESO[a]-(cont[b]||0)/POSD_PESO[b])[0];
    p.pd=pd;cont[pd]=(cont[pd]||0)+1;
  }
}
// Sorteio para jogadores gerados (base, elenco fictício): escolhe a posição detalhada de um grupo.
export function sorteiaPosD(grupo,r){
  const g=GRUPO_DETALHES[grupo]||['MEI'];let x=r()*g.reduce((s,k)=>s+POSD_PESO[k],0);
  for(const k of g){x-=POSD_PESO[k];if(x<=0)return k}return g[0];
}
// Chaves da #23: MEI→MC, MAT→MEI, CEN→ATA, PON→PE ou PD (pela camisa 11/7, senão pelo id). A ordem importa: MEI vira MC antes de MAT virar MEI.
export function converterPosicoesAntigas(players){
  const ponta=p=>p.number===11?'PE':p.number===7?'PD':hashStr(p.id)%2?'PE':'PD';
  for(const p of players){
    const nova=k=>k==='PON'?ponta(p):k==='MEI'?'MC':k==='MAT'?'MEI':k==='CEN'?'ATA':k;
    if(p.pd)p.pd=nova(p.pd);
  }
}
// estado.posv=2 marca saves já convertidos
export function migrarPosicoes(estado){
  if(estado.posv!==2){for(const c of estado.clubs)converterPosicoesAntigas(c.players);estado.posv=2}
  for(const c of estado.clubs)simplificarPosicoes(c.players);
  for(const c of estado.clubs)atribuirPosicoes(c.players);
}
