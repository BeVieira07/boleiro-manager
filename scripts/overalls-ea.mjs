// #441: overalls do EA SPORTS FC 27 nos jogadores do jogo.
// Uso: node scripts/overalls-ea.mjs --ea=<caminho do players.csv>   e depois   npm run dados:padrao
// Casa os jogadores do jogo (Brasileirão, estrangeiros das copas e europeus) com a base pelo nome, idade e clube
// (o mesmo casamento de scripts/comparar-overall.mjs, #433) e grava data/overalls-ea.json: id do jogador -> overall da EA.
// npm run dados:padrao aplica esse overall acima de tudo. Quem não casa fica com o overall calculado.
// Os dados são da Electronic Arts (base do Kaggle, só para análise e sem uso comercial): tudo fica neste arquivo, para
// sair de uma vez se for preciso. Sem ele, o jogo volta às fórmulas calibradas da #433.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { comparar, jogadoresDoJogo, lerReferencia } from './comparar-overall.mjs';

export const ARQUIVO_EA = 'data/overalls-ea.json';

/** {fonte, captura, jogadores: {id: overall}} a partir das linhas do CSV da EA. */
export function overallsEA(referencia, jogadores = jogadoresDoJogo()) {
  const pares = comparar(jogadores, referencia);
  const captura = [...new Set(referencia.filter(p => p.gender === "Men's Football").map(p => p.snapshot_date))].sort().at(-1) ?? null;
  const ovr = Object.fromEntries(pares.map(p => [p.id, Number(p.nota)]).filter(([, n]) => Number.isInteger(n) && n >= 1 && n <= 99)
    .sort(([a], [b]) => a.localeCompare(b)));
  return {
    fonte: 'EA SPORTS FC 27 Player Ratings (Kaggle, MikeDPad), da API pública de ratings da EA. Dados da Electronic Arts; base para análise, sem uso comercial.',
    captura, jogadores: ovr
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const arg = process.argv.slice(2).find(a => a.startsWith('--ea='));
    if (!arg) throw new Error('Uso: node scripts/overalls-ea.mjs --ea=<caminho do players.csv>');
    const dados = overallsEA(lerReferencia(readFileSync(arg.slice(5), 'utf8')));
    const jogadores = jogadoresDoJogo(), porLiga = {};
    for (const p of jogadores) { const k = p.liga; porLiga[k] ??= [0, 0]; porLiga[k][0]++; if (dados.jogadores[p.id] != null) porLiga[k][1]++ }
    writeFileSync(ARQUIVO_EA, JSON.stringify(dados, null, 1) + '\n');
    console.log(`${ARQUIVO_EA}: ${Object.keys(dados.jogadores).length} jogadores com o overall da EA (captura ${dados.captura}).`);
    console.log(Object.entries(porLiga).map(([l, [n, ea]]) => `${l} ${ea}/${n}`).join(' · '));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
