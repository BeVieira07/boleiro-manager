// Baixa a nota média e os minutos de cada jogador (API-Football, /players) para calibrar o overall.
// O plano gratuito só libera até a página 3 por consulta, então a busca é feita CLUBE A CLUBE e só na liga da série dele (cerca de 2 páginas por clube).
// Uso: npm run notas                         clubes das Séries A, B e C da temporada 2024
//      npm run notas -- --series=a,b,c,d     escolhe as séries (a Série D é opcional)
//      npm run notas -- --reserva=10         deixa 10 requisições do dia sem usar (padrão: 3)
// Gera: data/notas-<temporada>.json. É RETOMÁVEL: guarda o que já foi baixado e para sozinho quando a cota
// diária acaba. Rode de novo no dia seguinte para continuar de onde parou.
// Depois de baixar, rode `npm run dados:padrao` para aplicar as notas aos jogadores.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const args = process.argv.slice(2), flag = n => (args.find(a => a.startsWith('--' + n + '=')) || '').split('=')[1];
const KEY = process.env.API_FOOTBALL_KEY;
if (!KEY) { console.error('Coloque API_FOOTBALL_KEY no arquivo .env.'); process.exit(1); }
const SEASON = parseInt(flag('temporada') || '2024', 10);
const RESERVA = parseInt(flag('reserva') || '3', 10);
const SERIES = (flag('series') || 'a,b,c').toLowerCase().split(',').filter(s => 'abcd'.includes(s) && s);
const LIGA = { 71: 'A', 72: 'B', 75: 'C', 76: 'D' }; // só entram as estatísticas das séries nacionais
const ID_LIGA = { a: 71, b: 72, c: 75, d: 76 };
const ARQ = { a: `data/brasileirao-${SEASON}.json`, b: `data/brasileirao-serie-b-${SEASON}.json`, c: `data/brasileirao-serie-c-${SEASON}.json`, d: `data/brasileirao-serie-d-${SEASON}.json` };
const POS = { Goalkeeper: 'G', Defender: 'D', Midfielder: 'M', Attacker: 'A' };
const DELAY = 7000; // plano gratuito: 10 requisições/minuto

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function api(path) {
  const res = await fetch('https://v3.football.api-sports.io' + path, { headers: { 'x-apisports-key': KEY } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  const errs = Array.isArray(j.errors) ? j.errors : Object.values(j.errors || {});
  if (errs.length) throw new Error(errs.join(' | '));
  return j;
}

const st = (await api('/status')).response.requests;
let restam = st.limit_day - st.current - RESERVA;
console.log(`Cota de hoje: ${st.current}/${st.limit_day} usadas. Posso fazer ${Math.max(0, restam)} requisições (reserva de ${RESERVA}).`);
mkdirSync('data', { recursive: true });
const file = `data/notas-${SEASON}.json`;
const d = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { season: SEASON, times: {}, jogadores: {} };

// junta as linhas de estatística (um jogador pode ter passado por 2 clubes ou 2 séries no ano)
function junta(it, tid, serie, guardarParticipacao) {
  const id = String(it.player.id);
  const j = d.jogadores[id] || (d.jogadores[id] = { n: it.player.name, p: null, L: {} });
  for (const x of it.statistics || []) {
    const L = LIGA[x.league?.id]; if (!L) continue;
    const min = x.games?.minutes || 0, r = parseFloat(x.games?.rating) || 0;
    if (guardarParticipacao && L === serie && String(x.team?.id) === tid) {
      const t = ((j.T ||= {})[tid] ||= { m: 0, a: 0 });
      t.m += min; t.a += x.games?.appearences || 0;
    }
    const e = j.L[L] || (j.L[L] = { m: 0, a: 0, g: 0, s: 0, r: 0 });
    e.r = (e.m + min) ? Math.round((e.r * e.m + r * min) / (e.m + min) * 1000) / 1000 : 0; // média ponderada pelos minutos
    e.m += min; e.a += x.games?.appearences || 0; e.g += x.goals?.total || 0; e.s += x.goals?.assists || 0;
    j.p = j.p || POS[x.games?.position];
  }
}

let parou = false;
outer: for (const s of SERIES) {
  if (!existsSync(ARQ[s])) { console.log(`Sem ${ARQ[s]}, pulando a Série ${s.toUpperCase()}.`); continue; }
  const clubes = JSON.parse(readFileSync(ARQ[s], 'utf8')).clubs;
  for (const c of clubes) {
    const tid = c.id.replace(/^c/, ''), t = d.times[tid] || (d.times[tid] = { next: 1, total: null, ok: false, nome: c.name, participacaoPorClube: true });
    while (!t.ok) {
      if (restam <= 0) { console.log(`Cota do dia acabou (${Object.values(d.times).filter(x => x.ok).length} clubes prontos). Rode de novo amanhã.`); parou = true; break outer; }
      try {
        const j = await api(`/players?team=${tid}&league=${ID_LIGA[s]}&season=${SEASON}&page=${t.next}`);
        restam--; t.total = j.paging.total;
        j.response.forEach(it => junta(it, tid, s.toUpperCase(), t.participacaoPorClube));
        t.next++; t.ok = t.next > t.total;
        if (t.total > 3 && !t.ok && t.next > 3) { console.log(`  ${c.name}: ${t.total} páginas, mas o plano só libera 3. Ficou parcial.`); t.ok = true; }
        writeFileSync(file, JSON.stringify(d));
        console.log(`Série ${s.toUpperCase()} · ${c.name}: página ${t.next - 1}/${t.total} (${Object.keys(d.jogadores).length} jogadores no total). Restam ${restam} requisições hoje.`);
      } catch (e) {
        console.log(`${c.name}: ${e.message}`); writeFileSync(file, JSON.stringify(d)); parou = true; break outer;
      }
      await sleep(DELAY);
    }
  }
}
const prontos = Object.values(d.times).filter(x => x.ok).length;
console.log(parou ? `Parou com ${prontos} clubes prontos.` : `Concluído: ${prontos} clubes, ${Object.keys(d.jogadores).length} jogadores com nota.`);
