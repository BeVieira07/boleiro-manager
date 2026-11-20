import { faixaReputacao } from '../core/carreira.mjs';
import { DIVS, clubById, tec } from '../core/estado.mjs';
import { esc } from '../core/utils.mjs';
import { barra } from './componentes.mjs';
import { icone } from './icones.mjs';
import { crest } from './partida.mjs';

const SAIDAS = { demitido: 'Demitido', pediu: 'Pediu demissão' };
const dataDaPassagem = ({ s, r }) => `${s} · ${r ? `após a ${r}ª rodada` : 'início da temporada'}`;

function clube(id, nome) {
  const c = clubById(id);
  return `<span class="club">${c ? crest(c) : ''}${esc(nome ?? c?.name ?? 'Clube desconhecido')}</span>`;
}

function salaDeTrofeus(titulos) {
  const grupos = new Map();
  for (const t of [...titulos].sort((a, b) => b.s - a.s)) {
    const id = `${t.comp}:${t.nome}`;
    if (!grupos.has(id)) grupos.set(id, []);
    grupos.get(id).push(t);
  }
  return `<section class="card"><h2 class="t3"><span class="club">${icone('trofeu')} Sala de troféus</span></h2>
    ${grupos.size ? `<div class="carreira-trofeus">${[...grupos.values()].map(lista => `<div>
      <h3>${esc(lista[0].nome)}</h3>
      <ul>${lista.map(t => `<li>${clube(t.clube)} <span class="pill">${t.s}</span></li>`).join('')}</ul>
    </div>`).join('')}</div>` : '<p class="muted">Nenhum título ainda.</p>'}
  </section>`;
}

function tabela(titulo, colunas, linhas, vazio) {
  if (!linhas.length) return `<section class="card"><h2 class="t3">${titulo}</h2><p class="muted">${vazio}</p></section>`;
  return `<section class="card tabela-card"><h2 class="t3">${titulo}</h2>
    <div class="tw" tabindex="0" role="region" aria-label="${titulo}">
      <table><caption class="sr">${titulo}</caption>
        <thead><tr>${colunas.map(texto => `<th scope="col">${texto}</th>`).join('')}</tr></thead>
        <tbody>${linhas.join('')}</tbody>
      </table>
    </div>
  </section>`;
}

function passagem(p) {
  const situacao = p.ate ? SAIDAS[p.saida] ?? 'Passagem encerrada' : 'Clube atual';
  return `<tr><td>${clube(p.clube, p.nome)}</td><td>${dataDaPassagem(p.de)}</td>
    <td>${p.ate ? dataDaPassagem(p.ate) : 'Em andamento'}</td><td>${situacao}</td></tr>`;
}

function temporada(t) {
  const cumpriu = t.pos <= t.alvo;
  const meta = icone(cumpriu ? 'ok' : 'fechar', { rotulo: cumpriu ? 'Meta cumprida' : 'Meta não cumprida' });
  return `<tr><td>${t.s}</td><td>${clube(t.clube, t.nome)}</td><td>${DIVS[t.div] ?? '—'}</td><td>${t.pos}º</td>
    <td><span class="club">${t.alvo}º ou melhor <span class="tag ${cumpriu ? 'ok' : 'erro'}">${meta}</span></span></td></tr>`;
}

export function vTecnico() {
  const t = tec(), { rotulo, nivel } = faixaReputacao(t);
  const { titulos = [], passagens = [], temporadas = [] } = t.carreira ?? {};
  return `<section class="card"><div class="card-topo"><h2 class="t3">${esc(t.nome)}</h2>
    ${t.demitido ? '<button type="button" class="btn sec" data-acao="go|carreira">Ver propostas de clubes</button>' : ''}</div>
    <p>Reputação <strong>${rotulo}</strong></p>${barra(nivel * 20)}
  </section>
  ${salaDeTrofeus(titulos)}
  ${tabela('Passagens por clube', ['Clube', 'Início', 'Fim', 'Situação'], [...passagens].reverse().map(passagem), 'Nenhuma passagem registrada.')}
  ${tabela('Temporadas', ['Temporada', 'Clube', 'Série', 'Posição', 'Meta'], [...temporadas].reverse().map(temporada), 'Nenhuma temporada encerrada ainda.')}`;
}
