import { minutoDoTempo, placarNoMinuto } from '../../core/aovivo.mjs';
import { energiaDe } from '../../core/energia.mjs';
import { clubById } from '../../core/estado.mjs';
import { SUSPENSAO_POR_EXPULSAO, slotsDe } from '../../core/escalacao.mjs';
import { aplicarLanceAoElenco } from '../../core/lances.mjs';
import { banco, elencoParaTrocas, MAX_TROCAS, prepararFormacao, prepararPosicao, prepararTroca, trocasDe } from '../../core/substituicoes.mjs';
import { ESTILOS, MODOS, taticaUser } from '../../core/taticas.mjs';
import { esc, FORMS } from '../../core/utils.mjs';
import { abrirCamada, fecharCamada } from '../avisos.mjs';
import { chip, dicaTatica, ovrChip } from '../componentes.mjs';
import { campoHtml } from '../clube/escalacao.mjs';
import { ui } from '../estado.mjs';
import { icone } from '../icones.mjs';
import { posTag } from '../clube/posicoes.mjs';

const el = id => document.getElementById(id);
const OPCOES = { estilo: ESTILOS, modo: MODOS, form: FORMS };
const telaCompacta = globalThis.matchMedia?.('(max-width: 799px)'); // #314: folha de baixo no celular, como o resto do jogo
const emCampo = elenco => elenco.xi.filter(Boolean).length;
const limite = () => `Você já fez as ${MAX_TROCAS} substituições do jogo.`;

function novaJanela(v, tipo, novos) {
  const min = v.min, elenco = elencoParaTrocas(v.g, min);
  return {
    tipo, min, elenco, form: elenco.form, total: emCampo(elenco), tatica: taticaUser(v.clube), sel: null,
    novos, trocas: trocasDe(v.g, v.clube.id, min), rascunho: [],
    leitura: false, msg: '', erro: false
  };
}
export const novoAvisoExpulsao = (v, vermelhos) =>
  novaJanela(v, 'expulsao', vermelhos.map(e => ({ nome: e.name, segundo: e.segundo })));
/** #314: a mesma janela aberta pelo botão Pausar: tática, formação e trocas com o relógio parado. */
export const novaPausa = v => novaJanela(v, 'pausa', []);

function opcao(campo, valor, nome, ativo, leitura) {
  if (leitura) return ativo ? `<span class="pill">${esc(nome)}</span>` : '';
  return chip(esc(nome), `avExpTatica|${campo}|${valor}`, ativo);
}

function htmlTaticas(a) {
  const grupos = [['Estilo', 'estilo'], ['Modo', 'modo'], ['Formação', 'form']];
  const ajustou = a.tatica.estilo !== 'equilibrado' || a.tatica.modo !== 'equilibrado';
  return `<div class="exp-grupos">${grupos.map(([rot, campo]) => `<div class="exp-grupo">
    <span aria-hidden="true">${rot}</span><div class="exp-opcoes" role="group" aria-label="${rot}" tabindex="0">${Object.entries(OPCOES[campo]).map(([k, item]) =>
      opcao(campo, k, item.nome || k, (campo === 'form' ? a.form : a.tatica[campo]) === k, a.leitura)).join('')}</div></div>`).join('')}</div>
    <p>${ajustou || !a.elenco.expulsos.size ? dicaTatica(a.tatica) : `Com ${a.total}, um modo defensivo ou o contra-ataque seguram melhor o empate.`}</p>`;
}

const formacaoPendente = a => a.form === a.elenco.form ? null : { t: 'formacao', form: a.form };
const trocasNoRascunho = a => [...a.trocas, ...a.rascunho.filter(e => e.t === 'troca')];

function elencoExibido(a) {
  const formacao = formacaoPendente(a);
  if (!formacao) return a.elenco;
  const elenco = { ...a.elenco };
  aplicarLanceAoElenco(elenco, formacao);
  return elenco;
}

function htmlCampo(v, a) {
  const elenco = elencoExibido(a);
  const mover = a.sel && elenco.xi.indexOf(a.sel) > 0 ? v.clube.players.find(p => p.id === a.sel)?.name : null;
  return `<div class="exp-secao-topo"><h3>Em campo · ${esc(a.form)}</h3><strong class="exp-contagem${elenco.expulsos.size ? '' : ' exp-completo'}">${emCampo(elenco)} jogadores</strong></div>
    ${campoHtml({ ...v.clube, formation: a.form }, { mini: true, acao: 'avExpSair', sel: a.sel, emCampo: elenco.xi,
      semEnergia: true, somenteLeitura: a.leitura, expulsos: elenco.expulsos, mover, vagaAcao: 'avExpVaga', vagaSel: a.vagaSel })}`;
}

function htmlBanco(v, a) {
  const trocas = trocasNoRascunho(a);
  const reservas = banco(v.g, a.min, a.elenco, trocas)
    .sort((x, y) => Number(!!x.motivo) - Number(!!y.motivo) || y.p.ovr - x.p.ovr);
  const sai = v.clube.players.find(p => p.id === a.sel);
  const feitas = sai ? '<span class="exp-banco-padrao"> feitas</span>' : ' feitas';
  return `<div class="exp-secao-topo${sai ? ' exp-escolhendo' : ''}">
    <h3><span class="exp-banco-padrao">Substituições</span>${sai ? `<span class="exp-banco-escolha">Quem entra no lugar de ${esc(sai.name)}?</span>` : ''}</h3>
    <span><b>${trocas.length}</b> de ${MAX_TROCAS}${feitas}</span></div>
    <ol class="exp-passos">
      <li${a.sel ? '' : ' aria-current="step"'}><b>1</b> Toque em um jogador no campo</li>
      <li${a.sel ? ' aria-current="step"' : ''}><b>2</b> Escolha um reserva ou toque em outra vaga para mudar de posição</li>
    </ol>
    <ul class="exp-reservas" aria-label="Banco de reservas">${reservas.map(({ p, motivo }) => {
      const nota = p.pos === 'G' && !a.elenco.goleiroExpulso ? 'só por goleiro' : '';
      const energia = `Energia ${Math.round(energiaDe(p))}`;
      return `<li><button type="button" data-acao="avExpEntrar|${esc(p.id)}" class="exp-reserva">${posTag(p)}
        <span class="exp-nome">${esc(p.name)}<small><span class="exp-energia">${energia}${nota ? ' · ' : ''}</span>${nota}</small></span>
        ${motivo ? `<small class="exp-indisponivel">${esc(motivo)}</small>` : ''}${ovrChip(p.ovr)}</button></li>`;
    }).join('')}</ul>`;
}

function htmlAlteracoesAplicadas(a) {
  const moveu = a.aplicadas.some(e => e.t === 'posicao');
  return `<div class="exp-secao-topo"><h3>${moveu ? 'Alterações em campo' : 'Substituições'}</h3><span><b>${a.trocas.length}</b> de ${MAX_TROCAS} feitas</span></div>
    ${a.aplicadas.length ? `<ul class="exp-aplicadas">${a.aplicadas.map(t => `<li>${esc(t.name)}</li>`).join('')}</ul>`
      : '<p>Nenhuma substituição feita na janela.</p>'}`;
}

function htmlCabPausa(v, a) {
  const t = minutoDoTempo(a.min), p = placarNoMinuto(v.g, a.min), sigla = id => esc(clubById(id)?.short || clubById(id)?.name || '');
  return `<header class="exp-cab exp-pausa">
      <span class="exp-pausa-icone" aria-hidden="true">${icone('pausa', { tam: 22 })}</span>
      <div>
        <div class="exp-titulo"><h2 id="exp-titulo" tabindex="-1" data-principal>Pausado</h2><span>${t.m}' · ${t.tempo}º tempo</span>
          <span class="exp-placar">· ${sigla(v.g.h)} ${p.h} x ${p.a} ${sigla(v.g.a)}</span></div>
        <div id="exp-descricao"><p>Mexa no time com calma: o relógio só volta a correr quando você continuar.</p></div>
      </div>
    </header>`;
}
function htmlCabExpulsao(v, a) {
  const susp = SUSPENSAO_POR_EXPULSAO, jogos = susp === 1 ? 'jogo' : 'jogos';
  const clube = esc(v.clube.name);
  return `<header class="exp-cab">
      <span class="exp-cartao" aria-hidden="true"></span>
      <div>
        <div class="exp-titulo"><h2 id="exp-titulo" tabindex="-1" data-principal>Expulso</h2><span>${a.min}'</span></div>
        <div id="exp-descricao">${a.novos.map(e => `<p><b>${esc(e.nome)}</b> ${e.segundo ? 'levou o segundo amarelo.' : 'foi expulso.'}
          O ${clube} joga com ${a.total} até o fim, e ele cumpre ${susp} ${jogos} de suspensão.</p>`).join('')}</div>
      </div>
      ${a.leitura ? '' : `<span class="exp-selo">${icone('pausa', { tam: 14 })} Jogo pausado</span>`}
    </header>`;
}
function htmlRodape(a) {
  if (a.leitura) return '<button type="button" class="btn sec" data-acao="avExpFechar">Fechar aviso</button>';
  if (a.tipo === 'pausa') return `
        <p>As mudanças valem a partir do minuto ${a.min + 1}.</p>
        <button type="button" class="btn sec" data-acao="avExpPular" data-secundario>${icone('avancar', { tam: 16 })}Pular para o fim</button>
        <button type="button" class="btn" data-acao="avExpConfirmar">${icone('play', { tam: 16 })}Continuar</button>`;
  return `
        <p>As mudanças valem a partir do minuto ${a.min + 1}. A partida só continua quando você fechar esta janela.</p>
        <button type="button" class="btn fantasma" data-acao="avExpFechar" data-secundario>Voltar sem mexer</button>
        <button type="button" class="btn" data-acao="avExpConfirmar">${icone('play', { tam: 16 })}Voltar ao jogo</button>`;
}
function htmlJanela(v, a) {
  return `<section class="exp-janela" role="dialog" aria-modal="true" aria-labelledby="exp-titulo" aria-describedby="exp-descricao">
    ${a.tipo === 'pausa' ? htmlCabPausa(v, a) : htmlCabExpulsao(v, a)}
    <div class="exp-conteudo">
      <section class="exp-tatica" id="exp-tatica" aria-label="Tática">${htmlTaticas(a)}</section>
      <div class="exp-grade">
        <section id="exp-campo" aria-label="Em campo">${htmlCampo(v, a)}</section>
        <section aria-label="Substituições e posições">
          <div id="exp-banco">${a.leitura ? htmlAlteracoesAplicadas(a) : htmlBanco(v, a)}</div>
          ${a.leitura ? '' : `<p id="exp-mensagem" class="exp-mensagem" aria-live="polite">${esc(a.msg)}</p>`}
        </section>
      </div>
    </div>
    <footer class="exp-rodape">${htmlRodape(a)}
    </footer>
  </section>`;
}

function ajustarJanelaExpulsao(caixa) {
  if (!caixa || caixa.hidden) return;
  const compacta = telaCompacta?.matches;
  const principal = caixa.querySelector('[data-acao="avExpConfirmar"]');
  if (!principal) return;
  // Mantém a ordem do Tab igual à ordem visual nas duas larguras.
  const voltar = principal.parentElement.querySelector('[data-secundario]');
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

function atualizarCampoEBanco(v, a, foco) {
  atualizar(v, a, [['exp-campo', htmlCampo(v, a)], ['exp-banco', htmlBanco(v, a)]], foco);
}

function registrarNoRascunho(v, a, elenco, lance, msg, foco) {
  // Uma operação usa as vagas que estão na tela. Grave a formação exibida antes dela.
  const formacao = formacaoPendente(a);
  if (formacao) a.rascunho.push(formacao);
  aplicarLanceAoElenco(elenco, lance);
  a.elenco = elenco;
  a.rascunho.push(lance);
  a.sel = null;
  a.vagaSel = null;
  a.erro = false;
  a.msg = msg;
  atualizarCampoEBanco(v, a, `avExpSair|${foco}`);
}

function moverNoRascunho(v, a, elenco, vaga) {
  const r = prepararPosicao(v.g, a.min, a.sel, vaga, elenco);
  if (r.erro) { avisarRascunho(v, a, r.erro); return }
  registrarNoRascunho(v, a, elenco, r.lance, r.lance.name, a.sel);
}

export function avExpSair(id) {
  const v = ui.vivo, a = rascunhoAberto(v);
  if (!a || !id) return;
  const elenco = elencoExibido(a), vaga = elenco.xi.indexOf(id);
  if (vaga < 0) return;
  if (a.vagaSel != null) { // #326: a vaga do expulso foi marcada antes; este jogador vai para ela
    const destino = a.vagaSel;
    a.vagaSel = null; a.sel = id;
    moverNoRascunho(v, a, elenco, destino);
    if (a.sel === id) { a.sel = null; atualizarCampoEBanco(v, a) } // não moveu: o erro fica na mensagem
    return;
  }
  if (a.sel && a.sel !== id) { moverNoRascunho(v, a, elenco, vaga); return }
  a.sel = a.sel === id ? null : id;
  a.erro = false;
  a.msg = '';
  atualizarCampoEBanco(v, a);
}

export function avExpVaga(indice) {
  const v = ui.vivo, a = rascunhoAberto(v);
  if (!a) return;
  const elenco = elencoExibido(a), vaga = Number(indice);
  if (!elenco.expulsos.has(vaga) || vaga <= 0) return;
  if (a.sel) { moverNoRascunho(v, a, elenco, vaga); return }
  a.vagaSel = a.vagaSel === vaga ? null : vaga;
  a.erro = false;
  a.msg = a.vagaSel == null ? '' : `Toque em quem vai para a vaga de ${slotsDe(elenco.form)[vaga]}.`;
  atualizarCampoEBanco(v, a, `avExpVaga|${vaga}`);
}

export function avExpEntrar(id) {
  const v = ui.vivo, a = rascunhoAberto(v);
  if (!a) return;
  const trocas = trocasNoRascunho(a);
  if (trocas.length >= MAX_TROCAS) { avisarRascunho(v, a, limite()); return }
  if (a.vagaSel != null) { avisarRascunho(v, a, 'Só um jogador em campo pode ir para a vaga do expulso. Toque nele no campo.'); return }
  if (!a.sel) { avisarRascunho(v, a, 'Primeiro toque em quem sai, no campo.'); return }
  const elenco = elencoExibido(a), r = prepararTroca(v.g, a.min, a.sel, id, elenco, trocas);
  if (r.erro) { avisarRascunho(v, a, r.erro); return }
  registrarNoRascunho(v, a, elenco, r.lance, `${r.lance.name}. Troca no rascunho.`, id);
}

export function avExpTatica(campo, valor) {
  const v = ui.vivo, a = rascunhoAberto(v);
  if (!a || !Object.hasOwn(OPCOES, campo) || !Object.hasOwn(OPCOES[campo], valor)) return;
  if (campo === 'form') {
    a.form = valor;
    a.sel = null;
    a.vagaSel = null;
  } else a.tatica[campo] = valor;
  atualizar(v, a, [['exp-tatica', htmlTaticas(a)], ['exp-campo', htmlCampo(v, a)], ['exp-banco', htmlBanco(v, a)]]);
}

export function validarRascunhoExpulsao(v, a) {
  const { g } = v, { min } = a, elenco = elencoParaTrocas(g, min), feitas = trocasDe(g, v.clube.id, min);
  const lances = [], formacao = formacaoPendente(a);
  const rascunho = formacao ? [...a.rascunho, formacao] : a.rascunho;
  for (const e of rascunho) {
    let r;
    if (e.t === 'posicao') r = prepararPosicao(g, min, e.pid, e.vaga, elenco);
    else if (e.t === 'formacao') r = prepararFormacao(g, min, e.form, elenco);
    else r = prepararTroca(g, min, e.sai, e.entra, elenco, feitas);
    if (r.erro) { avisarRascunho(v, a, r.erro); return null }
    aplicarLanceAoElenco(elenco, r.lance);
    if (e.t === 'troca') feitas.push(r.lance);
    lances.push(r.lance);
  }
  return lances;
}

export function resumoExpulsao(v) {
  const aviso = v.avisoExpulsao;
  return v.fim || !aviso ? '' : `<div class="exp-retomada">${icone('cartao', { tam: 18 })}
    <span role="status">${esc(aviso.resumo)}</span><button type="button" class="btn fantasma" data-acao="avExpReabrir">Ver o aviso de novo</button></div>`;
}
