/* ================= carreira na tela (#37): propostas de clubes depois de sair do clube ================= */
import { detalheProposta, escolherClube, pedirDemissao, recusarClubes } from '../core/carreira.mjs';
import { DIVS, clubDo, divOf, tec, tecnicos } from '../core/estado.mjs';
import { esc } from '../core/utils.mjs';
import { avisar, confirmar } from './avisos.mjs';
import { save, ui } from './estado.mjs';
import { mercadoLiga, recusarClubesLiga } from './ligajogo.mjs';
import { confirmarVez, playRound } from './motor.mjs';
import { crest } from './partida.mjs';
import { go } from './telas.mjs';

/** O técnico saiu do clube (demitido ou a pedido): vai para as propostas. */
export function demissao() { go('carreira') }

export function vCarreira() {
  const t = tec(), antigo = esc(clubDo(t).name);
  if (!t.demitido) return `<section class="card"><p>Você é o técnico do ${antigo}.</p></section>`;
  const ids = t.propostasClube || [], n = ids.length;
  const linha = id => { const { c, pos, meta } = detalheProposta(id);
    return `<li class="proposta-clube">${crest(c, 'm')}<div class="cresce"><b>${esc(c.name)}</b> <span class="muted">· ${DIVS[divOf(c)]} · ${pos}º lugar</span><br><span class="texto2">Meta da diretoria: ${esc(meta.texto)}</span></div>
      <button class="btn" data-acao="escolherClubeNovo|${esc(id)}" aria-label="Assumir o ${esc(c.name)}">Assumir</button></li>` };
  return `<section class="card"><h2>${t.saida === 'pediu' ? `Você deixou o ${antigo}` : `Você foi demitido do ${antigo}`}</h2>
    <p class="muted">${t.recusouClubes ? 'Aguardando a rodada para receber novas propostas.' : n ? 'Escolha onde continuar a carreira ou avance para avaliar novas propostas.' : 'Nenhum clube disponível nesta rodada.'}</p>
    <ul class="propostas-clube">${ids.map(linha).join('')}</ul>
    <button class="btn sec" data-acao="recusarClubesUI"${t.recusouClubes ? ' disabled' : ''}>${n ? 'Recusar todas' : 'Aguardar próxima rodada'}</button></section>`;
}
export function recusarClubesUI() {
  if (ui.liga) return recusarClubesLiga();
  const r = recusarClubes();
  if (r.erro) { avisar(r.erro, 'erro'); return }
  save();
  if (tecnicos().length > 1) confirmarVez(); else playRound();
}
export async function escolherClubeNovo(id) {
  if (ui.liga) { await mercadoLiga({ tipo: 'escolherClube', clubeId: id }); if (!tec().demitido) go('clube'); return }
  const r = escolherClube(id); if (r.erro) { avisar(r.erro, 'erro'); return }
  save(); go('clube'); avisar(r.msg, 'ok');
}
export function pedirDemissaoUI() {
  confirmar({ titulo: 'Pedir demissão?', texto: `Você deixa o ${clubDo(tec()).name} e escolhe entre os clubes interessados. Não dá para voltar atrás.`, ok: 'Pedir demissão', perigo: true }, async () => {
    if (ui.liga) { await mercadoLiga({ tipo: 'pedirDemissao' }); if (tec().demitido) go('carreira'); return }
    const r = pedirDemissao(); if (r.erro) { avisar(r.erro, 'erro'); return }
    save(); go('carreira');
  });
}
