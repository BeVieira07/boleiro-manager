import { potInicial } from './base.mjs';

/* O catálogo é imutável. O estado da liga só guarda mudanças de elenco, caixa e jogadores
   em relação à versão escolhida. A ordem dos elencos importa nos desempates do motor. */
export const versaoCatalogoValida = versao => typeof versao === 'string' && /^eu1-[a-f0-9]{64}$/.test(versao);
export const catalogoValido = (catalogo, versao) => versaoCatalogoValida(versao)
  && catalogo?.versao === versao && !!catalogo.europa?.clubes && !!catalogo.europa.ligas;

const preparados = new WeakMap();
function baseDoCatalogo(catalogo) {
  if (!preparados.has(catalogo)) {
    const europa = structuredClone(catalogo.europa);
    for (const p of jogadoresDe(europa)) p.pot = potInicial(p);
    preparados.set(catalogo, europa);
  }
  return preparados.get(catalogo);
}

export function incorporarEuropaLiga(estado, catalogo) {
  const europa = structuredClone(baseDoCatalogo(catalogo));
  const existentes = [...estado.clubs, ...Object.values(estado.continentais?.estrangeiros ?? {})];
  const usados = new Set(existentes.flatMap(c => [...c.players, ...(c.base || [])].map(p => p.id)));
  for (const c of Object.values(europa.clubes)) c.players = c.players.filter(p => !usados.has(p.id));
  estado.europa = europa;
  estado.europaLiga = { catalogo: catalogo.versao };
}

const porId = lista => new Map(lista.map(x => [x.id, x]));
const jogadoresDe = europa => Object.values(europa.clubes).flatMap(c => c.players);
const zerarLista = ({ emprestar, ...p }) => ({ ...p, listed: false });
const igual = (a, b) => Object.is(a, b) ||
  (typeof a === 'object' && typeof b === 'object' && JSON.stringify(a) === JSON.stringify(b));

function alteracao(p, base) {
  const campos = Object.entries(p).filter(([k, v]) => k !== 'id' && k !== 'clubId' && v !== undefined && !igual(v, base?.[k]));
  const excluir = Object.keys(base ?? {}).filter(k => p[k] === undefined);
  if (!campos.length && !excluir.length) return null;
  // pot fica no primeiro nível para a projeção da liga poder mostrar somente a faixa.
  return { id: p.id, ...Object.fromEntries(campos), ...(excluir.length ? { excluir } : {}) };
}

export function compactarEuropaLiga(estado, catalogo) {
  const referencia = estado.europaLiga?.catalogo;
  if (!referencia) return estado;
  if (!catalogoValido(catalogo, referencia) || !estado.europa) throw new Error('Catálogo europeu da liga indisponível.');
  const { europa, ...resto } = estado, original = baseDoCatalogo(catalogo);
  const jogadoresBase = jogadoresDe(original);
  const listasAtualizadas = estado.europaLiga.listasAtualizadas;
  const base = porId(listasAtualizadas ? jogadoresBase.map(zerarLista) : jogadoresBase), atuais = porId(jogadoresDe(europa));
  const removidos = [...base.keys()].filter(id => !atuais.has(id));
  const removido = new Set(removidos);
  const jogadores = [...atuais.values()].map(p => alteracao(p, base.get(p.id))).filter(Boolean);
  const clubes = [];
  for (const c of Object.values(europa.clubes)) {
    const antes = original.clubes[c.id];
    const ordem = c.players.map(p => p.id);
    const padrao = antes.players.filter(p => !removido.has(p.id)).map(p => p.id);
    const mudouOrdem = ordem.length !== padrao.length || ordem.some((id, i) => id !== padrao[i]);
    const mudouCaixa = c.balance !== antes.balance;
    if (mudouOrdem || mudouCaixa) clubes.push({ id: c.id, ...(mudouOrdem ? { ordem } : {}), ...(mudouCaixa ? { balance: c.balance } : {}) });
  }
  return { ...resto, europaLiga: { catalogo: referencia,
    ...(listasAtualizadas ? { listasAtualizadas: true } : {}),
    ...(removidos.length ? { removidos } : {}), ...(jogadores.length ? { jogadores } : {}), ...(clubes.length ? { clubes } : {}) } };
}

export function hidratarEuropaLiga(estado, catalogo, { publico = false } = {}) {
  const dados = estado.europaLiga;
  if (!dados) return;
  if (!catalogoValido(catalogo, dados.catalogo)) throw new Error('Catálogo europeu da liga indisponível.');
  const europa = structuredClone(baseDoCatalogo(catalogo));
  const jogadoresBase = jogadoresDe(europa);
  const jogadores = porId(dados.listasAtualizadas ? jogadoresBase.map(zerarLista) : jogadoresBase), clubes = porId(dados.clubes ?? []);
  const vistos = new Set(), removidos = new Set(dados.removidos);
  for (const { id, excluir, ...campos } of dados.jogadores ?? []) {
    const p = Object.assign(jogadores.get(id) ?? { id }, campos);
    for (const chave of excluir ?? []) delete p[chave];
    jogadores.set(id, p);
  }
  for (const c of Object.values(europa.clubes)) {
    const delta = clubes.get(c.id);
    if (delta?.balance !== undefined) c.balance = delta.balance;
    const ordem = delta?.ordem ?? c.players.filter(p => !removidos.has(p.id)).map(p => p.id);
    c.players = ordem.map(id => {
      const p = jogadores.get(id);
      if (!p || vistos.has(id) || removidos.has(id)) throw new Error('Elenco europeu da liga inválido.');
      p.clubId = c.id;
      if (publico && p.pot != null) p.pot = 51 + 8 * Math.min(5, Math.max(1, Math.ceil((p.pot - 55) / 8)));
      vistos.add(id);
      return p;
    });
  }
  estado.europa = europa;
}
