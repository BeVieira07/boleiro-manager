import { energiaDe } from '../core/energia.mjs';
import { SUSPENSAO_POR_EXPULSAO } from '../core/escalacao.mjs';
import { aplicarLanceAoElenco, escalacaoNoMinuto } from '../core/lances.mjs';
import { banco, elencoParaTrocas, MAX_TROCAS, prepararTroca, trocasDe } from '../core/substituicoes.mjs';
import { ESTILOS, MODOS, taticaUser } from '../core/taticas.mjs';
import { esc, FORMS } from '../core/utils.mjs';
import { abrirCamada, fecharCamada } from './avisos.mjs';
import { chip, dicaTatica, ovrChip } from './componentes.mjs';
import { campoHtml } from './escalacao.mjs';
import { ui } from './estado.mjs';
import { icone } from './icones.mjs';
import { posTag } from './posicoes.mjs';

const el = id => document.getElementById(id);
const OPCOES = { estilo: ESTILOS, modo: MODOS, form: FORMS };
const telaCompacta = globalThis.matchMedia?.('(max-width: 600px)');
const emCampo = elenco => elenco.xi.filter(Boolean).length;
const limite = () => `Você já fez as ${MAX_TROCAS} substituições do jogo.`;

export function novoAvisoExpulsao(v, vermelhos) {
  const lado = vermelhos[0].side, min = v.min, elenco = elencoParaTrocas(v.g, min);
  const antes = escalacaoNoMinuto(v.g, lado, min - 1)?.xi ?? v.clube.lineup;
  return {
    min, lado, elenco, form: elenco.form, total: emCampo(elenco), tatica: taticaUser(v.clube), sel: null,
    expulsos: vermelhos.map(e => ({ nome: e.name, segundo: e.segundo, vaga: antes.indexOf(e.pid) })),
    trocas: trocasDe(v.g, v.clube.id, min), rascunho: [],
    leitura: false, msg: '', erro: false
  };
}

function opcao(campo, valor, nome, ativo, leitura) {
  if (leitura) return ativo ? `<span class="pill">${esc(nome)}</span>` : '';
  return chip(esc(nome), `avExpTatica|${campo}|${valor}`, ativo);
}

function htmlTaticas(a) {
  const grupos = [['Estilo', 'estilo'], ['Modo', 'modo'], ['Formação', 'form']];
  const ajustou = a.tatica.estilo !== 'equilibrado' || a.tatica.modo !== 'equilibrado';
  return `<div class="exp-grupos">${grupos.map(([rot, campo]) => `<div role="group" aria-label="${rot}" class="exp-grupo">
    <span>${rot}</span><div class="exp-opcoes">${Object.entries(OPCOES[campo]).map(([k, item]) =>
      opcao(campo, k, item.nome || k, (campo === 'form' ? a.form : a.tatica[campo]) === k, a.leitura)).join('')}</div></div>`).join('')}</div>
    <p>${ajustou ? dicaTatica(a.tatica) : `Com ${a.total}, um modo defensivo ou o contra-ataque seguram melhor o empate.`}</p>`;
}

function vagasExpulsas(a, elenco) {
  const vagas = new Map(), mesmosSlots = a.form === a.elenco.form;
  const expulsos = a.expulsos.filter(e => e.vaga !== 0 || !elenco.xi[0]);
  for (const e of expulsos) {
    if (mesmosSlots && e.vaga >= 0 && !elenco.xi[e.vaga]) vagas.set(e.vaga, e.nome);
  }
  const restantes = expulsos.filter(e => !(mesmosSlots && vagas.has(e.vaga)));
  for (const e of restantes.sort((x, y) => x.vaga - y.vaga)) {
    const i = elenco.xi.findIndex((id, k) => !id && !vagas.has(k) && (k !== 0 || e.vaga === 0));
    if (i >= 0) vagas.set(i, e.nome);
  }
  return vagas;
}

function htmlCampo(v, a) {
  const elenco = { ...a.elenco };
  if (elenco.form !== a.form) aplicarLanceAoElenco(elenco, { t: 'formacao', form: a.form });
  return `<div class="exp-secao-topo"><h3>Em campo · ${esc(a.form)}</h3><strong class="exp-contagem">${emCampo(elenco)} jogadores</strong></div>
    ${campoHtml({ ...v.clube, formation: a.form }, { mini: true, acao: 'avExpSair', sel: a.sel, emCampo: elenco.xi,
      semEnergia: true, somenteLeitura: a.leitura, expulsos: vagasExpulsas(a, elenco) })}`;
}

function htmlBanco(v, a) {
  const trocas = [...a.trocas, ...a.rascunho];
  const reservas = banco(v.g, a.min, a.elenco, trocas)
    .sort((x, y) => Number(!!x.motivo) - Number(!!y.motivo) || y.p.ovr - x.p.ovr);
  const sai = v.clube.players.find(p => p.id === a.sel);
  const feitas = sai ? '<span class="exp-banco-padrao"> feitas</span>' : ' feitas';
  return `<div class="exp-secao-topo${sai ? ' exp-escolhendo' : ''}">
    <h3><span class="exp-banco-padrao">Substituições</span>${sai ? `<span class="exp-banco-escolha">Quem entra no lugar de ${esc(sai.name)}?</span>` : ''}</h3>
    <span><b>${trocas.length}</b> de ${MAX_TROCAS}${feitas}</span></div>
    <ol class="exp-passos">
      <li${a.sel ? '' : ' aria-current="step"'}><b>1</b> Toque em quem sai, no campo</li>
      <li${a.sel ? ' aria-current="step"' : ''}><b>2</b> Escolha quem entra</li>
    </ol>
    <ul class="exp-reservas" aria-label="Banco de reservas">${reservas.map(({ p, motivo }) => {
      const nota = p.pos === 'G' && !a.elenco.goleiroExpulso ? 'só por goleiro' : '';
      const energia = `Energia ${Math.round(energiaDe(p))}`;
      return `<li><button type="button" data-acao="avExpEntrar|${esc(p.id)}" class="exp-reserva">${posTag(p)}
        <span class="exp-nome">${esc(p.name)}<small><span class="exp-energia">${energia}${nota ? ' · ' : ''}</span>${nota}</small></span>
        ${motivo ? `<small class="exp-indisponivel">${esc(motivo)}</small>` : ''}${ovrChip(p.ovr)}</button></li>`;
    }).join('')}</ul>`;
}

function htmlTrocasAplicadas(a) {
  return `<div class="exp-secao-topo"><h3>Substituições</h3><span><b>${a.trocas.length}</b> de ${MAX_TROCAS} feitas</span></div>
    ${a.aplicadas.length ? `<ul class="exp-aplicadas">${a.aplicadas.map(t => `<li>${esc(t.name)}</li>`).join('')}</ul>`
      : '<p>Nenhuma substituição feita na janela.</p>'}`;
}

function htmlJanela(v, a) {
  const susp = SUSPENSAO_POR_EXPULSAO, jogos = susp === 1 ? 'jogo' : 'jogos';
  const clube = esc(v.clube.name);
  return `<section class="exp-janela" role="dialog" aria-modal="true" aria-labelledby="exp-titulo" aria-describedby="exp-descricao">
    <header class="exp-cab">
      <span class="exp-cartao" aria-hidden="true"></span>
      <div>
        <div class="exp-titulo"><h2 id="exp-titulo" tabindex="-1" data-principal>Expulso</h2><span>${a.min}'</span></div>
        <div id="exp-descricao">${a.expulsos.map(e => `<p><b>${esc(e.nome)}</b> ${e.segundo ? 'levou o segundo amarelo.' : 'foi expulso.'}
          O ${clube} joga com ${a.total} até o fim, e ele cumpre ${susp} ${jogos} de suspensão.</p>`).join('')}</div>
      </div>
      ${a.leitura ? '' : `<span class="exp-selo">${icone('pausa', { tam: 14 })} Jogo pausado</span>`}
    </header>
    <div class="exp-conteudo">
      <details class="exp-ajustes">
        <summary>Tática</summary>
        <section class="exp-tatica" id="exp-tatica" aria-label="Tática">${htmlTaticas(a)}</section>
      </details>
      <div class="exp-grade">
        <section id="exp-campo" aria-label="Em campo">${htmlCampo(v, a)}</section>
        <section aria-label="Substituições">
          <div id="exp-banco">${a.leitura ? htmlTrocasAplicadas(a) : htmlBanco(v, a)}</div>
          ${a.leitura ? '' : `<p id="exp-mensagem" class="exp-mensagem" aria-live="polite">${esc(a.msg)}</p>`}
        </section>
      </div>
    </div>
    <footer class="exp-rodape">
      ${a.leitura ? '<button type="button" class="btn sec" data-acao="avExpFechar">Fechar aviso</button>' : `
        <p>As mudanças valem a partir do minuto ${a.min + 1}. A partida só continua quando você fechar esta janela.</p>
        <button type="button" class="btn fantasma" data-acao="avExpFechar">Voltar sem mexer</button>
        <button type="button" class="btn" data-acao="avExpConfirmar">${icone('play', { tam: 16 })}Voltar ao jogo</button>`}
    </footer>
  </section>`;
}

function ajustarJanelaExpulsao(caixa) {
  if (!caixa || caixa.hidden) return;
  const compacta = telaCompacta?.matches;
  caixa.querySelector('.exp-ajustes').open = !compacta;
  const principal = caixa.querySelector('[data-acao="avExpConfirmar"]');
  if (!principal) return;
  // Mantém a ordem do Tab igual à ordem visual nas duas larguras.
  const voltar = principal.parentElement.querySelector('[data-acao="avExpFechar"]');
  const focado = document.activeElement === voltar;
  if (compacta) principal.after(voltar);
  else principal.before(voltar);
  if (focado) voltar.focus({ preventScroll: true });
}

telaCompacta?.addEventListener('change', () => ajustarJanelaExpulsao(el('av-expulsao')));

export function mostrarJanelaExpulsao(v, aoFechar) {
  const caixa = el('av-expulsao');
  if (!caixa) return;
  caixa.innerHTML = htmlJanela(v, v.expulsao);
  caixa.hidden = false;
  if (caixa.isConnected !== true) return;
  ajustarJanelaExpulsao(caixa);
  abrirCamada(caixa, aoFechar);
  document.querySelectorAll('.casca, .pular').forEach(n => { n.inert = true });
}

export function ocultarJanelaExpulsao() {
  const caixa = el('av-expulsao');
  if (!caixa || caixa.hidden) return;
  caixa.hidden = true;
  caixa.innerHTML = '';
  if (caixa.isConnected !== true) return;
  document.querySelectorAll('.casca, .pular').forEach(n => { n.inert = false });
  fecharCamada(caixa);
  if (document.activeElement === document.body) el('lpausa')?.focus({ preventScroll: true });
}

function atualizar(v, a, regioes, foco) {
  const caixa = el('av-expulsao');
  if (caixa?.isConnected !== true) {
    if (caixa) caixa.innerHTML = htmlJanela(v, a);
    return;
  }
  const ativo = document.activeElement, acao = foco ?? ativo?.dataset?.acao;
  const rolarAoFocar = telaCompacta?.matches && ativo?.matches(':focus-visible');
  const lista = caixa.querySelector('.exp-reservas'), scroll = lista?.scrollTop ?? 0;
  for (const [id, html] of regioes) el(id).innerHTML = html;
  if (lista && !lista.isConnected) caixa.querySelector('.exp-reservas').scrollTop = scroll;
  if (ativo && !ativo.isConnected) {
    const destino = [...caixa.querySelectorAll('[data-acao]')].find(n => n.dataset.acao === acao) ?? el('exp-titulo');
    destino.focus({ preventScroll: !rolarAoFocar });
  }
  const mensagem = el('exp-mensagem');
  mensagem.classList.toggle('exp-erro', a.erro);
  mensagem.textContent = a.msg;
}

function avisarRascunho(v, a, msg) {
  a.msg = msg;
  a.erro = true;
  atualizar(v, a, []);
}

function rascunhoAberto(v) {
  return v?.expulsao && !v.expulsao.leitura && ui.view === 'aovivo' ? v.expulsao : null;
}

export function avExpSair(id) {
  const v = ui.vivo, a = rascunhoAberto(v);
  if (!a?.elenco.xi.includes(id)) return;
  a.sel = a.sel === id ? null : id;
  a.erro = a.trocas.length + a.rascunho.length >= MAX_TROCAS;
  a.msg = a.erro ? limite() : '';
  atualizar(v, a, [['exp-campo', htmlCampo(v, a)], ['exp-banco', htmlBanco(v, a)]]);
}

export function avExpEntrar(id) {
  const v = ui.vivo, a = rascunhoAberto(v);
  if (!a) return;
  const trocas = [...a.trocas, ...a.rascunho];
  if (trocas.length >= MAX_TROCAS) { avisarRascunho(v, a, limite()); return }
  if (!a.sel) { avisarRascunho(v, a, 'Primeiro toque em quem sai, no campo.'); return }
  const r = prepararTroca(v.g, a.min, a.sel, id, a.elenco, trocas);
  if (r.erro) { avisarRascunho(v, a, r.erro); return }
  aplicarLanceAoElenco(a.elenco, r.lance);
  a.rascunho.push(r.lance);
  a.sel = null;
  a.erro = false;
  a.msg = `${r.lance.name}. Troca no rascunho.`;
  atualizar(v, a, [['exp-campo', htmlCampo(v, a)], ['exp-banco', htmlBanco(v, a)]], `avExpSair|${id}`);
}

export function avExpTatica(campo, valor) {
  const v = ui.vivo, a = rascunhoAberto(v);
  if (!a || !Object.hasOwn(OPCOES, campo) || !Object.hasOwn(OPCOES[campo], valor)) return;
  if (campo === 'form') {
    a.form = valor;
    a.sel = null;
  } else a.tatica[campo] = valor;
  atualizar(v, a, [['exp-tatica', htmlTaticas(a)], ['exp-campo', htmlCampo(v, a)], ['exp-banco', htmlBanco(v, a)]]);
}

export function validarRascunhoExpulsao(v, a) {
  const elenco = elencoParaTrocas(v.g, a.min), feitas = trocasDe(v.g, v.clube.id, a.min);
  for (const { sai, entra } of a.rascunho) {
    const r = prepararTroca(v.g, a.min, sai, entra, elenco, feitas);
    if (r.erro) { avisarRascunho(v, a, r.erro); return false }
    aplicarLanceAoElenco(elenco, r.lance);
    feitas.push(r.lance);
  }
  return true;
}

export function resumoExpulsao(v) {
  const aviso = v.avisoExpulsao;
  return v.fim || !aviso ? '' : `<div class="exp-retomada">${icone('cartao', { tam: 18 })}
    <span role="status">${esc(aviso.resumo)}</span><button type="button" class="btn fantasma" data-acao="avExpReabrir">Ver o aviso de novo</button></div>`;
}
