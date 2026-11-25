// Carrega o jogo (módulos de core/ e ui/) em Node, sem navegador, para os testes.
// - DOM falso mínimo: o HTML de cada tela vai para `j.html()` (o innerHTML de #app);
// - alert/confirm são registrados em `j.alertas`, e confirm sempre responde "sim";
// - localStorage é um objeto em memória (`j.ls`), com limite configurável para simular falta de espaço.
// `j.run('código')` roda o código com todos os exports de core/ e ui/ à vista (ex.: j.run('S.round')).
// Para trocar o jogo atual use usarEstado(...) (módulos não deixam atribuir S=...).
// Os módulos são carregados uma vez por arquivo de teste; carregarJogo() zera o estado entre os testes.
import { readdirSync } from 'node:fs';
import { sorteioFixo } from './sorteio-fixo.mjs';

const falso = () => new Proxy(function () {}, {
  get: (t, k) => k === 'value' ? '5' : k === 'checked' ? false : k === Symbol.toPrimitive ? () => '' : falso(),
  set: () => true, apply: () => falso()
});
const amb = { app: '', alertas: [], ls: {}, limite: Infinity, campos: {} };
// campo de formulário com valor definido pelo teste (j.campo(id, valor))
const campo = id => new Proxy(falso(), { get: (t, k) => k === 'value' ? amb.campos[id] : k === 'checked' ? !!amb.campos[id] : falso() });
const appEl = new Proxy({}, { set: (t, k, v) => { if (k === 'innerHTML') amb.app = v; return true }, get: () => falso() });
globalThis.__TESTE__ = true;
globalThis.document = { getElementById: id => id === 'app' ? appEl : id in amb.campos ? campo(id) : falso(), querySelector: () => falso(), querySelectorAll: () => [], createElement: () => falso(), body: falso(), addEventListener() {} };
globalThis.window = { scrollTo() {}, addEventListener() {} };
globalThis.localStorage = {
  getItem: k => amb.ls[k] ?? null,
  setItem: (k, v) => { const total = Object.entries(amb.ls).reduce((s, [kk, vv]) => s + (kk === k ? 0 : vv.length), 0) + String(v).length; if (total > amb.limite) throw new Error('QuotaExceededError'); amb.ls[k] = String(v) },
  removeItem: k => { delete amb.ls[k] }
};
globalThis.alert = m => amb.alertas.push(String(m));
globalThis.confirm = m => { amb.alertas.push(String(m)); return true };
globalThis.prompt = () => null;

const RAIZ = new URL('..', import.meta.url);
// um de cada vez: imports em paralelo de módulos com ciclo (ui/telas <-> ui/saves, ui/liga) quebram no Node 22 (ERR_VM_MODULE_LINK_FAILURE)
/** #332: os .mjs de uma pasta do jogo, com as subpastas (ex.: 'ui/partida/aovivo.mjs' vira 'partida/aovivo.mjs'),
 *  na ordem do nome do arquivo, como antes das subpastas: a ordem dos imports importa por causa dos ciclos. */
const nomeBase = f => f.slice(f.lastIndexOf('/') + 1);
export const arquivosMjs = dir => readdirSync(new URL(`${dir}/`, RAIZ), { recursive: true }).map(f => String(f).replace(/\\/g, '/'))
  .filter(f => f.endsWith('.mjs')).sort((a, b) => nomeBase(a) < nomeBase(b) ? -1 : nomeBase(a) > nomeBase(b) ? 1 : 0);
const carregar = async dir => { const ms = []; for (const f of arquivosMjs(dir)) ms.push(await import(new URL(`${dir}/${f}`, RAIZ))); return ms };
const modulos = [...await carregar('core'), ...await carregar('ui')];
const main = await import(new URL('ui/main.mjs', RAIZ));
const { usarEstado } = await import(new URL('core/estado.mjs', RAIZ));
const { ui } = await import(new URL('ui/estado.mjs', RAIZ));
const { salvarJogo } = await import(new URL('ui/inicio/saves.mjs', RAIZ));
const { avisosTeste } = await import(new URL('ui/avisos.mjs', RAIZ));
// #132: os estaduais (pré-temporada) ficam desligados, salvo carregarJogo({ estaduais: true }); assim cada "Jogar" é uma rodada da liga
const { ESTADUAIS } = await import(new URL('core/estadual.mjs', RAIZ));
ESTADUAIS.ligados = false;
// #133, #134: Libertadores e Sul-Americana também, salvo carregarJogo({ continentais: true })
const { CONTINENTAIS } = await import(new URL('core/continental.mjs', RAIZ));
CONTINENTAIS.ligados = false;
// #355: clubes europeus no mercado só com carregarJogo({ europa: true }); a tela não baixa nada durante os testes
const { definirBaseEuropa } = await import(new URL('core/europa.mjs', RAIZ));
const { DADOS_EUROPA } = await import(new URL('core/dados-europa.mjs', RAIZ));
(await import(new URL('ui/telas.mjs', RAIZ))).EUROPA.baixar = false;
// #64: avisos e confirmações vão para j.alertas; as confirmações respondem "sim", como o confirm falso fazia
avisosTeste.ouvir = m => amb.alertas.push(m); avisosTeste.autoConfirmar = true;
const UI_INICIAL = JSON.stringify(ui);

// todos os exports num só escopo (os valores são lidos na hora, então S/P aparecem atualizados)
const escopo = new Proxy({}, {
  has: (t, k) => typeof k === 'string' && modulos.some(m => k in m),
  get: (t, k) => { for (const m of modulos) if (k in m) return m[k] }
});
const avaliar = new Function('escopo', 'codigo', 'with (escopo) { return eval(codigo) }');

/** Começa do zero: sem jogo, armazenamento vazio (ou o `ls` dado). `boot: true` abre o jogo como no navegador e clica em
 *  "Jogar agora" na landing (#316), indo ao menu; com `landing: true`, para na landing.
 *  `semente`: o Math.random recomeça dela a cada carregarJogo (tests/sorteio-fixo.mjs), então o teste não depende da ordem. */
export function carregarJogo({ boot = false, landing = false, ls = {}, limiteLs = Infinity, estaduais = false, continentais = false, europa = false, semente = 20261115 } = {}) {
  Math.random = sorteioFixo(semente);
  ESTADUAIS.ligados = estaduais; CONTINENTAIS.ligados = continentais; definirBaseEuropa(europa ? DADOS_EUROPA : null);
  amb.app = ''; amb.alertas = []; amb.ls = ls; amb.limite = limiteLs; amb.campos = {};
  usarEstado(null); Object.assign(ui, JSON.parse(UI_INICIAL)); salvarJogo.avisou = false;
  if (boot) { main.iniciar(); if (!landing) main.executar('go|menu') }
  return { run: c => avaliar(escopo, c), ls: amb.ls, alertas: amb.alertas, html: () => amb.app, acao: (spec, ...extra) => main.executar(spec, extra), campo: (id, v) => { amb.campos[id] = v }, main };
}

/** Clube da série `div` na posição `i` por força (0 = mais forte). */
export const clubeDaSerie = (j, div = 'A', i = 10) =>
  j.run(`getData().clubs.filter(c=>c.division==='${div}').sort((a,b)=>b.strength-a.strength)[${i}].id`);

/** Joga até o fim da temporada, corrigindo a escalação quando há indisponíveis.
 *  Por padrão a diretoria não demite; use {demissao:true} para permitir. */
export function jogarTemporada(j, { demissao = false } = {}) {
  j.run(`(()=>{let n=0;while(S.round<S.fixtures.length&&!tec().demitido&&n<80){${demissao ? '' : 'tec().confBaixa=0;'}if(validateLineup())userClub().lineup=autoXI(userClub());playRound();n++}})()`);
}

/** Fecha a temporada e começa a próxima. */
export const virarTemporada = j => j.run('seasonEnd();newSeason()');

/** Joga uma rodada, trocando titulares lesionados/suspensos pela escalação automática. */
export const jogarRodada = (j, n = 1) => j.run(`for(let i=0;i<${n};i++){
  if(validateLineup())userClub().lineup=autoXI(userClub());playRound();
  if(S.copa?.pendente&&ui.vivo){
    do{avPular();avContinuar()}while(S.copa?.pendente&&ui.vivo);
  }
}`);

export const TELAS = ['clube', 'elenco', 'escalacao', 'base', 'competicoes', 'jogos', 'mercado', 'financas', 'tecnico', 'config', 'rodada']; // #409: Classificação, Copa e Artilharia estão em Competições
const SUSPEITOS = ['undefined', 'NaN', '[object'];
/** Renderiza cada tela e devolve a lista de problemas (texto suspeito ou erro). */
export function problemasNasTelas(j, telas = TELAS) {
  const erros = [];
  for (const t of telas) {
    try { j.run(`go('${t}')`) } catch (e) { erros.push(`${t}: ${e.message}`); continue }
    const h = j.html(), w = SUSPEITOS.find(x => h.includes(x));
    if (w) { const k = h.indexOf(w); erros.push(`${t}: "${h.slice(Math.max(0, k - 60), k + 30).replace(/\s+/g, ' ')}"`) }
  }
  return erros;
}
