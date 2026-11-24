import assert from 'node:assert/strict';
import { test } from 'node:test';
import { carregarJogo } from './jogo.mjs';
import { catalogoEuropaAtual as catalogo } from '../supabase/functions/jogar-rodada/catalogos-europa.mjs';
import { DADOS_PADRAO } from '../core/dados-padrao.mjs';
import { loanOf, processLoans } from '../core/emprestimos.mjs';
import { S, P, reindex, tec, userClub } from '../core/estado.mjs';
import { compactarEuropaLiga, hidratarEuropaLiga } from '../core/europa-liga.mjs';
import { clubeDe, clubesEuropeus } from '../core/estrangeiros.mjs';
import { acaoMercadoLiga, iniciarLiga, jogarRodadaLiga } from '../core/liga.mjs';
import { precoPedido } from '../core/mercado.mjs';
import { janelaIA } from '../core/mercadoIA.mjs';

const copia = x => JSON.parse(JSON.stringify(x));
const quantidade = c => Object.values(c.europa.clubes).reduce((n, clube) => n + clube.players.length, 0);
const bytes = x => Buffer.byteLength(JSON.stringify(x));
const opcoes = (atual = catalogo, antigos = []) => ({ atual, catalogos: new Map([atual, ...antigos].map(c => [c.versao, c])) });
function montar(base) {
  const [a, b] = DADOS_PADRAO.clubs.filter(c => c.division === 'A');
  assert.ok(iniciarLiga([a, b].map((c, i) => ({ user_id: 't' + i, club_id: c.id })), ['A', 'B', 'C', 'D'], DADOS_PADRAO, base).ok);
}
const gravar = (base = catalogo) => copia(compactarEuropaLiga(S, base));
const candidato = filtro => clubesEuropeus().flatMap(c => c.players.filter(p =>
  c.players.filter(q => q.pos === p.pos).length > (p.pos === 'G' ? 2 : 3) && filtro(p, c)))[0];

test('liga anterior migra e se fixa ao catálogo arquivado; catálogo ausente nunca rende outro elenco', () => {
  carregarJogo();
  montar();
  const antigo = copia(S);
  assert.equal(antigo.versao, 18);
  assert.ok(acaoMercadoLiga(antigo, 't0', { tipo: 'ativarEuropa' }, opcoes()).ok);
  const salvo = gravar();
  assert.equal(salvo.europaLiga.catalogo, catalogo.versao);
  assert.ok(!salvo.europa && salvo.versao === 19);
  const novo = structuredClone(catalogo);
  novo.versao = 'eu1-' + 'a'.repeat(64);
  const [c0] = Object.values(novo.europa.clubes);
  c0.name = 'Mudou no catálogo novo';
  assert.throws(() => jogarRodadaLiga(copia(salvo), {}, opcoes(novo)), /Catálogo europeu da liga indisponível/);
  assert.throws(() => hidratarEuropaLiga(copia(salvo), novo, { publico: true }), /indisponível/);
  assert.ok(acaoMercadoLiga(copia(salvo), 't0', { tipo: 'ativarEuropa' }, opcoes(novo, [catalogo])).ok);
  assert.notEqual(clubeDe(c0.id).name, c0.name);
  assert.deepEqual(gravar(), salvo);
  montar(novo);
  assert.equal(clubeDe(c0.id).name, c0.name);
});

test('compra, empréstimo e contraproposta da liga persistem pelo delta e revalidam o técnico e a versão', () => {
  carregarJogo();
  montar(catalogo);
  userClub().players.splice(26);
  userClub().balance = 1000;
  reindex();
  const compra = candidato(p => p.listed && p.value < 30);
  const emprestado = candidato(p => p.emprestar);
  const alvo = candidato((p, c) => p.value > 1 && p.value < 30 && !p.emprestar &&
    ![...c.players].sort((a, b) => b.ovr - a.ovr).slice(0, 3).includes(p) && p.id !== compra.id);
  let persistido = gravar();
  const clube = userClub().id, europa = opcoes();
  const acao = (a, tecnico = 't0') => {
    const r = acaoMercadoLiga(copia(persistido), tecnico, a, europa);
    if (!r.erro) persistido = gravar();
    return r;
  };
  const desatualizado = copia(persistido);
  assert.ok(acao({ tipo: 'comprarJa', pid: compra.id }).ok);
  assert.equal(P[compra.id].clubId, clube);
  assert.ok(persistido.europaLiga.removidos.includes(compra.id));
  assert.ok(acaoMercadoLiga(desatualizado, 't0', { tipo: 'comprarJa', pid: compra.id }, europa).ok, 'cálculo que perderia a gravação condicional');
  assert.ok(acao({ tipo: 'comprarJa', pid: compra.id }).erro, 'retry sobre a versão vencedora não compra outra vez');
  const proposta = acao({ tipo: 'compra', pid: alvo.id, valor: precoPedido(alvo.id) * 0.7 }).contra;
  assert.ok(proposta && persistido.managers.t0.contraIA.id === proposta.id);
  const resposta = { tipo: 'responderContraIA', id: proposta.id, aceitar: true, valor: 0.1 };
  assert.ok(acao(resposta, 't1').erro, 'a outra pessoa não pode aceitar a contraproposta');
  assert.ok(acao(resposta).ok);
  assert.equal(P[alvo.id].clubId, clube);
  assert.ok(acao(resposta).erro, 'a cotação é usada uma vez');
  assert.ok(acao({ tipo: 'emprestimoJa', pid: emprestado.id }).ok);
  assert.equal(loanOf(emprestado.id).from, emprestado.clubId);
  assert.equal(P[emprestado.id].clubId, clube);
  persistido.loans.find(l => l.pid === emprestado.id).fim = { s: S.season, r: S.round + 1 };
  jogarRodadaLiga(copia(persistido), {}, europa);
  assert.equal(loanOf(emprestado.id), undefined);
  assert.equal(P[emprestado.id].clubId, emprestado.clubId);
  const depois = gravar();
  assert.ok(!depois.europaLiga.removidos.includes(emprestado.id));
  assert.equal(depois.clubs.find(c => c.id === clube).players.filter(p => p.id === compra.id || p.id === alvo.id).length, 2);
});

test('cerca de 6 mil jogadores continuam incrementais e determinísticos após seis janelas', t => {
  carregarJogo({ continentais: true });
  const base = structuredClone(catalogo);
  base.versao = 'eu1-' + 'b'.repeat(64);
  const originais = Object.values(base.europa.clubes);
  let n = quantidade(base);
  for (let i = 0; n < 6000; i++) {
    const c = structuredClone(originais[i % originais.length]);
    c.id = 'amostra' + i;
    for (const p of c.players) { p.id = c.id + p.id; p.clubId = c.id; }
    base.europa.clubes[c.id] = c;
    n += c.players.length;
  }
  montar(base);
  const inicio = gravar(base), europa = opcoes(base);
  const tamanhos = [{ estado: bytes(inicio), delta: bytes(inicio.europaLiga) }];
  assert.ok(tamanhos[0].delta < 2000);
  let persistido = inicio, compras = 0, emprestimos = 0, ofertas = 0;
  for (let i = 0; i < 6; i++) {
    const rodada = () => {
      assert.ok(acaoMercadoLiga(copia(persistido), 't0', { tipo: 'ativarEuropa' }, europa).ok);
      S.season = 2024 + Math.floor(i / 2);
      S.round = i % 2 ? 19 : 0;
      S.rng = 31 + i;
      processLoans();
      const r = janelaIA();
      const retorno = gravar(base);
      const hidratado = copia(retorno);
      hidratarEuropaLiga(hidratado, base);
      assert.deepEqual(hidratado.europa, S.europa, 'elencos, ordem, caixa e dados dos jogadores sobrevivem ao round-trip');
      return { retorno, r };
    };
    const { retorno, r } = rodada();
    assert.deepEqual(rodada().retorno, retorno, 'reprocessar a partir do mesmo estado produz o mesmo resultado');
    compras += r.compras.filter(({ de, para }) => de.liga && para.liga).length;
    emprestimos += r.emprestimos.filter(({ de, para }) => de.liga && para.liga).length;
    ofertas += r.propostas.filter(({ de }) => de.liga).length;
    tamanhos.push({ estado: bytes(retorno), delta: bytes(retorno.europaLiga) });
    persistido = retorno;
  }
  assert.ok(compras && emprestimos && ofertas);
  assert.ok(tamanhos.every(x => x.delta < 120_000));
  t.diagnostic(JSON.stringify({ jogadores: n, tamanhos, compras, emprestimos, ofertas }));
});
