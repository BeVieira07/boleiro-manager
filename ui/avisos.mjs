/* ================= avisos (toasts), confirmações e modais (#64) =================
   No lugar de alert, confirm e prompt do navegador:
   - avisar(msg, tipo): aviso no canto da tela que some sozinho (ok, info, aviso, erro) e pode ser fechado;
   - confirmar({titulo, texto, ok, perigo}, aoConfirmar, aoCancelar): modal para ações com perda;
   - pedirValor({titulo, texto, rotulo, valor, validar}, aoEnviar): modal com campo de valor e validação.
   Modais prendem o foco (Tab), fecham com Esc e devolvem o foco ao elemento de origem. */
import { esc } from '../core/utils.mjs';
import { icone } from './icones.mjs';
import { prefs } from './configuracoes.mjs';

// Para os testes (sem navegador): registra as mensagens e responde "sim" às confirmações.
export const avisosTeste = { ouvir: null, autoConfirmar: false };
const ICONE = { ok: 'ok', info: 'info', aviso: 'alerta', erro: 'alerta' };
const el = id => document.getElementById(id);
const real = n => n && n.isConnected === true; // no teste o DOM é falso

export function avisar(msg, tipo = 'info') {
  const texto = String(msg);
  if (avisosTeste.ouvir) avisosTeste.ouvir(texto);
  const box = el('avisos'); if (!real(box)) return;
  const t = document.createElement('div');
  t.className = `toast ${tipo}`; t.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
  t.innerHTML = `${icone(ICONE[tipo] || 'info', { tam: 20 })}<p>${esc(texto)}</p><button type="button" class="btn fantasma icone-so sm" aria-label="Fechar aviso">${icone('fechar', { tam: 16 })}</button>`;
  const sai = () => { t.classList.add('saindo'); setTimeout(() => t.remove(), 200) };
  t.querySelector('button').onclick = sai;
  box.appendChild(t);
  while (box.children.length > 4) box.firstElementChild.remove();
  setTimeout(sai, Math.min(12000, 4000 + texto.length * 40)); // textos longos ficam mais tempo
}

/* ---------- foco dentro do modal ---------- */
const FOCAVEIS = 'button:not([disabled]),[href],input:not([disabled]):not([type=hidden]),select,textarea,[tabindex]:not([tabindex="-1"])';
const focaveis = c => [...c.querySelectorAll(FOCAVEIS)].filter(x => x.offsetParent !== null || x === document.activeElement);
const pilha = []; // modais abertos: {caixa, origem, aoEsc}

export function abrirCamada(caixa, aoEsc) {
  pilha.push({ caixa, origem: document.activeElement, aoEsc });
  if (!real(caixa)) return;
  const alvo = caixa.querySelector('[data-principal]') || caixa.querySelector('input,select') || focaveis(caixa)[0];
  setTimeout(() => alvo && alvo.focus(), 0);
}
export function fecharCamada(caixa) {
  const i = pilha.findIndex(p => p.caixa === caixa); if (i < 0) return;
  const [p] = pilha.splice(i, 1);
  if (p.origem && p.origem.isConnected && p.origem.focus) p.origem.focus();
}
/** Esc fecha o modal de cima; Tab e Shift+Tab ficam dentro dele; Enter no campo de valor envia. */
export function teclaModal(ev) {
  const topo = pilha[pilha.length - 1]; if (!topo || !real(topo.caixa)) return;
  if (ev.key === 'Escape') { if (topo.aoEsc) { ev.preventDefault(); topo.aoEsc() } return }
  if (ev.key === 'Enter' && ev.target && ev.target.id === 'dlgValor') { ev.preventDefault(); enviarValorDialogo(); return }
  if (ev.key !== 'Tab') return;
  const f = focaveis(topo.caixa); if (!f.length) return;
  const i = f.indexOf(document.activeElement);
  if (ev.shiftKey && i <= 0) { ev.preventDefault(); f[f.length - 1].focus() }
  else if (!ev.shiftKey && (i === f.length - 1 || i < 0)) { ev.preventDefault(); f[0].focus() }
}

/* ---------- diálogo de confirmação e de valor ---------- */
const dlg = { sim: null, nao: null, enviar: null, validar: null };
function abrirDialogo(html) {
  const d = el('dialogo');
  if (!real(d)) return;
  d.innerHTML = `<div class="dialogo-caixa" role="dialog" aria-modal="true" aria-labelledby="dlgTitulo" aria-describedby="dlgTexto">${html}</div>`;
  d.hidden = false;
  abrirCamada(d, () => responderDialogo('nao'));
}
function fecharDialogo() { const d = el('dialogo'); if (!real(d)) return; d.hidden = true; d.innerHTML = ''; fecharCamada(d) }

// dispensavel: ação de jogo que a pessoa pode decidir não confirmar mais (Configurações, #106); excluir save nunca é
export function confirmar({ titulo = 'Confirmar', texto, ok = 'Confirmar', cancelar = 'Cancelar', perigo = false, dispensavel = false }, aoConfirmar, aoCancelar) {
  if (dispensavel && !prefs().confirmar) { aoConfirmar && aoConfirmar(); return }
  if (avisosTeste.ouvir) avisosTeste.ouvir(texto);
  if (avisosTeste.autoConfirmar) { aoConfirmar && aoConfirmar(); return }
  dlg.sim = aoConfirmar; dlg.nao = aoCancelar;
  abrirDialogo(`<h2 id="dlgTitulo">${perigo ? icone('alerta', { tam: 22 }) : ''}${esc(titulo)}</h2><p id="dlgTexto">${esc(texto)}</p>
    <div class="dialogo-acoes"><button type="button" class="btn fantasma" data-acao="responderDialogo|nao">${esc(cancelar)}</button>
    <button type="button" class="btn${perigo ? ' perigo' : ''}" data-principal data-acao="responderDialogo|sim">${esc(ok)}</button></div>`);
}
export function responderDialogo(r) { const f = r === 'sim' ? dlg.sim : dlg.nao; dlg.sim = dlg.nao = dlg.enviar = dlg.validar = null; fecharDialogo(); f && f() }

/** `validar(v)` devolve a mensagem de erro, ou nada se o valor serve. */
export function pedirValor({ titulo, texto, rotulo, valor = '', sufixo = '', ok = 'Enviar', validar }, aoEnviar) {
  if (avisosTeste.ouvir) avisosTeste.ouvir(texto);
  dlg.enviar = aoEnviar; dlg.validar = validar;
  abrirDialogo(`<h2 id="dlgTitulo">${esc(titulo)}</h2><p id="dlgTexto" class="pre">${esc(texto)}</p>
    <label class="campo-valor" for="dlgValor">${esc(rotulo)}<span class="row"><input id="dlgValor" inputmode="decimal" autocomplete="off" value="${esc(valor)}" aria-describedby="dlgErro">${sufixo ? `<span class="muted">${esc(sufixo)}</span>` : ''}</span></label>
    <p id="dlgErro" class="erro-campo" role="alert"></p>
    <div class="dialogo-acoes"><button type="button" class="btn fantasma" data-acao="responderDialogo|nao">Cancelar</button>
    <button type="button" class="btn" data-acao="enviarValorDialogo">${esc(ok)}</button></div>`);
}
export const lerNumero = s => parseFloat(String(s ?? '').trim().replace(',', '.')); // aceita 4,5 e 4.5
export function enviarValorDialogo() {
  const campo = el('dlgValor'), v = lerNumero(campo && campo.value), erro = dlg.validar ? dlg.validar(v) : (isNaN(v) ? 'Digite um número.' : '');
  if (erro) { const e = el('dlgErro'); if (e) e.textContent = erro; if (campo && campo.setAttribute) { campo.setAttribute('aria-invalid', 'true'); campo.focus() } return }
  const f = dlg.enviar; dlg.sim = dlg.nao = dlg.enviar = dlg.validar = null; fecharDialogo(); f && f(v);
}
