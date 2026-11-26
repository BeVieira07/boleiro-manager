import { POSD_CAMISA } from './posicoes.mjs';

const NUMEROS = Array.from({ length: 99 }, (_, i) => i + 1);
const CAMISAS_GOLEIRO = [1, 12, 22];

const valido = n => Number.isInteger(n) && n >= 1 && n <= 99;

function escolherCamisa(p, ocupados) {
  const livre = n => !ocupados.has(n);
  const preferida = p.pd === 'GOL' ? CAMISAS_GOLEIRO.find(livre)
    : NUMEROS.find(n => POSD_CAMISA[n] === p.pd && livre(n));
  return preferida ?? NUMEROS.find(livre);
}

/** Dá camisa à chegada sem mudar os números de quem já está no elenco. */
export function adicionarAoElenco(clube, p) {
  const ocupados = new Set(clube.players.map(x => x.number));
  if (!valido(p.number) || ocupados.has(p.number)) p.number = escolherCamisa(p, ocupados);
  clube.players.push(p);
}

/** Reserva primeiro as camisas válidas, na ordem do elenco, antes de preencher as vagas. */
export function numerarElenco(jogadores) {
  const ocupados = new Set(), pendentes = [];
  for (const p of jogadores) {
    if (valido(p.number) && !ocupados.has(p.number)) ocupados.add(p.number);
    else pendentes.push(p);
  }
  for (const p of pendentes) {
    p.number = escolherCamisa(p, ocupados);
    ocupados.add(p.number);
  }
}
