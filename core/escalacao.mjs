import { P, S, addNews, tecnicos, userClub } from './estado.mjs';
import { autoXI, getXI } from './motor.mjs';
import { POSD, ovrNaPosicao, penalidadePosicao, posDSigla } from './posicoes.mjs';
import { fatorEnergia } from './energia.mjs';
import { NOMES_ALVOS_PENALTI } from './penaltis.mjs';

/* ================= escalação: tela, disponibilidade e trocas ================= */
// Disponibilidade: p.inj = rodadas de lesão restantes, p.susp = rodadas de suspensão restantes (ausentes em saves antigos = disponível)
function indisponibilidade(p,susp){
  if(p.inj>0)return `lesionado (${p.inj} rod.)`;
  if(susp>0)return `suspenso (${susp} rod.)`;
  return null;
}
let considerarAmarelos = true;
const suspensaoSemAmarelos = p => p.suspSemAmarelos ?? p.susp;
export const indisponivelNaCopa = p => indisponibilidade(p, suspensaoSemAmarelos(p));
export const unavailable = p => considerarAmarelos ? indisponibilidade(p, p.susp) : indisponivelNaCopa(p);

// As copas da mesma rodada mantêm a disponibilidade por lesão e vermelho.
export function semSuspensoesPorAmarelos(jogar) {
  const antes = considerarAmarelos;
  considerarAmarelos = false;
  try { return jogar() } finally { considerarAmarelos = antes }
}

export const SUSPENSAO_POR_EXPULSAO = 1;
export const AMARELOS_PARA_SUSPENSAO = 3;
const noticiaDe = e => e.t === 'lesao'
  ? `🩹 ${e.name} se lesionou e desfalca o time por ${e.rodadas} rodada(s).`
  : `🟥 ${e.name} foi expulso e cumpre 1 jogo de suspensão.`;

// Quando há suspensão por amarelos, guarda quanto resta por vermelho (inclusive zero).
function suspenderPorVermelho(p, jogos) {
  if (p.suspSemAmarelos != null) p.suspSemAmarelos = jogos;
  else p.susp = jogos;
}

function encerrarSuspensaoPorAmarelos(p) {
  if (p.suspSemAmarelos == null) return;
  p.susp = p.suspSemAmarelos;
  delete p.suspSemAmarelos;
}

function noticiarSuspensaoPorAmarelos(g, pid, clube, suspenso) {
  const { rodada, chave } = g.amarelos, amarelos = `${chave}|${pid}`;
  if (suspenso) {
    addNews(`${P[pid].name} acumulou ${AMARELOS_PARA_SUSPENSAO} cartões amarelos e cumpre 1 jogo de suspensão.`, clube, rodada, { amarelos });
    return;
  }
  for (const t of tecnicos().filter(t => t.clubId === clube)) {
    const i = t.news.findIndex(n => n.amarelos === amarelos);
    if (i >= 0) t.news.splice(i, 1);
  }
}

// No ao vivo, compara os amarelos válidos antes e depois da revisão dos lances.
// A contagem anterior ao jogo permite desfazer o cartão mesmo quando ele zerou o acúmulo.
export function conciliarAmarelos(g) {
  if (!g.amarelos) return; // copa, replay legado ou partida ainda sem disciplina aplicada
  const eventos = g.ev || [];
  const expulsosPorDois = new Set(eventos.filter(e => e.t === 'vermelho' && e.segundo).map(e => e.pid));
  const validos = new Map(eventos.filter(e => e.t === 'cartao' && !expulsosPorDois.has(e.pid) && P[e.pid])
    .map(e => [e.pid, g[e.side]]));
  const { contagens } = g.amarelos;
  for (const [pid, { antes, clube }] of Object.entries(contagens)) {
    if (validos.has(pid)) continue;
    const p = P[pid];
    if (p) {
      p.amar = antes;
      if (antes === AMARELOS_PARA_SUSPENSAO - 1) {
        encerrarSuspensaoPorAmarelos(p);
        noticiarSuspensaoPorAmarelos(g, pid, clube, false);
      }
    }
    delete contagens[pid];
  }
  for (const [pid, clube] of validos) {
    if (Object.hasOwn(contagens, pid)) continue;
    const p = P[pid], antes = p.amar ?? 0;
    contagens[pid] = { antes, clube };
    p.amar = antes + 1;
    if (p.amar < AMARELOS_PARA_SUSPENSAO) continue;
    p.amar = 0;
    p.suspSemAmarelos = suspensaoSemAmarelos(p) ?? 0;
    p.susp = 1;
    noticiarSuspensaoPorAmarelos(g, pid, clube, true);
  }
}

// Depois da data, cumpre as ausências anteriores e aplica os desfalques dos jogos.
export function aplicarDisponibilidade(games){
  const novos = games.filter(g => g.ev && !g.amarelos && !g.copa);
  if (games.length && !novos.length) return;
  const jogaram = new Set(novos.flatMap(g => [g.h, g.a]));
  for(const c of S.clubs)for(const p of c.players){
    if(p.inj>0)p.inj--;
    if(jogaram.has(c.id))encerrarSuspensaoPorAmarelos(p);
    const susp=suspensaoSemAmarelos(p);
    if(susp>0)suspenderPorVermelho(p,susp-1);
  }
  for(const g of novos){
    for(const e of g.ev){
      if(e.t==='lesao')P[e.pid].inj=e.rodadas;
      else if(e.t==='vermelho')suspenderPorVermelho(P[e.pid],SUSPENSAO_POR_EXPULSAO);
      else continue;
      addNews(noticiaDe(e),g[e.side]);
    }
    const data = g.uf ? `estadual|${g.uf}|${S.estaduais?.dia}` : S.round;
    g.amarelos = { rodada: S.round, chave: `${S.season}|${data}|${g.h}|${g.a}`, contagens: {} };
    conciliarAmarelos(g);
  }
}

// Uma troca manual pode tirar o jogador antes de um lance previsto.
export function cancelarDesfalque(g,e){
  if(e.t==='lesao')P[e.pid].inj=0;
  else suspenderPorVermelho(P[e.pid],0);
  for(const t of tecnicos().filter(t=>t.clubId===g[e.side])){
    // #383: no estadual (pré-temporada) a rodada não avança, e a notícia fica com r === S.round
    const i=t.news.findIndex(n=>(n.r===S.round-1||n.r===S.round)&&n.t===noticiaDe(e));
    if(i>=0)t.news.splice(i,1);
  }
}
// vagas detalhadas de cada formação, em ordem: goleiro, defesa, meio, ataque (mesmas contagens de FORMS)
export const SLOTS={
 '4-4-2':'GOL LD ZAG ZAG LE MEI MEI MEI MEI ATA ATA','4-3-3':'GOL LD ZAG ZAG LE MEI MEI MEI ATA ATA ATA',
 '3-5-2':'GOL ZAG ZAG ZAG MEI MEI MEI MEI MEI ATA ATA','4-5-1':'GOL LD ZAG ZAG LE MEI MEI MEI MEI MEI ATA',
 '5-3-2':'GOL LD ZAG ZAG ZAG LE MEI MEI MEI ATA ATA','3-4-3':'GOL ZAG ZAG ZAG MEI MEI MEI MEI ATA ATA ATA'
};
for(const k in SLOTS)SLOTS[k]=SLOTS[k].split(' ');
export const slotsDe=f=>SLOTS[f]||SLOTS['4-4-2'];
// cada vaga recebe quem perde menos ali (a posição do jogador, depois o mais próximo); o resto completa as vagas livres
export function reslot(ids,f,manterVagas=false,semGoleiro=false){
  const slots=slotsDe(f),left=ids.filter(id=>P[id]),out=slots.map(()=>null);
  slots.forEach((s,i)=>{
    if(semGoleiro&&s==='GOL')return;
    let best=-1,bp=9;
    left.forEach((id,k)=>{const pen=penalidadePosicao(P[id],s).pen;if(pen<bp||(pen===bp&&best>=0&&P[id].ovr>P[left[best]].ovr)){bp=pen;best=k}});
    if(best>=0)out[i]=left.splice(best,1)[0];
  });
  return manterVagas?out:out.filter(v=>v!=null);
}
// melhor time para a formação, já na ordem das vagas; evita indisponíveis
export function autoSlotXI(club,f){
  const slots=slotsDe(f||club.formation||'4-4-2');
  // #365: só disponíveis e goleiro só no gol; com menos de 11 disponíveis o time entra com menos (antes a rodada travava)
  const jog=club.players.filter(p=>!unavailable(p));
  const out=[];
  for(const s of slots){
    // #336: primeiro quem é da posição; de fora só se não houver ninguém dela (ex.: craque de atacante não vira lateral)
    const daPosicao=jog.some(p=>posDSigla(p)===s);
    let best=-1,bv=-1;
    jog.forEach((p,k)=>{if(daPosicao&&posDSigla(p)!==s||s!=='GOL'&&p.pos==='G')return;const v=ovrNaPosicao(p,s)*fatorEnergia(p);if(v>bv){bv=v;best=k}});
    if(best>=0)out.push(jog.splice(best,1)[0].id);
  }
  return out;
}
// regras da escalação do usuário
/** #288: ordem de cobrança de pênaltis do clube (ids do elenco, sem repetir); lista vazia volta à ordem automática. */
export function definirCobradores(ids, uc = userClub()) {
  const doClube = new Set(uc.players.map(p => p.id));
  const ok = [...new Set(Array.isArray(ids) ? ids : [])].filter(id => doClube.has(id)).slice(0, 32);
  if (ok.length) uc.cobradores = ok; else delete uc.cobradores;
  return { ok: true };
}
/** #294: cantos preferidos nas cobranças automáticas. Sem escolha, o canto é sorteado. */
export function definirCantos(mapa, uc = userClub()) {
  const doClube = new Set(uc.players.map(p => p.id));
  const entradas = mapa && typeof mapa === 'object' && !Array.isArray(mapa) ? Object.entries(mapa) : [];
  const ok = entradas.filter(([id, alvo]) => doClube.has(id) && typeof alvo === 'string' && Object.hasOwn(NOMES_ALVOS_PENALTI, alvo));
  if (ok.length) uc.cantos = Object.fromEntries(ok); else delete uc.cantos;
}
export function definirFormacao(f){const uc=userClub();uc.formation=f;uc.lineup=autoSlotXI(uc,f)} // nova formação: remonta o melhor time para as vagas novas
export function escalarMelhores(){const uc=userClub();uc.lineup=autoXI(uc)}
// troca dois jogadores (titular x titular ou titular x reserva). Devolve {erro} ou {ok}.
export function trocarNaEscalacao(a,b){
  const uc=userClub(),L=slotLayout(uc).map(s=>s.id).filter(Boolean),ia=L.indexOf(a),ib=L.indexOf(b);
  if(ia<0&&ib<0)return {erro:'Escolha ao menos um titular.'};
  if(ia>=0&&ib>=0){[L[ia],L[ib]]=[L[ib],L[ia]]}
  else{const out=ia>=0?a:b,inn=ia>=0?b:a,r=unavailable(P[inn]);
    if(r)return {erro:`${P[inn].name} está ${r} e não pode ser escalado.`};
    L[L.indexOf(out)]=inn}
  uc.lineup=L;return {ok:true};
}
// vaga i da formação = lineup[i] (com 11 titulares); com menos que isso, reposiciona automaticamente
export function slotLayout(uc,emCampo){
  const xi=emCampo||getXI(uc);
  const ids=(emCampo||xi.length===11)?xi:reslot(xi,uc.formation);
  return slotsDe(uc.formation).map((d,i)=>({g:POSD[d].grupo,d,id:ids[i]||null}));
}
