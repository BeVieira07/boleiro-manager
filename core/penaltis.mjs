/* ================= pênalti durante a partida (#290) =================
   Lance: { m, t: 'penalti', side, pid, name, gk, alvo, pulo, res }.
   `m` é o minuto da partida (1–93), `side` vale h (casa) ou a (fora) e `name` guarda o nome do batedor.
   `pid` identifica o batedor e `gk` o goleiro adversário (inclui quem assume o gol na falta de goleiro, ou null).
   `alvo` combina esq/meio/dir com baixo/alto. `pulo` é esq/meio/dir. Os lados seguem o ponto de vista do batedor.
   `res` vale gol, defesa, trave ou fora. Uma conversão também gera { m, t: 'gol', side, pid, name, pen: true }
   no mesmo minuto, para alimentar o placar e a artilharia.

   ================= disputa de pênaltis dos mata-matas (#267) =================
   Uma função só para Copa do Brasil, final dos estaduais e copas sul-americanas. Cinco cobranças alternadas para cada
   lado (para antes se um não alcança mais o outro) e, empatada, uma de cada até um converter e o outro errar.
   Cobram os jogadores em campo no fim do jogo, do mais provável ao goleiro, e cada cobrança depende do cobrador e do
   goleiro adversário. O sorteio usa só a semente recebida: a mesma partida dá a mesma disputa no servidor e no replay.
   Resultado: {v, placar: {[clube]: gols}, cob: [{c, pid, nome, gol}]} (c = clube que cobrou).
   Saves de antes da #267 guardavam em `pen` só o id do vencedor; a migração 15 o põe em {v}, sem placar nem cobranças.
   #288: o técnico escolhe a ordem (c.cobradores, ids); quem não está em campo é pulado e o resto segue a ordem automática.
   Cobrador cansado converte menos (o mesmo fator de energia do jogo). */
import { fatorEnergia } from './energia.mjs';
import { clamp, mulberry32 } from './utils.mjs';

const PESO_POS = { A: 0.03, M: 0.01, D: -0.02, G: -0.15 };
const GOLEIRO_MEDIO = { pos: 'G', ovr: 70 };
const chance = (p, goleiro) => clamp((0.76 + ((p.ovr ?? 60) - forcaGoleiro(goleiro)) * 0.006 + (PESO_POS[p.pos] ?? 0)) * fatorEnergia(p), 0.5, 0.92);
// sem goleiro em campo (expulso sem troca), quem vai para o gol rende bem menos
const forcaGoleiro = g => !g ? 30 : g.pos === 'G' ? g.ovr ?? 60 : (g.ovr ?? 60) * 0.5;

/** Força no pênalti (0 a 100): a chance de converter contra um goleiro médio, já com a energia. */
export const forcaPenalti = p => Math.round(chance(p, GOLEIRO_MEDIO) * 100);
// ordem automática: a força no pênalti (já com energia e posição), o goleiro por último
const ordem = p => (p.pos === 'G' ? -100 : 0) + chance(p, GOLEIRO_MEDIO) * 100;
/** Ordem automática: do mais provável ao goleiro. */
export const ordemAutomatica = jogadores => [...jogadores].sort((x, y) => ordem(y) - ordem(x) || (x.id < y.id ? -1 : 1));

/** Cobradores em ordem e o goleiro de um time, a partir dos jogadores em campo: primeiro os escolhidos (ids, na ordem
 *  do técnico) que estão em campo, depois os demais na ordem automática (o goleiro por último). */
export function timeNaDisputa(id, emCampo, escolhidos = []) {
  const jogadores = emCampo.filter(Boolean), porId = new Map(jogadores.map(p => [p.id, p]));
  const primeiro = [...new Set(Array.isArray(escolhidos) ? escolhidos : [])].map(i => porId.get(i)).filter(Boolean);
  const cobradores = [...primeiro, ...ordemAutomatica(jogadores.filter(p => !primeiro.includes(p)))];
  const goleiro = jogadores.find(p => p.pos === 'G') || [...jogadores].sort((x, y) => x.ovr - y.ovr)[0] || null;
  return { id, cobradores: cobradores.length ? cobradores : [{ id: null, name: 'Cobrador', pos: 'M', ovr: 50 }], goleiro };
}

// Limites acumulados. Os cantos baixos recebem 30% cada, os altos 13% cada.
const ALVOS = [
  ['esq-baixo', 0.30, 'Esquerda, embaixo'], ['dir-baixo', 0.60, 'Direita, embaixo'], ['meio-baixo', 0.70, 'Meio, embaixo'],
  ['esq-alto', 0.83, 'Esquerda, no alto'], ['dir-alto', 0.96, 'Direita, no alto'], ['meio-alto', 1, 'Meio, no alto']
];
export const NOMES_ALVOS_PENALTI = Object.freeze(Object.fromEntries(ALVOS.map(([alvo, , nome]) => [alvo, nome])));
const PULOS = [['esq', 0.40], ['meio', 0.60], ['dir', 1]];
function escolher(opcoes, r) {
  const sorteio = r();
  return opcoes.find(([, limite]) => sorteio < limite)[0];
}

/** Cobra um pênalti com o gerador `r`. `alvo` e `pulo` podem ser escolhidos antes da cobrança. */
export function cobrarPenalti(batedor, goleiro, r, { alvo = escolher(ALVOS, r), pulo = escolher(PULOS, r) } = {}) {
  const [lado, altura] = alvo.split('-');
  const alto = altura === 'alto', meio = lado === 'meio';
  const erroBase = alto ? (meio ? 0.08 : 0.175) : (meio ? 0.04 : 0.06);
  const erro = clamp(erroBase + (0.76 - chance(batedor, GOLEIRO_MEDIO)) * 0.25, 0.015, 0.27);
  const chute = r();
  if (chute < erro) return { alvo, pulo, res: chute < erro * 0.4 ? 'trave' : 'fora' };

  const diferenca = 0.76 - chance(batedor, goleiro);
  const defesa = lado === pulo ? (alto ? 0.36 : 0.53) + diferenca * 0.8 : 0.023 + diferenca * 0.08;
  return { alvo, pulo, res: r() < defesa ? 'defesa' : 'gol' };
}

export function textoPenalti(e, clube, goleiro) {
  const efeitos = {
    gol: `${e.name} converte`,
    defesa: goleiro ? `o goleiro ${goleiro} defende` : 'o goleiro defende',
    trave: `${e.name} acerta a trave`,
    fora: `${e.name} manda para fora`
  };
  return `Pênalti para o ${clube}: ${efeitos[e.res]}`;
}

/** Disputa entre `casa` e `fora` ({id, cobradores, goleiro}, de timeNaDisputa), com o sorteio da `semente`. */
export function disputarPenaltis(casa, fora, semente) {
  const r = mulberry32(semente), times = r() < 0.5 ? [casa, fora] : [fora, casa]; // quem começa: cara ou coroa
  const gols = [0, 0], batidas = [0, 0], cob = [];
  const bater = i => {
    const t = times[i], adv = times[1 - i], p = t.cobradores[batidas[i] % t.cobradores.length];
    const gol = r() < chance(p, adv.goleiro);
    batidas[i]++; if (gol) gols[i]++;
    cob.push({ c: t.id, pid: p.id, nome: p.name, gol });
  };
  const decidida = () => gols[0] + 5 - batidas[0] < gols[1] || gols[1] + 5 - batidas[1] < gols[0];
  for (let k = 0; k < 5 && !decidida(); k++) { bater(0); if (decidida()) break; bater(1) }
  while (gols[0] === gols[1]) { bater(0); bater(1) } // morte súbita: uma cobrança de cada
  const v = gols[0] > gols[1] ? times[0].id : times[1].id;
  return { v, placar: { [times[0].id]: gols[0], [times[1].id]: gols[1] }, cob };
}

/* ---------- #293: disputa passo a passo (interativa no ao vivo) ----------
   Mesmas regras de disputarPenaltis (5 alternadas, parada antecipada, morte súbita), mas cada cobrança usa cobrarPenalti
   (6 alvos), o técnico pode escolher batedor e canto, e o batedor não repete até todos do time baterem.
   O estado vive só na tela (o gerador não vai para o save); o resultado tem o mesmo formato de `pen`. */
export function novaDisputa(casa, fora, semente) {
  const r = mulberry32(semente), times = r() < 0.5 ? [casa, fora] : [fora, casa];
  return { r, times, gols: [0, 0], batidas: [0, 0], cob: [], usados: [[], []] };
}
function disputaDecidida({ gols: [g0, g1], batidas: [b0, b1] }) {
  if (b0 <= 5 && b1 <= 5 && (g0 + 5 - b0 < g1 || g1 + 5 - b1 < g0)) return true;
  return b0 === b1 && b0 >= 5 && g0 !== g1;
}
/** Índice (0 ou 1, em d.times) de quem bate agora, ou null se a disputa acabou. */
export const ladoDaVez = d => disputaDecidida(d) ? null : d.batidas[0] > d.batidas[1] ? 1 : 0;
/** Quem do time i ainda pode bater nesta volta (todos batem antes de alguém repetir). */
export function batedoresDaVez(d, i) {
  const t = d.times[i], livres = t.cobradores.filter(p => !d.usados[i].includes(p.id));
  return livres.length ? livres : t.cobradores;
}
/** Bate a próxima cobrança: {pid, alvo} escolhidos ou, sem escolha, o próximo da ordem e o canto sorteado. */
export function baterNaDisputa(d, { pid, alvo } = {}) {
  const i = ladoDaVez(d); if (i == null) return null;
  const lista = batedoresDaVez(d, i); if (lista === d.times[i].cobradores) d.usados[i] = [];
  const p = lista.find(x => x.id === pid) || lista[0], adv = d.times[1 - i];
  const c = cobrarPenalti(p, adv.goleiro, d.r, alvo ? { alvo } : {});
  d.usados[i].push(p.id); d.batidas[i]++;
  const gol = c.res === 'gol'; if (gol) d.gols[i]++;
  const x = { c: d.times[i].id, pid: p.id, nome: p.name, gol, alvo: c.alvo, pulo: c.pulo, res: c.res, gk: adv.goleiro?.id ?? null };
  d.cob.push(x); return x;
}
/** Resultado no formato de `pen` ({v, placar, cob}), quando ladoDaVez(d) é null. */
export function resultadoDisputa(d) {
  const [a, b] = d.times, v = d.gols[0] > d.gols[1] ? a.id : b.id;
  return { v, placar: { [a.id]: d.gols[0], [b.id]: d.gols[1] }, cob: d.cob.map(({ c, pid, nome, gol, alvo, pulo, res }) => ({ c, pid, nome, gol, alvo, pulo, res })) };
}

/** Quem venceu nos pênaltis (aceita o `pen` antigo, só com o id), ou null. */
export const vencedorPenaltis = pen => pen == null ? null : typeof pen === 'object' ? pen.v : pen;
/** Placar da disputa como "4 x 3", do ponto de vista de h contra a; '' se o save só sabe quem venceu. */
export const placarPenaltis = (pen, h, a) => pen?.placar && pen.placar[h] != null ? `${pen.placar[h]} x ${pen.placar[a]}` : '';
/** Gols de cada lado nas primeiras `n` cobranças (para a disputa ao vivo). */
export function placarAte(pen, h, a, n = pen.cob.length) {
  const feitas = pen.cob.slice(0, n);
  return { h: feitas.filter(x => x.c === h && x.gol).length, a: feitas.filter(x => x.c === a && x.gol).length };
}
/** Texto para notícias e telas: " nos pênaltis (4 x 3)" ou " nos pênaltis". */
export const nosPenaltis = (pen, h, a) => { const p = placarPenaltis(pen, h, a); return pen == null ? '' : p ? ` nos pênaltis (${p})` : ' nos pênaltis' };

/** Migração 15: `pen` antigo (id do vencedor) vira {v}, nos confrontos e nos jogos da copa ainda abertos. */
export function migrarPenaltis(s) {
  const conv = o => { if (o && o.pen != null && typeof o.pen !== 'object') o.pen = { v: o.pen } };
  for (const f of s.copa?.fases || []) f.jogos.forEach(conv);
  for (const g of s.copa?.pendente?.jogos || []) conv(g.copa);
  for (const tor of s.estaduais?.torneios || []) conv(tor.final);
  for (const tor of s.continentais?.torneios || []) { for (const f of tor.fases || []) f.jogos.forEach(conv); conv(tor.final) }
}
