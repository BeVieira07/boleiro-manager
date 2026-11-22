import { POSD, atributosDe, posDNome, posDSigla } from '../../core/posicoes.mjs';

// Etiqueta da posição para as tabelas: sigla detalhada, com nome e atributos-chave na dica.
export function posTag(p){
  const at=atributosDe(p).slice(0,4).map(a=>`${a.nome} ${a.v}`).join(' · ');
  return `<span class="pos ${p.pos}" title="${posDNome(p)} — ${at}">${posDSigla(p)}</span>`;
}
