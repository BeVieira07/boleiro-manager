// Carregado antes de cada arquivo de teste (npm test: node --import): o Math.random tem semente fixa, então a semente
// de cada jogo novo (novaSemente) é sempre a mesma e um teste passa ou falha sempre igual. Não é um teste.
export const sorteioFixo = s => { let a = s; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } };
Math.random = sorteioFixo(20261115);
