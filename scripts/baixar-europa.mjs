// npm run europa -- --ligas=GB1,GB2,ES1,ES2
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { erroIds, forcaDoElenco, rate } from '../core/dados.mjs';
import { atribuirPosicoes, POSD, POS_SIMPLES } from '../core/posicoes.mjs';
import { clamp, norm } from '../core/utils.mjs';

const API = 'https://v3.football.api-sports.io';
const DATASET = 'https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data';
const TEMPORADA_API = 2024;
const TEMPORADA_TM = 2025;
const PAUSA_MS = 7000;
const MARGEM_DIARIA = 2;
const PADRAO = 'GB1,GB2,ES1,ES2';
const LIGAS = {
  GB1: { api: 39, nome: 'Premier League', pais: 'Inglaterra', clubes: 20, centro: 76 },
  GB2: { api: 40, nome: 'Championship', pais: 'Inglaterra', clubes: 24, centro: 70 },
  ES1: { api: 140, nome: 'LaLiga', pais: 'Espanha', clubes: 20, centro: 75 },
  ES2: { api: 141, nome: 'LaLiga 2', pais: 'Espanha', clubes: 22, centro: 67 },
  IT1: { api: 135, nome: 'Serie A', pais: 'Itália', clubes: 20, centro: 74 },
  IT2: { api: 136, nome: 'Serie B', pais: 'Itália', clubes: 20, centro: 66 },
  FR1: { api: 61, nome: 'Ligue 1', pais: 'França', clubes: 18, centro: 72 },
  FR2: { api: 62, nome: 'Ligue 2', pais: 'França', clubes: 18, centro: 65 },
  PO1: { api: 94, nome: 'Liga Portugal', pais: 'Portugal', clubes: 18, centro: 68 },
  PO2: { api: 95, nome: 'Liga Portugal 2', pais: 'Portugal', clubes: 18, centro: 60 }
};
// Calendários oficiais de 2025/26 e ids da API-Football. Extras vieram da terceira divisão.
const COMPOSICOES = {
  IT1: {
    fonte: 'https://img.legaseriea.it/vimages/68542726/259%20-%20anticipi%20e%20posticipi%20Serie%20A%20Enilive%2025-26%20%281-3%5E%29.pdf',
    ids: [487, 488, 489, 490, 492, 494, 495, 496, 497, 499, 500, 502, 503, 504, 505, 520, 523, 801, 867, 895]
  },
  IT2: {
    fonte: 'https://www.legab.it/news/pescara-cesena-e-lopening-day-serie-bkt-2025-26',
    ids: [498, 508, 509, 511, 512, 515, 517, 522, 863, 880, 899, 1578, 1579, 1581, 1687, 1693],
    extras: [525, 527, 528, 870] // Pescara, Virtus Entella, Avellino, Padova
  },
  FR1: {
    fonte: 'https://www.lfp.fr/assets/L1_MD_DNCG_2526_CALENDRIER_CLAIR_107b3d08b0.pdf',
    ids: [77, 79, 80, 81, 83, 84, 85, 91, 94, 95, 96, 97, 106, 108, 111, 112, 114, 116]
  },
  FR2: {
    fonte: 'https://www.lfp.fr/assets/L2_BKT_DNCG_2526_CALENDRIER_CLAIR_0f599a9d36.pdf',
    ids: [82, 87, 90, 93, 99, 101, 104, 110, 433, 1063, 1297, 1299, 1301, 1304, 1305, 3012],
    extras: [102, 1298] // Nancy, Le Mans. Boulogne já consta na lista da API.
  }
};
const FONTES = {
  clubes: `API-Football /teams, temporada ${TEMPORADA_API}`,
  elencos: 'API-Football /players/squads, elencos da data da consulta',
  escudos: 'API-Football, team.logo',
  transfermarkt: { licenca: 'CC0', clubes: `${DATASET}/clubs.csv.gz`, jogadores: `${DATASET}/players.csv.gz` },
  composicao: 'Primeira divisão pelo Transfermarkt (last_season=2025). Entre a 2ª e a 3ª divisão, mantida a lista da API de 2024/25.',
  posicoes: 'Transfermarkt quando há casamento; camisa e equilíbrio do elenco para os demais.',
  overall: 'Valor de mercado e idade quando disponíveis; referência da liga e força estimada do elenco para os demais.'
};
const GRUPOS = { Goalkeeper: 'G', Defender: 'D', Midfielder: 'M', Attacker: 'A' };
const TM = { Goalkeeper: 'GOL', 'Centre-Back': 'ZAG', 'Right-Back': 'LD', 'Left-Back': 'LE',
  'Defensive Midfield': 'VOL', 'Central Midfield': 'MC', 'Attacking Midfield': 'MEI', 'Right Midfield': 'MC',
  'Left Midfield': 'MC', 'Right Winger': 'PD', 'Left Winger': 'PE', 'Centre-Forward': 'ATA', 'Second Striker': 'MEI' };
const COLUNAS = {
  clubs: ['club_id', 'name', 'domestic_competition_id', 'last_season'],
  players: ['player_id', 'name', 'last_season', 'current_club_id', 'date_of_birth', 'sub_position', 'market_value_in_eur']
};
const ARQUIVOS_LOCAIS = ['brasileirao-2024', 'brasileirao-serie-b-2024', 'brasileirao-serie-c-2024',
  'brasileirao-serie-d-2024', 'continentais-2024'];
const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const dormir = ms => new Promise(r => setTimeout(r, ms));
const idApi = id => Number.isSafeInteger(id) && id > 0;
const nomeNormal = s => norm(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const lerJson = (arq, padrao) => existsSync(arq) ? JSON.parse(readFileSync(arq, 'utf8')) : padrao;
function salvar(arq, conteudo) {
  const tmp = join(dirname(arq), `.europa-${basename(arq)}-${process.pid}.tmp`);
  try {
    writeFileSync(tmp, conteudo);
    renameSync(tmp, arq);
  } finally {
    rmSync(tmp, { force: true });
  }
}

function* linhasCsv(csv) {
  let linha = [], campo = '', entreAspas = false;
  for (let i = 0; i <= csv.length; i++) {
    const c = csv[i];
    if (entreAspas) {
      if (c === '"' && csv[i + 1] === '"') { campo += c; i++; }
      else if (c === '"') entreAspas = false;
      else if (c === undefined) throw new Error('Campo CSV com aspas abertas.');
      else campo += c;
    } else if (c === '"' && !campo) entreAspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r' || c === undefined) {
      if (linha.length || campo) yield [...linha, campo];
      linha = []; campo = '';
      if (c === '\r' && csv[i + 1] === '\n') i++;
    } else campo += c;
  }
}

function lerDataset(gzip, nome) {
  const linhas = linhasCsv(gunzipSync(gzip).toString('utf8').replace(/^\uFEFF/, ''));
  const cabecalho = linhas.next().value || [];
  const colunas = COLUNAS[nome].map(k => [k, cabecalho.indexOf(k)]);
  if (colunas.some(([, i]) => i < 0)) throw new Error(`Colunas inesperadas em ${nome}.csv.gz.`);
  return Array.from(linhas, linha => {
    if (linha.length !== cabecalho.length) throw new Error(`Linha inválida em ${nome}.csv.gz.`);
    return Object.fromEntries(colunas.map(([k, i]) => [k, linha[i]]));
  });
}

async function carregarDataset(nome, dir, baixar) {
  const arq = join(dir, `tmds-${nome}-raw.csv.gz`);
  if (existsSync(arq)) return lerDataset(readFileSync(arq), nome);
  const res = await baixar(`${DATASET}/${nome}.csv.gz`, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`Transfermarkt datasets (${nome}): HTTP ${res.status}.`);
  const gzip = Buffer.from(await res.arrayBuffer());
  const linhas = lerDataset(gzip, nome);
  salvar(arq, gzip);
  return linhas;
}

function listarTimes(raw, ligas) {
  const times = new Map();
  for (const liga of ligas) for (const { team } of raw.times[liga]?.response || []) {
    if (!times.has(team.id)) times.set(team.id, { team, liga });
  }
  return [...times.values()];
}

async function coletar(raw, ligas, { baixar, chave, esperar, informar, hoje, salvarRaw }) {
  async function api(path) {
    const res = await baixar(API + path, {
      headers: { 'x-apisports-key': chave }, signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) throw new Error(`API-Football ${path}: HTTP ${res.status}.`);
    const dados = await res.json();
    const erros = Object.values(dados.errors || {});
    if (erros.length) throw new Error(`API-Football ${path}: ${erros.join(' | ').replaceAll(chave, '[omitida]')}`);
    return dados;
  }

  const { response } = await api('/status');
  const { current, limit_day: limite } = response?.requests || {};
  if (!Number.isInteger(current) || current < 0 || !Number.isInteger(limite) || limite <= 0) {
    throw new Error('A API-Football não informou a cota diária em /status.');
  }
  const orcamento = Math.max(0, limite - MARGEM_DIARIA - current);
  let pedidos = 0;
  informar(`API-Football: ${current}/${limite} pedidos usados hoje, ${orcamento} disponíveis com margem de ${MARGEM_DIARIA}.`);

  async function pedir(path) {
    await esperar(PAUSA_MS);
    pedidos++;
    return api(path);
  }

  const listas = [...new Set(ligas.flatMap(liga => COMPOSICOES[liga]
    ? [`${liga.slice(0, 2)}1`, `${liga.slice(0, 2)}2`] : [liga]))];
  for (const liga of listas) {
    if (raw.times[liga] || pedidos >= orcamento) continue;
    informar(`Consultando clubes de ${liga} (${TEMPORADA_API})…`);
    const dados = await pedir(`/teams?league=${LIGAS[liga].api}&season=${TEMPORADA_API}`);
    if (!Array.isArray(dados.response) || !dados.response.length ||
        dados.response.some(({ team }) => !idApi(team?.id) || !team.name)) {
      throw new Error(`Lista de clubes inválida ou vazia em ${liga}.`);
    }
    raw.times[liga] = dados;
    salvarRaw();
  }

  const times = listarTimes(raw, ligas.filter(liga => !COMPOSICOES[liga]));
  const timesBase = new Map(listarTimes(raw, listas).map(({ team }) => [team.id, team]));
  raw.timesExtras ??= {};
  const timesExtras = new Map(Object.values(raw.timesExtras).map(team => [team.id, team]));
  let faltamBuscas = 0;
  let faltamClubes = 0;
  for (const liga of ligas.filter(id => COMPOSICOES[id])) {
    const { ids, extras = [] } = COMPOSICOES[liga];
    const temListas = [`${liga.slice(0, 2)}1`, `${liga.slice(0, 2)}2`].every(id => raw.times[id]);
    const clubes = ids.map(id => timesBase.get(id)).filter(Boolean);
    if (temListas && clubes.length !== ids.length) {
      throw new Error(`Clubes de ${liga} ausentes nas listas da API: ${ids.filter(id => !timesBase.has(id)).join(', ')}.`);
    }
    for (const id of extras) {
      let team = timesBase.get(id) ?? timesExtras.get(id);
      if (!team && pedidos < orcamento) {
        informar(`Consultando clube e${id} (${liga} 2025/26)…`);
        const dados = await pedir(`/teams?id=${id}`);
        team = dados.response?.find(item => item.team?.id === id && item.team.name)?.team;
        if (!team) throw new Error(`Clube e${id} de ${liga} ausente na API.`);
        raw.timesExtras[id] = team;
        salvarRaw();
      }
      if (team) clubes.push(team);
      else faltamBuscas++;
    }
    faltamClubes += LIGAS[liga].clubes - clubes.length;
    times.push(...clubes.map(team => ({ team, liga })));
  }
  for (const [i, { team }] of times.entries()) {
    if (raw.elencos[team.id] || pedidos >= orcamento) continue;
    informar(`(${i + 1}/${times.length}) Consultando elenco de ${team.name}…`);
    const dados = await pedir(`/players/squads?team=${team.id}`);
    const elenco = Array.isArray(dados.response) && dados.response.find(x => x.team?.id === team.id);
    if (!Array.isArray(elenco?.players) || !elenco.players.length) throw new Error(`Elenco inválido ou vazio: ${team.name}.`);
    raw.elencos[team.id] = dados;
    raw.datasElencos[team.id] = hoje();
    salvarRaw();
  }

  const naoListadas = listas.filter(liga => !raw.times[liga]);
  const clubesEmListasPendentes = naoListadas.filter(liga => !COMPOSICOES[liga])
    .reduce((n, liga) => n + LIGAS[liga].clubes, 0);
  const faltam = times.filter(({ team }) => !raw.elencos[team.id]).length +
    faltamBuscas + faltamClubes + naoListadas.length + clubesEmListasPendentes;
  if (faltam) {
    const estimativa = naoListadas.length ? ' aproximadamente' : '';
    const pendencia = faltam === 1 ? 'falta 1 pedido' : `faltam${estimativa} ${faltam} pedidos`;
    informar(`Limite diário: ${pendencia}. Rode o mesmo comando amanhã para retomar.`);
  }
  return { times, pedidos, faltam };
}

const TERMOS_CLUBE = new Set(['fc', 'afc', 'cf', 'cd', 'ud', 'rcd', 'ca', 'ac', 'sc', 'bc', 'sco', 'rc', 'as', 'us', 'ssc',
  'clube', 'club', 'futebol', 'football', 'calcio', 'de', 'do', 'da']);
const GENERICOS = new Set(['city', 'united', 'real', 'deportivo', 'athletic', 'atletico', 'sporting', 'racing']);
const nomeClube = nome => nomeNormal(nome).replace(/\butd\b/g, 'united').split(' ')
  .filter(t => !TERMOS_CLUBE.has(t) && !/^\d+$/.test(t));

function casaClube(team, candidatos) {
  const a = nomeClube(team.name);
  const exatos = candidatos.filter(c => c.tokens.join(' ') === a.join(' '));
  if (exatos.length) return exatos.length === 1 ? { tm: exatos[0], grau: 2 } : null;
  const aproximados = candidatos.filter(({ tokens: b }) => {
    const comuns = a.filter(t => b.includes(t));
    return comuns.length === Math.min(a.length, b.length) && comuns.length >= Math.max(a.length, b.length) / 2 &&
      comuns.some(t => !GENERICOS.has(t));
  });
  return aproximados.length === 1 ? { tm: aproximados[0], grau: 1 } : null;
}

function casarClubes(times, clubesTm, ajustes, informar) {
  const porId = new Map(clubesTm.map(c => [c.club_id, c]));
  const pares = new Map();
  for (const { team, liga } of times) {
    const manual = ajustes[`e${team.id}`];
    let par;
    if (manual != null) {
      const tm = porId.get(String(manual));
      if (!tm) throw new Error(`Clube Transfermarkt ${manual} não encontrado para e${team.id} (${team.name}).`);
      par = { tm, grau: 3 };
    } else {
      const pais = liga.slice(0, 2);
      par = casaClube(team, clubesTm.filter(c => c.domestic_competition_id.slice(0, 2) === pais));
    }
    if (par) {
      if (!pares.has(par.tm.club_id)) pares.set(par.tm.club_id, []);
      pares.get(par.tm.club_id).push({ id: team.id, ...par });
    } else if (liga.endsWith('1')) informar(`Sem casamento no Transfermarkt: e${team.id} ${team.name} (${liga}).`);
  }

  const resultado = new Map();
  for (const candidatos of pares.values()) {
    candidatos.sort((a, b) => b.grau - a.grau);
    const [primeiro, segundo] = candidatos;
    if (!segundo || primeiro.grau > segundo.grau) resultado.set(primeiro.id, primeiro.tm);
    if (segundo) informar(`Casamento de clube disputado para ${primeiro.tm.name}: ${candidatos.map(c => `e${c.id}`).join(', ')}.`);
  }
  return resultado;
}

function idadeEm(nascimento, data) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(nascimento)) return null;
  return Number(data.slice(0, 4)) - Number(nascimento.slice(0, 4)) -
    Number(data.slice(5, 10) < nascimento.slice(5, 10));
}

// Os elencos da API são mais novos que o dataset (transferências depois de julho de 2026): sem par no clube, procura o
// jogador no dataset inteiro, pelo nome e com a idade batendo (diferença de até 1 ano), só quando há um candidato único.
function casaJogadorEmQualquerClube(p, indice, data) {
  if (!(p.age > 0)) return null;
  const tokens = nomeNormal(p.name).split(' ').filter(t => t.length > 1);
  const sobrenome = tokens.at(-1);
  if (!sobrenome) return null;
  const j = casaJogador(p, indice.get(sobrenome) || [], data);
  return j && Math.abs(p.age - idadeEm(j.date_of_birth, data)) <= 1 ? j : null;
}

function casaJogador(p, candidatos, data) {
  const nome = nomeNormal(p.name);
  const tokens = nome.split(' ');
  let opcoes = candidatos.filter(j => j.nome === nome);
  if (!opcoes.length && tokens.some(t => t.length > 1)) {
    opcoes = candidatos.filter(j => tokens.every(t => t.length === 1 ? j.tokens.some(x => x[0] === t) : j.tokens.includes(t)));
  }
  const avaliados = opcoes.map(j => {
    const idade = idadeEm(j.date_of_birth, data);
    return { j, diferenca: p.age > 0 && idade != null ? Math.abs(p.age - idade) : Infinity };
  }).filter(x => x.diferenca <= 2 || x.diferenca === Infinity).sort((a, b) => a.diferenca - b.diferenca);
  const [primeiro, segundo] = avaliados;
  return primeiro && (!segundo || primeiro.diferenca < segundo.diferenca) ? primeiro.j : null;
}

function montarClubes(raw, times, clubesTm, jogadoresTm, ajustes, informar) {
  const casamentos = casarClubes(times, clubesTm.map(c => ({ ...c, tokens: nomeClube(c.name) })), ajustes.clubes || {}, informar);
  const porId = new Map(jogadoresTm.map(j => [j.player_id, j]));
  const porClube = new Map(), porSobrenome = new Map();
  const registros = new Map();
  for (const j of jogadoresTm) {
    if (Number(j.last_season) < TEMPORADA_API) continue;
    if (!porClube.has(j.current_club_id)) porClube.set(j.current_club_id, []);
    const nome = nomeNormal(j.name);
    const registro = { ...j, nome, tokens: nome.split(' ') };
    porClube.get(j.current_club_id).push(registro);
    const sobrenome = registro.tokens.at(-1);
    if (!porSobrenome.has(sobrenome)) porSobrenome.set(sobrenome, []);
    porSobrenome.get(sobrenome).push(registro);
  }

  const clubs = times.map(({ team, liga: origem }) => {
    const tm = casamentos.get(team.id);
    const primeira = `${origem.slice(0, 2)}1`;
    const noTopo = tm?.domestic_competition_id === primeira && Number(tm.last_season) === TEMPORADA_TM;
    const ligaEstimativa = noTopo ? primeira : `${origem.slice(0, 2)}2`;
    const liga = COMPOSICOES[origem] ? origem : ligaEstimativa;
    if (liga !== origem) informar(`Composição 2025/26: ${team.name} (${origem} → ${liga}).`);
    const id = `e${team.id}`;
    const data = raw.datasElencos[team.id];
    const elenco = raw.elencos[team.id].response.find(x => x.team.id === team.id);
    const players = [];
    for (const p of elenco.players) {
      // A API às vezes traz um jogador sem id (ex.: id 0 num juvenil): sem id não dá para casar nem salvar
      if (!idApi(p.id) || !p.name) { informar(`Jogador sem id válido ou nome, ignorado: ${p.name || '?'} (${team.name}).`); continue; }
      const pid = `p${p.id}`;
      const manual = ajustes.jogadores?.[pid];
      const j = manual == null
        ? casaJogador(p, porClube.get(tm?.club_id) || [], data) || casaJogadorEmQualquerClube(p, porSobrenome, data)
        : porId.get(String(manual));
      if (manual != null && !j) throw new Error(`Jogador Transfermarkt ${manual} não encontrado para ${pid} (${p.name}).`);
      const detalhe = TM[j?.sub_position];
      const pd = POS_SIMPLES[detalhe] || detalhe;
      const pos = POSD[pd]?.grupo || GRUPOS[p.position];
      if (!pos) {
        informar(`Jogador sem posição: ${pid} ${p.name} (${team.name}).`);
        continue;
      }
      const idadeTm = j && idadeEm(j.date_of_birth, data);
      const age = (Number.isInteger(p.age) && p.age > 0 ? p.age : idadeTm) || 24;
      const jogador = { id: pid, name: p.name, age, pos, ...(pd && { pd }), number: Number.isInteger(p.number) ? p.number : null };
      const valor = Number(j?.market_value_in_eur);
      if (Number.isFinite(valor) && valor > 0) jogador.vm = valor / 1e6;

      // Um id da API pode aparecer em dois elencos. Preferir o clube confirmado pelo Transfermarkt.
      const anterior = registros.get(pid);
      const confirmado = Boolean(tm && j?.current_club_id === tm.club_id);
      if (anterior) {
        informar(`Jogador repetido na Europa: ${pid} ${p.name} (${anterior.clube} e ${id}).`);
        if (!confirmado || anterior.confirmado) continue;
        anterior.players.splice(anterior.players.indexOf(anterior.jogador), 1);
      }
      registros.set(pid, { clube: id, confirmado, players, jogador });
      players.push(jogador);
    }
    return { id, name: team.name, short: (team.code || team.name.slice(0, 3)).toUpperCase(), liga,
      pais: LIGAS[liga].pais, logo: `img/escudos/eu-${team.id}.png`, players };
  });

  for (const c of clubs) {
    atribuirPosicoes(c.players);
    const { centro } = LIGAS[c.liga];
    // 'C' usa a estimativa padrão de rate, sem o desconto reservado a quem falta no Transfermarkt no Brasileirão.
    for (const p of c.players) p.ovr = rate(p, centro, p.vm == null ? 'C' : 'A');
    const referencia = centro + clamp((forcaDoElenco({ ...c, strength: centro }) - centro) / 2, -6, 6);
    for (const p of c.players) if (p.vm == null) p.ovr = rate(p, referencia, 'C');
    c.strength = forcaDoElenco({ ...c, strength: centro });
  }
  return { clubs, casamentos };
}

function avisarColisoes(clubs, dir, informar) {
  const idsLocais = new Map();
  for (const arq of ARQUIVOS_LOCAIS) {
    const base = lerJson(join(dir, `${arq}.json`), { clubs: [] });
    for (const c of base.clubs) for (const id of [c.id, ...c.players.map(p => p.id)]) {
      if (!idsLocais.has(id)) idsLocais.set(id, new Set());
      idsLocais.get(id).add(arq);
    }
  }
  for (const c of clubs) for (const { id, name } of [c, ...c.players]) {
    if (idsLocais.has(id)) informar(`Id também presente em outra base: ${id} ${name} (${[...idsLocais.get(id)].join(', ')}).`);
  }
}

async function baixarEscudos(times, raiz, baixar, informar) {
  mkdirSync(join(raiz, 'img', 'escudos'), { recursive: true });
  let falhas = 0;
  for (const { team } of times) {
    const dest = join(raiz, 'img', 'escudos', `eu-${team.id}.png`);
    if (existsSync(dest)) continue;
    try {
      if (!team.logo) throw new Error('API sem URL de escudo.');
      const res = await baixar(team.logo, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}.`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.subarray(0, PNG.length).equals(PNG)) throw new Error('A resposta não contém uma imagem PNG.');
      salvar(dest, buf);
    } catch (e) {
      falhas++;
      informar(`Falha no escudo e${team.id} ${team.name}: ${e.message}`);
    }
  }
  return falhas;
}

export async function importarEuropa({ ligas, chave, raiz = '.', baixar = fetch, esperar = dormir, informar = console.log,
  hoje = () => new Date().toISOString().slice(0, 10) }) {
  const codigos = [...new Set(ligas.map(id => id.trim().toUpperCase()))];
  if (!codigos.length || codigos.some(id => !Object.hasOwn(LIGAS, id))) {
    throw new Error(`Use --ligas=${PADRAO} ou escolha entre ${Object.keys(LIGAS).join(', ')}.`);
  }
  if (!chave) throw new Error('Defina API_FOOTBALL_KEY no arquivo .env.');
  const dir = join(raiz, 'data');
  mkdirSync(dir, { recursive: true });
  const cache = join(dir, 'europa-2025-raw.json');
  const raw = lerJson(cache, { times: {}, elencos: {}, datasElencos: {} });
  const { times, pedidos, faltam } = await coletar(raw, codigos, {
    baixar, chave, esperar, informar, hoje, salvarRaw: () => salvar(cache, JSON.stringify(raw))
  });
  if (faltam) return { pedidos, faltam };

  const [clubesTm, jogadoresTm] = await Promise.all(['clubs', 'players'].map(nome => carregarDataset(nome, dir, baixar)));
  const ajustes = lerJson(join(dir, 'europa-casamentos.json'), {});
  const { clubs: importados, casamentos } = montarClubes(raw, times, clubesTm, jogadoresTm, ajustes, informar);
  let clubesSemPar = 0;
  for (const pais of new Set(codigos.map(id => id.slice(0, 2)))) {
    const primeira = `${pais}1`;
    if (COMPOSICOES[primeira]) continue;
    const topo = clubesTm.filter(c => c.domestic_competition_id === primeira && Number(c.last_season) === TEMPORADA_TM);
    if (!topo.length) throw new Error(`Transfermarkt sem clubes de ${primeira} em 2025/26.`);
    if (codigos.includes(primeira) && codigos.includes(`${pais}2`)) {
      const casados = new Set([...casamentos.values()].map(c => c.club_id));
      const pendentes = topo.filter(c => !casados.has(c.club_id));
      clubesSemPar += pendentes.length;
      if (pendentes.length) informar(`Clubes da primeira divisão sem par na API (${primeira}): ${pendentes.map(c => c.name).join(', ')}.`);
    }
  }

  const saida = join(dir, 'europa-2025.json');
  const anterior = lerJson(saida, { ligas: [], clubs: [] });
  const ids = new Set(importados.map(c => c.id));
  const jogadoresNovos = new Set(importados.flatMap(c => c.players.map(p => p.id)));
  const ligasVerificadas = codigos.filter(liga => COMPOSICOES[liga]);
  const clubesAnteriores = anterior.clubs.filter(c => !ids.has(c.id) && !ligasVerificadas.includes(c.liga)).map(c => {
    const players = c.players.filter(p => {
      if (!jogadoresNovos.has(p.id)) return true;
      informar(`Jogador repetido na Europa: ${p.id} ${p.name} (retirado de ${c.id} e mantido no lote atual).`);
      return false;
    });
    if (players.length === c.players.length) return c;
    const clube = { ...c, players };
    return { ...clube, strength: forcaDoElenco(clube) };
  });
  const clubs = [...clubesAnteriores, ...importados].sort((a, b) => a.liga.localeCompare(b.liga) || a.name.localeCompare(b.name, 'pt-BR'));
  const erro = erroIds(clubs);
  if (erro) throw new Error(erro);
  const elencosInvalidos = clubs.filter(c => {
    const temGoleiro = c.players.some(p => p.pd === 'GOL');
    if (!temGoleiro) informar(`Elenco sem goleiro: ${c.id} ${c.name}.`);
    if (c.players.length < 18) informar(`Elenco com menos de 18 jogadores: ${c.id} ${c.name} (${c.players.length}).`);
    return !temGoleiro || c.players.length < 18;
  }).length;
  avisarColisoes(clubs, dir, informar);

  const presentes = new Set([...anterior.ligas.map(l => l.id), ...codigos, ...clubs.map(c => c.liga)]);
  const ligasSaida = Object.entries(LIGAS).filter(([id]) => presentes.has(id)).map(([id, { nome, pais }]) => (
    { id, nome, pais, divisao: Number(id.at(-1)) }
  ));
  const fontesOficiais = ligasSaida.filter(liga => COMPOSICOES[liga.id]).map(liga => `${liga.nome} (${COMPOSICOES[liga.id].fonte})`);
  const composicao = fontesOficiais.length
    ? `Os calendários oficiais de 2025/26 definem os clubes de ${fontesOficiais.join(', ')}. Para as demais ligas, vale o critério original. ${FONTES.composicao}`
    : FONTES.composicao;
  const fontes = { ...FONTES, composicao };
  if (fontesOficiais.length) fontes.clubes += ' e consulta individual dos promovidos ausentes nas listas.';
  if (presentes.has('FR2')) fontes.escudos += '. Escudo do Pau FC convertido de JPEG para PNG.';
  const dados = { temporada: '2025/26', fontes, ligas: ligasSaida, clubs };
  salvar(saida, `${JSON.stringify(dados, null, 2)}\n`);
  informar(`data/europa-2025.json: ${clubs.length} clubes. ${composicao}`);
  const falhasEscudos = await baixarEscudos(times, raiz, baixar, informar);
  if (falhasEscudos) informar(`${falhasEscudos} escudos pendentes. Rode o mesmo comando para tentar novamente.`);
  return { dados, pedidos, faltam, falhasEscudos, elencosInvalidos, clubesSemPar };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const chave = process.env.API_FOOTBALL_KEY;
  try {
    if (args.length > 1 || (args.length && !args[0].startsWith('--ligas='))) throw new Error(`Use --ligas=${PADRAO}.`);
    const ligas = (args[0]?.slice('--ligas='.length) ?? PADRAO).split(',');
    const resultado = await importarEuropa({ ligas, chave });
    if (resultado.falhasEscudos || resultado.elencosInvalidos || resultado.clubesSemPar) process.exitCode = 1;
  } catch (e) {
    console.error(chave ? e.message.replaceAll(chave, '[omitida]') : e.message);
    process.exitCode = 1;
  }
}
