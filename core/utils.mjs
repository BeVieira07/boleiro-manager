import { S } from './estado.mjs';

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
export function hashStr(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
// Sorteio com semente (#26): as regras usam rnd(), que avança S.rng (estado do gerador mulberry32 guardado no jogo).
// Mesmo estado + mesmas entradas = mesmo resultado. Cada rodada recomeça de semente(S.seed, temporada, rodada).
// Sem jogo carregado (S nulo) cai no Math.random, que só serve para coisas fora das regras.
export function rnd(){
  if(typeof S==='undefined'||!S||S.rng==null)return Math.random();
  const a=S.rng=(S.rng+0x6D2B79F5)|0;
  let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;
  return((t^t>>>14)>>>0)/4294967296;
}
export const semente=(...partes)=>hashStr(partes.join('|'))|0;
export const novaSemente=()=>(Math.random()*4294967296)|0; // único uso de Math.random ligado às regras: a semente de uma campanha nova
export const ri=(a,b,r=rnd)=>a+Math.floor(r()*(b-a+1));
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const pick=(arr,r=rnd)=>arr[Math.floor(r()*arr.length)];
export function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
export function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
export function norm(s){return String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()}
export function money(m, casas=1){
  const neg=m<0;m=Math.abs(m);
  const mi=casas===1?m.toFixed(1).replace('.',','):m.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:casas,useGrouping:false});
  const valor=m>=1?mi+' mi':Math.round(m*1000)+' mil';
  return (neg?'-':'')+'R$ '+valor;
}
export function poisson(l){const L=Math.exp(-l);let k=0,p=1;do{k++;p*=rnd()}while(p>L);return k-1}
export const PORD={G:0,D:1,M:2,A:3};
export const FORMS={'4-4-2':[4,4,2],'4-3-3':[4,3,3],'3-5-2':[3,5,2],'4-5-1':[4,5,1],'5-3-2':[5,3,2],'3-4-3':[3,4,3]};
