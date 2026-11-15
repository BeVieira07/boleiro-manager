// Baixa da API-Football os clubes estrangeiros da fase de grupos da Libertadores e da Sul-Americana (#133, #134).
// Uso: npm run continentais   (lê API_FOOTBALL_KEY do .env; --temporada=2024, a mais nova do plano gratuito)
// Os clubes estrangeiros são só da IA e só disputam essas copas: não entram nas séries nem na escolha de clube.
// As respostas ficam em data/continentais-<ano>-raw.json (ignorado pelo git): rodar de novo não gasta pedidos já feitos.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { DADOS_PADRAO } from '../core/dados-padrao.mjs';

const flag = n => (process.argv.find(a => a.startsWith(`--${n}=`)) || '').split('=')[1];
const KEY = process.env.API_FOOTBALL_KEY, SEASON = parseInt(flag('temporada') || '2024', 10);
if (!KEY) { console.error('Coloque API_FOOTBALL_KEY no .env'); process.exit(1) }
const DELAY = 7000; // plano gratuito: 10 pedidos por minuto
const TORNEIOS = [{ id: 'libertadores', liga: 13, nome: 'Libertadores', base: 72 }, { id: 'sulamericana', liga: 11, nome: 'Sul-Americana', base: 66 }];
const POS = { Goalkeeper: 'G', Defender: 'D', Midfielder: 'M', Attacker: 'A' };
const CORRIGIR = { 225: { id: 2356, name: 'Nacional', logo: 'https://media.api-sports.io/football/teams/2356.png' } }; // Club Nacional (Uruguai)

const RAW = `data/continentais-${SEASON}-raw.json`, OUT = `data/continentais-${SEASON}.json`;
const raw = existsSync(RAW) ? JSON.parse(readFileSync(RAW, 'utf8')) : { season: SEASON, standings: {}, squads: {} };
const salvarRaw = () => writeFileSync(RAW, JSON.stringify(raw));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pedidos = 0;
async function api(path) {
  if (pedidos++) await sleep(DELAY);
  const res = await fetch('https://v3.football.api-sports.io' + path, { headers: { 'x-apisports-key': KEY } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json(), errs = Array.isArray(j.errors) ? j.errors : Object.values(j.errors || {});
  if (errs.length) throw new Error(errs.join(' | '));
  return j;
}

const noJogo = new Set(DADOS_PADRAO.clubs.map(c => c.id));
const clubs = [];
for (const t of TORNEIOS) {
  if (!raw.standings[t.id]) { raw.standings[t.id] = (await api(`/standings?league=${t.liga}&season=${SEASON}`)).response; salvarRaw() }
  const grupos = raw.standings[t.id]?.[0]?.league?.standings || [];
  const linhas = grupos.flat(), media = linhas.reduce((s, r) => s + r.points, 0) / (linhas.length || 1);
  console.log(`${t.nome} ${SEASON}: ${grupos.length} grupos, ${linhas.length} clubes`);
  for (const r of linhas) {
    // a classificação da API às vezes aponta outro clube de mesmo nome (o "Nacional" de 2024 era o da Madeira, id 225)
    if (CORRIGIR[r.team.id]) r.team = { ...r.team, ...CORRIGIR[r.team.id] };
    if (noJogo.has('c' + r.team.id)) continue; // já está no jogo (clubes brasileiros)
    if (!raw.squads[r.team.id]) {
      try { raw.squads[r.team.id] = (await api(`/players/squads?team=${r.team.id}`)).response; salvarRaw() }
      catch (e) { console.log(`  ${r.team.name}: ${e.message}`); continue }
    }
    const players = (raw.squads[r.team.id]?.[0]?.players || []).filter(p => POS[p.position])
      .map(p => ({ id: 'p' + p.id, name: p.name, age: p.age || 24, pos: POS[p.position], number: p.number }));
    // shortcut: força pela campanha na fase de grupos de SEASON; trocar por um ranking (Conmebol) se ficar estranho
    const strength = Math.max(60, Math.min(80, Math.round(t.base + (r.points - media) * 0.6)));
    clubs.push({ id: 'c' + r.team.id, name: r.team.name, short: r.team.name.slice(0, 3).toUpperCase(), color: '#335', logo: r.team.logo,
      strength, torneio: t.id, grupo: r.group, pontos: r.points, players });
    console.log(`  ${r.team.name}: ${players.length} jogadores, força ${strength}`);
  }
}
writeFileSync(OUT, JSON.stringify({ source: 'api-football', season: SEASON, createdAt: new Date().toISOString(), clubs }, null, 2));
console.log(`\nPronto: ${clubs.length} clubes estrangeiros em ${OUT} (${pedidos} pedidos nesta execução).`);
