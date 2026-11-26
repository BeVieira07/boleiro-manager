import { registrarTemporada, sairDoClube } from './carreira.mjs';
import { regraLiga } from './campeonatos.mjs';
import { wageBill } from './emprestimos.mjs';
import { DIVS, S, addNews, bilheteriaBase, clubById, clubDo, divOf, rodadasDaDivisao, seasonPrize, table, tec, tvQuota, zonasDaDivisao } from './estado.mjs';
import { clamp } from './utils.mjs';

/* ================= confiança da diretoria (#11) =================
   Por técnico (S.managers[id]): conf: 0 a 100 (começa em 60). meta: objetivo da temporada, tirado da força do clube na divisão.
   confFat: o que pesou na última rodada. confBaixa: rodadas seguidas com confiança <= DEMISSAO_NIVEL.
   Saves antigos assumem 60 e uma meta calculada na hora (migrarDiretoria). */
export const CONF_INICIO=60,DEMISSAO_NIVEL=10,DEMISSAO_RODADAS=3;
export const FAIXAS=[[80,'Segurança total'],[55,'Estável'],[30,'Em risco'],[0,'Demissão iminente']];
export const faixaConf=c=>FAIXAS.find(f=>c>=f[0])[1];
/* finanças (#48). Receita esperada por rodada regular da liga: cota de TV + meia bilheteria (um jogo em casa a cada dois).
   A folha só pesa acima de FOLHA_LIMITE vezes a receita: no elenco padrão a mais alta começa em 1,41 e passa de 1,7 com a evolução
   dos jogadores (Flamengo, que fecha a temporada no vermelho); os outros 79 clubes ficam abaixo do limite, ou perto dele.
   Caixa em queda: QUEDA_RODADAS rodadas seguidas no vermelho e, no ritmo delas (a mediana, para uma compra isolada não pesar),
   nem a premiação da meta cobre o buraco até o fim da temporada. O elenco padrão perde dinheiro por rodada e fecha a conta na premiação. */
export const FOLHA_LIMITE=1.6,QUEDA_RODADAS=4;
export const receitaEsperada=c=>tvQuota(divOf(c))+Math.max(0,bilheteriaBase(c))/2;
export const folhaSobreReceita=c=>wageBill(c)/receitaEsperada(c);
export function fatoresFinanceiros(uc,meta){
  const fat=[],q=folhaSobreReceita(uc);
  if(q>FOLHA_LIMITE)fat.push({t:'Folha acima da receita',v:-clamp((q-FOLHA_LIMITE)*3,0.3,1.5)});
  const saldos=[];for(let r=S.round-1;r>=0&&saldos.length<QUEDA_RODADAS;r--)saldos.push((uc.fin||[]).filter(f=>f.s===S.season&&f.r===r).reduce((s,f)=>s+f.amount,0));
  if(uc.balance<0)fat.push({t:'Caixa negativo',v:-1.5});
  else if(saldos.length===QUEDA_RODADAS&&saldos.every(x=>x<0)){
    const o=[...saldos].sort((a,b)=>a-b),ritmo=(o[1]+o[2])/2,premio=meta?seasonPrize(divOf(uc),meta.alvo):0;
    if(uc.balance+ritmo*Math.max(0,rodadasDaDivisao(divOf(uc))-S.round)+premio<0)fat.push({t:`Caixa em queda há ${QUEDA_RODADAS} rodadas`,v:-0.8});
  }
  return fat;
}
/** Meta que a diretoria de um clube cobra, pela força dele na série: {texto, alvo}. */
export function metaDe(uc,clubes=S.clubs){
  const d=divOf(uc),concorrentes=clubes.filter(c=>divOf(c)===d),n=concorrentes.length;
  // posição esperada pela força; no empate, desempata pelo id (#441: com vários empatados no topo, ninguém ficava com a meta de acesso)
  const esp=1+concorrentes.filter(c=>c.strength>uc.strength||(c.strength===uc.strength&&c.id<uc.id)).length;
  const {acima,acessoDireto,rebaixamento:bottom,playoffAte}=zonasDaDivisao(d,clubes);
  const metas=regraLiga(d)?.metas;
  if(metas){
    if(esp<=metas.titulo.ate)return {texto:'Lutar pelo título',alvo:metas.titulo.alvo};
    if(esp<=metas.vagaEuropeia)return {texto:'Vaga europeia',alvo:metas.vagaEuropeia};
    if(esp<=acessoDireto)return {texto:`Acesso direto à ${DIVS[acima]}`,alvo:acessoDireto};
    if(esp<=playoffAte)return {texto:'Chegar ao mata-mata do acesso',alvo:playoffAte};
  }else{
    if(playoffAte && esp>2 && esp<=playoffAte)return {texto:'Chegar ao mata-mata do acesso',alvo:playoffAte};
    if(esp<=2)return {texto:'Lutar pelo título',alvo:3};
    if(d==='A'&&esp<=6)return {texto:'Vaga na Libertadores',alvo:6}; // #382
    if(esp<=acessoDireto)return {texto:`Acesso à ${DIVS[acima]}`,alvo:acessoDireto};
  }
  if(bottom&&esp>n-bottom)return {texto:'Evitar o rebaixamento',alvo:n-bottom};
  return {texto:'Terminar no meio da tabela',alvo:Math.min(n,esp+1)};
}
export function definirMeta(t=tec()){t.meta=metaDe(clubDo(t))}
export function migrarDiretoria(estado){for(const t of Object.values(estado.managers||{})){if(t.conf==null){t.conf=CONF_INICIO;t.confBaixa=0;t.confFat=[]}if(!t.meta)definirMeta(t)}}
// depois de cada rodada: soma os fatores, limita a variação e confere a demissão
export function atualizarConfianca(t,jogo){
  const uc=clubDo(t),me=uc.id,fat=[];
  const add=(txt,v)=>{if(v)fat.push({t:txt,v:Math.round(v*10)/10})};
  if(jogo){const gf=jogo.h===me?jogo.hg:jogo.ag,ga=jogo.h===me?jogo.ag:jogo.hg;const adv=clubById(jogo.h===me?jogo.a:jogo.h),aj=clamp((adv.strength-uc.strength)/10,-1,1); // pesa o resultado contra a força do rival
    add(gf>ga?'Vitória':gf<ga?'Derrota':'Empate',(gf>ga?1.5:gf<ga?-1.2:0.3)+aj)}
  const seq=[];for(let r=S.round-1;r>=0&&seq.length<3;r--){const g=S.fixtures[r].find(g=>g.h===me||g.a===me);if(g)seq.push(g.hg===g.ag?0:(g.h===me)===(g.hg>g.ag)?1:-1)}
  if(seq.length===3&&seq.every(x=>x===1))add('Três vitórias seguidas',1.5);
  if(seq.length===3&&seq.every(x=>x===-1))add('Três derrotas seguidas',-1.5);
  const pos=table(divOf(uc)).findIndex(x=>x.id===me)+1;
  add(`Posição (${pos}º) contra a meta (${t.meta.alvo}º)`,clamp((t.meta.alvo-pos)*0.3,-2,2)*Math.min(1,S.round/8)); // pesa pouco nas primeiras rodadas
  for(const f of fatoresFinanceiros(uc,t.meta))add(f.t,f.v);
  if(t.copaFat){add(t.copaFat.t,t.copaFat.v);delete t.copaFat} // Copa do Brasil (#51): classificação, eliminação ou título nesta rodada
  aplicarConfianca(t,fat,6,true);
}
// rodada: conta para a demissão (#371: copa continental e estadual mexem na confiança, mas não contam outra rodada)
export function aplicarConfianca(t,fat,lim,rodada=false){
  const d=clamp(fat.reduce((s,f)=>s+f.v,0),-lim,lim);
  t.conf=clamp(Math.round((t.conf+d)*10)/10,0,100);t.confFat=fat;
  if(!rodada)return;
  t.confBaixa=t.conf<=DEMISSAO_NIVEL?(t.confBaixa||0)+1:0;
  if(t.confBaixa>=DEMISSAO_RODADAS&&!t.demitido)sairDoClube(t,'demitido'); // #37: continua no jogo, com propostas de outros clubes
}
export function confiancaFimTemporada(t,pos){
  registrarTemporada(t,pos); // #37: reputação do técnico
  const dif=t.meta.alvo-pos,ok=dif>=0;
  const fat=[{t:`Fim de temporada: ${pos}º (meta: ${t.meta.texto})`,v:ok?Math.min(15,5+dif*2):Math.max(-20,dif*3)}];
  if(clubDo(t).balance<0)fat.push({t:'Fechou a temporada com caixa negativo',v:-5}); // meta financeira (#48), já com a premiação
  aplicarConfianca(t,fat,20,true);
}
// confiança volta a meia distância do neutro a cada temporada
export function confiancaNovaTemporada(t){t.conf=Math.round((t.conf+CONF_INICIO)/2);t.confBaixa=0;definirMeta(t);addNews(`🎯 Meta da diretoria: ${t.meta.texto}.`,t.clubId)}
