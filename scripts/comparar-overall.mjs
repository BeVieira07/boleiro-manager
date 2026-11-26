// Uso: node scripts/comparar-overall.mjs --ea=<caminho do players.csv>
// A referência é lida em memória. A saída contém apenas estatísticas agregadas.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rate, refStrength } from '../core/dados.mjs';
import { DADOS_CONTINENTAIS } from '../core/dados-continentais.mjs';
import { DADOS_EUROPA } from '../core/dados-europa.mjs';
import { DADOS_PADRAO } from '../core/dados-padrao.mjs';
import { POSD } from '../core/posicoes.mjs';
import { linhasCsv } from './csv.mjs';

const COLUNAS = ['player_id', 'common_name', 'first_name', 'last_name', 'overall_rating', 'club', 'league',
  'gender', 'birthdate', 'snapshot_date'];
const TERMOS_CLUBE = new Set(['ac', 'afc', 'as', 'ca', 'cd', 'cf', 'fc', 'rc', 'sc', 'ssc', 'ud', 'us',
  'clube', 'club', 'futebol', 'football', 'calcio', 'de', 'do', 'da']);
const GENERICOS = new Set(['athletic', 'atletico', 'city', 'independiente', 'nacional', 'racing', 'real', 'sporting', 'united']);
const APELIDOS_CLUBE = new Map([
  ['athletico pr', 'athletico paranaense'],
  ['atletico mg', 'atletico mineiro'],
  ['ldu quito', 'liga quito'],
  ['man city', 'manchester city'],
  ['man united', 'manchester united'],
  ['spurs', 'tottenham hotspur'],
  ['u catolica', 'universidad catolica']
]);
const LIGAS_EA = new Map(Object.entries({
  A: 'Liga do Brasil',
  libertadores: 'CONMEBOL Libertadores',
  sulamericana: 'CONMEBOL Sudamericana',
  GB1: 'Premier League',
  GB2: 'EFL Championship',
  ES1: 'LALIGA EA SPORTS',
  ES2: 'LALIGA HYPERMOTION',
  IT1: 'Serie A Enilive',
  IT2: 'Serie BKT',
  FR1: "Ligue 1 McDonald's",
  FR2: 'Ligue 2 BKT',
  PO1: 'Liga Portugal'
}));
const LIGAS_BRASIL = new Set(['A', 'B', 'C', 'D']);
const AGRUPAMENTOS = [
  ['Idade', p => p.age <= 19 ? 'Até 19' : p.age <= 23 ? '20–23' : p.age <= 28 ? '24–28' : p.age <= 32 ? '29–32' : '33+'],
  ['Posição', p => ({ G: 'Goleiro', D: 'Defesa', M: 'Meio-campo', A: 'Ataque' })[p.pos] ?? 'Sem posição'],
  ['Valor de mercado (€ mi)', p => p.vm == null ? 'Sem valor' : p.vm < 1 ? 'Abaixo de 1' : p.vm < 5 ? '1 a <5' :
    p.vm < 15 ? '5 a <15' : p.vm < 40 ? '15 a <40' : '40 ou mais'],
  ['Origem do overall', p => p.origem]
];

export function normalizarNome(nome) {
  return (nome ?? '').normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '')
    .replaceAll('ß', 'ss').replaceAll('ł', 'l').replaceAll('ø', 'o')
    .replace(/['’]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function nomeClube(nome) {
  const chave = normalizarNome(nome).replace(/\butd\b/g, 'united').split(' ')
    .filter(t => !TERMOS_CLUBE.has(t)).join(' ');
  return APELIDOS_CLUBE.get(chave) ?? chave;
}

function mesmoClube(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const palavras = a.split(' '), outras = b.split(' ');
  if (palavras.length === outras.length) return false;
  const [menor, maior] = palavras.length < outras.length ? [palavras, outras] : [outras, palavras];
  return menor.length * 2 >= maior.length && menor.some(t => !GENERICOS.has(t) && t.length > 2) &&
    menor.every(t => maior.includes(t)) && !maior.some(t => /^[bcd]$|^i{2,3}$|^sub\d+$|^u\d+$/.test(t));
}

function idadeEm(nascimento, data) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nascimento ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(data ?? '')) return null;
  return Number(data.slice(0, 4)) - Number(nascimento.slice(0, 4)) - Number(data.slice(5) < nascimento.slice(5));
}

function nomeAbreviado(nome, candidato) {
  // A inicial abrevia apenas a primeira palavra. Sobrenomes compostos vêm na mesma ordem.
  const sobrenome = nome.slice(1);
  return nome.length > 1 && nome[0].length === 1 && candidato.length >= nome.length &&
    candidato[0][0] === nome[0] && sobrenome.join(' ') === candidato.slice(-sobrenome.length).join(' ');
}

export function indexarReferencia(referencia, data) {
  const indice = new Map();
  for (const jogador of referencia) {
    const idade = idadeEm(jogador.birthdate, data ?? jogador.snapshot_date);
    const nota = Number(jogador.overall_rating);
    if (jogador.gender !== "Men's Football" || !jogador.player_id || idade == null ||
        !jogador.overall_rating || !Number.isInteger(nota) || nota < 1 || nota > 99) continue;
    const nomes = [jogador.common_name, [jogador.first_name, jogador.last_name].filter(Boolean).join(' ')];
    const variantes = [...new Set(nomes.map(normalizarNome).filter(Boolean))].map(n => n.split(' '));
    for (const sobrenome of new Set(variantes.map(n => n.at(-1)))) {
      const ficha = { jogador, variantes, idade, clube: nomeClube(jogador.club), nota };
      if (!indice.has(sobrenome)) indice.set(sobrenome, []);
      indice.get(sobrenome).push(ficha);
    }
  }
  return indice;
}

export function casarJogador(jogador, indice) {
  const chave = normalizarNome(jogador.name);
  if (!chave || !Number.isInteger(jogador.age)) return null;
  const nome = chave.split(' '), clube = nomeClube(jogador.clube);
  const candidatos = [];
  for (const ficha of indice.get(nome.at(-1)) ?? []) {
    if (Math.abs(jogador.age - ficha.idade) > 1) continue;
    const exato = ficha.variantes.some(n => n.join(' ') === chave);
    if (!exato && !ficha.variantes.some(n => nomeAbreviado(nome, n))) continue;
    const clubeConfere = mesmoClube(clube, ficha.clube);
    candidatos.push({ ...ficha, exato, clubeConfere, prioridade: 2 * Number(clubeConfere) + Number(exato) });
  }
  const locais = candidatos.filter(c => c.clubeConfere);
  if (locais.length) {
    const exatos = locais.filter(c => c.exato);
    return unico(exatos.length ? exatos : locais);
  }
  // Com clube diferente, homônimos compatíveis com a idade e nomes de uma palavra ficam de fora.
  return nome.length > 1 ? unico(candidatos) : null;
}

function unico(candidatos) {
  const [primeiro] = candidatos;
  return primeiro && candidatos.every(c => c.jogador.player_id === primeiro.jogador.player_id && c.nota === primeiro.nota)
    ? primeiro : null;
}

export function lerReferencia(csv) {
  const linhas = linhasCsv(csv.replace(/^\uFEFF/, ''));
  const cabecalho = linhas.next().value ?? [];
  const colunas = COLUNAS.map(c => [c, cabecalho.indexOf(c)]);
  if (colunas.some(([, i]) => i < 0)) throw new Error('O CSV não contém todas as colunas esperadas.');
  return Array.from(linhas, linha => {
    if (linha.length !== cabecalho.length) throw new Error('O CSV contém uma linha com número incorreto de campos.');
    return Object.fromEntries(colunas.map(([c, i]) => [c, linha[i]]));
  });
}

export function jogadoresDoJogo() {
  const brasileiros = DADOS_PADRAO.clubs.flatMap(c => {
    const ref = refStrength(c, DADOS_PADRAO.clubs);
    return c.players.map(p => ({
      ...p, clube: c.name, liga: c.division, ovr: rate(p, ref, c.division),
      origem: p.ovrM != null ? 'Manual' : p.base != null ? 'Notas da temporada' :
        'AB'.includes(c.division) && p.vm != null ? 'Valor de mercado' : 'Estimativa'
    }));
  });
  const estrangeiros = DADOS_CONTINENTAIS.clubs.flatMap(c => c.players.map(p => ({
    ...p, clube: c.name, liga: c.torneio, origem: 'Escala continental'
  })));
  const europeus = DADOS_EUROPA.clubs.flatMap(c => c.players.map(([id, name, age, pd, ovr, , vm]) => ({
    id, name, age, pd, ovr, vm, pos: POSD[pd]?.grupo, clube: c.name, liga: c.liga,
    origem: vm == null ? 'Estimativa' : 'Valor de mercado'
  })));
  return [...brasileiros, ...estrangeiros, ...europeus];
}

export function comparar(jogadores, referencia) {
  const indice = indexarReferencia(referencia);
  const candidatosPorId = Map.groupBy(jogadores.flatMap(p => {
    const par = casarJogador(p, indice);
    return par ? [{ p, par }] : [];
  }), x => x.par.jogador.player_id);
  const pares = [...candidatosPorId.values()].flatMap(candidatos => {
    const melhor = Math.max(...candidatos.map(x => x.par.prioridade));
    const melhores = candidatos.filter(x => x.par.prioridade === melhor);
    return melhores.length === 1 ? melhores : [];
  });
  return pares.map(({ p, par }) => ({
    ...p, diferenca: p.ovr - par.nota, mesmoClube: par.clubeConfere,
    mesmaLiga: LIGAS_EA.has(p.liga) && par.jogador.league === LIGAS_EA.get(p.liga)
  }));
}

const num = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function estatisticas(pares) {
  if (pares.length < 2) return '— | — | — | — | —';
  const erros = pares.map(p => p.diferenca);
  const media = erros.reduce((s, e) => s + e, 0) / erros.length;
  const absoluto = erros.reduce((s, e) => s + Math.abs(e), 0) / erros.length;
  const extremos = erros.length < 5 ? ['—', '—', '—'] :
    [Math.min(...erros), Math.max(...erros), erros.filter(e => Math.abs(e) >= 10).length];
  return [num.format(media), num.format(absoluto), ...extremos].join(' | ');
}

function nomeLiga(liga) {
  if (LIGAS_BRASIL.has(liga)) return 'Série ' + liga;
  if (liga === 'libertadores') return 'Libertadores (estrangeiros)';
  if (liga === 'sulamericana') return 'Sul-Americana (estrangeiros)';
  return liga;
}

function relatorio(referencia) {
  const jogadores = jogadoresDoJogo();
  const paresPorLiga = Map.groupBy(comparar(jogadores, referencia), p => p.liga);
  const datas = [...new Set(referencia.filter(p => p.gender === "Men's Football").map(p => p.snapshot_date))];
  console.log('# Comparação de overall por liga');
  console.log('\nIdades da referência na data de cada captura: ' + datas.sort().join(', ') + '.');
  console.log('Desvio em pontos (jogo menos referência). EAM = erro absoluto médio. Médias a partir de dois pares e extremos a partir de cinco.');
  console.log('Liga = liga do jogo. Pares podem incluir transferidos de outra liga. A coluna “Mesma liga na referência” mede a cobertura direta.');
  console.log('\n| Liga | Jogadores | Pares | Mesmo clube | Mesma liga na referência | Desvio médio | EAM | Mín. | Máx. | Erros de 10+ pts |');
  console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  const ordem = ['A', 'B', 'C', 'D', 'libertadores', 'sulamericana', ...DADOS_EUROPA.ligas.map(l => l.id)];
  const jogadoresPorLiga = Map.groupBy(jogadores, p => p.liga);
  for (const liga of ordem) {
    const pares = paresPorLiga.get(liga) ?? [];
    console.log('| ' + [nomeLiga(liga), jogadoresPorLiga.get(liga)?.length ?? 0, pares.length,
      pares.filter(p => p.mesmoClube).length, pares.filter(p => p.mesmaLiga).length, estatisticas(pares)].join(' | ') + ' |');
  }
  for (const liga of ordem) {
    const pares = paresPorLiga.get(liga);
    if (!pares?.length) continue;
    console.log('\n## ' + nomeLiga(liga));
    console.log('\n| Agrupamento | Faixa | Pares | Desvio médio | EAM | Mín. | Máx. | Erros de 10+ pts |');
    console.log('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |');
    for (const [nome, agrupar] of AGRUPAMENTOS) {
      if (nome.startsWith('Valor') && !pares.some(p => p.vm != null)) continue;
      for (const [faixa, grupo] of Map.groupBy(pares, agrupar)) {
        console.log('| ' + [nome, faixa, grupo.length, estatisticas(grupo)].join(' | ') + ' |');
      }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [, , arg, ...extras] = process.argv;
    if (!arg?.startsWith('--ea=') || arg === '--ea=' || extras.length) {
      throw new Error('Uso: node scripts/comparar-overall.mjs --ea=<caminho do players.csv>');
    }
    relatorio(lerReferencia(readFileSync(arg.slice('--ea='.length), 'utf8')));
  } catch (erro) {
    console.error(erro.message);
    process.exitCode = 1;
  }
}
