/* ================= tela do Clube como painel (#59) =================
   Responde "como estamos e o que preciso fazer agora": indicadores, próximo jogo, forma recente,
   o que pede atenção, mini classificação e notícias. */
import { faixaConf, receitaEsperada } from '../core/diretoria.mjs';
import { loanLeft, loanOf, loansIn, wageBill } from '../core/emprestimos.mjs';
import { slotLayout, unavailable } from '../core/escalacao.mjs';
import { DIVS, P, S, clubById, divOf, table, tec, userClub } from '../core/estado.mjs';
import { penalidadePosicao } from '../core/posicoes.mjs';
import { ESTILOS, MODOS, taticaUser } from '../core/taticas.mjs';
import { esc, money } from '../core/utils.mjs';
import { chip, stat } from './componentes.mjs';
import { icone } from './icones.mjs';
import { crest } from './partida.mjs';
import { zonas } from './telas.mjs';
import { noticiaVisivel } from './configuracoes.mjs';

const ord = n => n + 'º';
const meuJogo = (r, me) => S.fixtures[r] && S.fixtures[r].find(g => g.h === me || g.a === me);

/** Últimos jogos do clube (mais recente primeiro), com o resultado do ponto de vista dele. */
export function formaRecente(me, n = 5) {
  const out = [];
  for (let r = S.round - 1; r >= 0 && out.length < n; r--) {
    const g = meuJogo(r, me); if (!g || g.hg == null) continue;
    const casa = g.h === me, pro = casa ? g.hg : g.ag, contra = casa ? g.ag : g.hg;
    out.push({ g, r, res: pro > contra ? 'V' : pro < contra ? 'D' : 'E', pro, contra, adv: clubById(casa ? g.a : g.h) });
  }
  return out;
}

/** O que pede atenção agora, cada item com a ação ou a tela certa. */
export function alertas() {
  const uc = userClub(), me = uc.id, out = [];
  const lay = slotLayout(uc), xi = lay.map(s => s.id).filter(Boolean);
  const fora = xi.map(id => P[id]).filter(p => unavailable(p));
  if (xi.length < 11) out.push({ tipo: 'erro', titulo: 'Escalação incompleta', texto: `Só ${xi.length} titulares. Escale 11 antes de jogar.`, acao: 'go|escalacao', rotulo: 'Escalar' });
  if (fora.length) out.push({ tipo: 'erro', titulo: `${fora.length} titular${fora.length > 1 ? 'es' : ''} sem condição de jogo`, texto: fora.map(p => `${p.name}: ${unavailable(p)}`).join('; ') + '.', acao: 'go|escalacao', rotulo: 'Trocar' });
  const foraPos = lay.filter(s => s.id && !unavailable(P[s.id]) && penalidadePosicao(P[s.id], s.d).tipo === 'fora');
  if (foraPos.length) out.push({ tipo: 'aviso', titulo: `${foraPos.length} jogador${foraPos.length > 1 ? 'es' : ''} fora de posição`, texto: foraPos.map(s => `${P[s.id].name} na vaga de ${s.d}`).join(', ') + '.', acao: 'go|escalacao', rotulo: 'Ajustar' });
  for (const o of tec().offers.filter(o => P[o.pid] && P[o.pid].clubId === me)) {
    const p = P[o.pid];
    out.push({ tipo: 'aviso', titulo: `Proposta por ${p.name}`, texto: `${clubById(o.from).name} oferece ${money(o.amount)} (valor de mercado ${money(p.value)}). Vale até a rodada ${o.until + 1}.`,
      botoes: `<button class="btn sm" data-acao="acceptOffer|${o.id}">Aceitar</button><button class="btn sec sm" data-acao="rejectOffer|${o.id}">Recusar</button>` });
  }
  const fim = uc.players.filter(p => p.contrato === 1 && !loanOf(p.id));
  if (fim.length && S.fixtures.length - S.round <= 10) out.push({ tipo: 'info', titulo: `${fim.length} contrato${fim.length > 1 ? 's acabam' : ' acaba'} ao fim da temporada`, texto: `${fim.slice(0, 4).map(p => p.name).join(', ')}${fim.length > 4 ? ' e outros' : ''}. Sem renovar, saem de graça.`, acao: 'go|elenco', rotulo: 'Ver elenco' });
  for (const l of loansIn(uc).filter(l => loanLeft(l) <= 2))
    out.push({ tipo: 'info', titulo: `Empréstimo de ${P[l.pid].name} termina em ${loanLeft(l)} rodada${loanLeft(l) > 1 ? 's' : ''}`, texto: l.buy ? `Há opção de compra por ${money(l.buy)}.` : 'Ele volta ao clube de origem.', acao: 'go|elenco', rotulo: 'Ver elenco' });
  if (uc.balance < 0) out.push({ tipo: 'erro', titulo: 'Caixa no vermelho', texto: `Saldo de ${money(uc.balance)}. Venda jogadores ou reduza a folha.`, acao: 'go|financas', rotulo: 'Finanças' });
  return out;
}

function proximoJogo(uc, T) {
  const me = uc.id, g = S.round < S.fixtures.length ? meuJogo(S.round, me) : null;
  if (!g) return `<section class="card destaque"><h3>Próximo jogo</h3><p>Temporada encerrada. Use o botão no topo para fechar a temporada e começar a próxima.</p></section>`;
  const t = taticaUser(uc), posDe = id => { const i = T.findIndex(x => x.id === id); return S.round && i >= 0 ? ' · ' + ord(i + 1) : '' };
  const lado = c => `<div class="time">${crest(c, 'g')}<b>${esc(c.name)}</b><span class="muted">Força ${c.strength}${posDe(c.id)}</span></div>`;
  return `<section class="card destaque" aria-label="Próximo jogo">
    <div class="card-topo"><h3>Próximo jogo</h3><span class="pill">${g.h === me ? 'Em casa' : 'Fora de casa'} · Rodada ${S.round + 1}</span></div>
    <div class="confronto">${lado(clubById(g.h))}<span class="x" aria-hidden="true">X</span><span class="sr">contra</span>${lado(clubById(g.a))}</div>
    <div class="taticas">
      <div class="chips" role="group" aria-label="Estilo de jogo"><span class="muted">Estilo</span>${Object.entries(ESTILOS).map(([k, v]) => chip(v.nome, `tvPainel|estilo|${k}`, t.estilo === k)).join('')}</div>
      <div class="chips" role="group" aria-label="Modo"><span class="muted">Modo</span>${Object.entries(MODOS).map(([k, v]) => chip(v.nome, `tvPainel|modo|${k}`, t.modo === k)).join('')}</div>
      <div class="chips"><span class="muted">Formação</span><button type="button" class="chip on" data-acao="go|escalacao">${esc(uc.formation)} ${icone('seguir', { tam: 14 })}<span class="sr">mudar na Escalação</span></button></div>
    </div>
    <p class="muted dica">${esc(ESTILOS[t.estilo].desc)} ${esc(MODOS[t.modo].desc)} Dá para mudar também durante a partida.</p>
  </section>`;
}

function blocoForma(me) {
  const f = formaRecente(me);
  if (!f.length) return `<section class="card"><h3>Forma recente</h3><p class="muted">Ainda não houve jogos nesta temporada.</p></section>`;
  const n = k => f.filter(x => x.res === k).length, pl = (k, s, p) => `${n(k)} ${n(k) === 1 ? s : p}`;
  const NOME = { V: 'Vitória', E: 'Empate', D: 'Derrota' };
  return `<section class="card"><h3>Forma recente</h3>
    <ol class="forma" aria-label="Últimos jogos, do mais antigo ao mais recente">${f.slice().reverse().map(x => `<li class="bola-forma ${x.res}" title="${NOME[x.res]} ${x.pro} x ${x.contra} contra ${esc(x.adv.name)} (rodada ${x.r + 1})"><span aria-hidden="true">${x.res}</span><span class="sr">${NOME[x.res]} por ${x.pro} a ${x.contra} contra ${esc(x.adv.name)}</span></li>`).join('')}</ol>
    <p class="muted">${pl('V', 'vitória', 'vitórias')}, ${pl('E', 'empate', 'empates')} e ${pl('D', 'derrota', 'derrotas')} nos últimos ${f.length} jogos.</p></section>`;
}

function blocoAlertas() {
  const a = alertas();
  return `<section class="card"><h3>Pede atenção</h3>${a.length ? `<ul class="alertas">${a.map(x => `<li class="alerta ${x.tipo}">
    ${icone(x.tipo === 'erro' ? 'alerta' : x.tipo === 'aviso' ? 'alerta' : 'info', { rotulo: x.tipo === 'erro' ? 'Problema' : x.tipo === 'aviso' ? 'Aviso' : 'Informação' })}
    <div class="alerta-texto"><b>${esc(x.titulo)}</b><span class="muted">${esc(x.texto)}</span></div>
    <div class="alerta-acoes">${x.botoes || `<button class="btn sec sm" data-acao="${x.acao}">${esc(x.rotulo)}</button>`}</div></li>`).join('')}</ul>`
    : `<p class="muted">${icone('ok')} Nada pendente. O time está pronto para a rodada.</p>`}</section>`;
}

function miniTabela(uc) {
  const d = divOf(uc), T = table(d), i = T.findIndex(t => t.id === uc.id), { top, bottom } = zonas(d);
  const ini = Math.max(0, Math.min(i - 3, T.length - 7)), linhas = T.slice(ini, ini + 7);
  const zona = k => (k < top ? 'zona-lib' : bottom && k >= T.length - bottom ? 'zona-z4' : '');
  return `<section class="card"><div class="card-topo"><h3>Classificação</h3><span class="muted">${DIVS[d]}</span></div>
    <div class="tw"><table><caption class="sr">Classificação perto do seu clube</caption>
    <thead><tr><th scope="col">#</th><th scope="col">Clube</th><th scope="col" class="n">J</th><th scope="col" class="n">SG</th><th scope="col" class="n">Pts</th></tr></thead>
    <tbody>${linhas.map((t, k) => { const c = clubById(t.id), pos = ini + k; return `<tr class="${t.id === uc.id ? 'me' : ''}"><td class="${zona(pos)}">${pos + 1}</td><td><span class="club">${crest(c)} ${esc(c.name)}</span></td><td class="n">${t.J}</td><td class="n">${t.GP - t.GC}</td><td class="n"><b>${t.Pts}</b></td></tr>` }).join('')}</tbody></table></div>
    <div class="legenda"><span><i class="zona-cor lib"></i>${zonas(d).nomeTop}</span>${bottom ? `<span><i class="zona-cor z4"></i>Rebaixamento (Z${bottom})</span>` : ''}</div>
    <button class="btn fantasma sm" data-acao="go|tabela">Ver tabela completa</button></section>`;
}

export function vClube() {
  const uc = userClub(), me = uc.id, t = tec(), T = table(divOf(uc)), row = T.find(x => x.id === me), pos = T.findIndex(x => x.id === me) + 1;
  const c = t.conf, corConf = c >= 55 ? 'var(--verde)' : c >= 30 ? 'var(--ouro)' : 'var(--perigo)';
  const fat = t.confFat && t.confFat.length ? 'Última rodada: ' + t.confFat.map(f => `${esc(f.t)} <b class="${f.v > 0 ? 'ok' : 'bad'}">${f.v > 0 ? '+' : ''}${f.v}</b>`).join(' · ') : 'Muda a cada rodada com resultados e posição.';
  const indicadores = `<section class="stats" aria-label="Indicadores">
    ${stat({ rotulo: 'Posição', valor: S.round ? ord(pos) : '—', unid: S.round ? `${row.Pts} pontos` : '', sub: S.round ? `${row.V}V ${row.E}E ${row.D}D · saldo ${row.GP - row.GC > 0 ? '+' : ''}${row.GP - row.GC}` : 'A temporada ainda não começou.' })}
    ${stat({ rotulo: 'Caixa', valor: money(uc.balance), cor: uc.balance < 0 ? 'var(--perigo)' : '', sub: `Folha: ${money(wageBill(uc))} por rodada · receita esperada: ${money(receitaEsperada(uc))}` })}
    ${stat({ rotulo: 'Diretoria', valor: Math.round(c), unid: `/ 100 · ${faixaConf(c)}`, cor: corConf, pct: c, corBarra: corConf, sub: fat })}
    ${stat({ rotulo: 'Meta da temporada', valor: ord(t.meta.alvo), unid: 'ou melhor', cor: 'var(--ouro)', sub: `${esc(t.meta.texto)} · fechar com caixa positivo` })}
  </section>`;
  const ch = h => h.champs || { A: h.champ, ...(h.champB ? { B: h.champB } : {}) };
  const hd = [...new Set(S.history.flatMap(h => Object.keys(ch(h))))].sort(), many = hd.length > 1;
  const historico = S.history.length ? `<section class="card tw"><h3>Histórico</h3><table><thead><tr><th>Temporada</th>${hd.map(x => `<th>Campeão${many ? ' ' + DIVS[x] : ''}</th>`).join('')}${S.history.some(h => h.copa) ? '<th>Copa do Brasil</th>' : ''}<th>Sua posição</th><th>Artilheiro</th></tr></thead><tbody>${S.history.map(h => `<tr><td>${h.season}</td>${hd.map(x => `<td>${esc(ch(h)[x] || '-')}</td>`).join('')}${S.history.some(x => x.copa) ? `<td>${esc(h.copa || '-')}</td>` : ''}<td>${h.me}º${many && h.div ? ' (' + DIVS[h.div] + ')' : ''}</td><td>${esc(h.scorer)}</td></tr>`).join('')}</tbody></table></section>` : '';
  return `${indicadores}
  <div class="painel">
    <div class="painel-principal">${proximoJogo(uc, T)}${blocoForma(me)}${blocoAlertas()}</div>
    <div class="painel-lateral">${miniTabela(uc)}
      <section class="card"><h3>Notícias</h3><ul class="noticias">${t.news.filter(noticiaVisivel).slice(0, 10).map(n => `<li><span class="muted num">R${(n.r ?? 0) + 1}</span><span>${esc(n.t)}</span></li>`).join('') || '<li class="muted">Sem notícias ainda.</li>'}</ul></section>
    </div>
  </div>${historico}
  <div class="row inicio-rodape"><button class="btn fantasma" data-acao="pedirDemissaoUI">Pedir demissão</button></div>`;
}
