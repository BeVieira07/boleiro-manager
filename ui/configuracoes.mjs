/* ================= configurações (#106) =================
   Preferências deste navegador (localStorage), por aparelho, para todos os saves. Nada disso é regra do jogo: só muda
   como ele é mostrado, então não vai para o save nem para a liga. */
import { S, divOf, table, userClub } from '../core/estado.mjs';
import { esc } from '../core/utils.mjs';
import { render } from './telas.mjs';
import { store } from './utils.mjs';

export const PREFS_KEY = 'boleiro_prefs';
// milissegundos por minuto de jogo ao vivo
export const VELOCIDADES = { lenta: 110, normal: 55, rapida: 22 };
export const CATEGORIAS = { mercado: 'Mercado e contratos', lesoes: 'Lesões e suspensões', base: 'Categorias de base', forma: 'Forma dos jogadores', diretoria: 'Diretoria e finanças', outros: 'Outras (campeonato, aposentadorias…)' };
const PADRAO = { velocidade: 'normal', aoVivo: 'sempre', confirmar: true, noticias: Object.fromEntries(Object.keys(CATEGORIAS).map(k => [k, true])) };

export function prefs() {
  const p = store.get(PREFS_KEY) || {};
  return { ...PADRAO, ...p, noticias: { ...PADRAO.noticias, ...(p.noticias || {}) } };
}
/** data-mudar="mudarPref|chave" (ou "noticias.categoria"): select manda o valor, caixa de marcar manda o checked. */
export function mudarPref(chave, valor, ev) {
  const p = prefs(), alvo = ev && ev.target, v = alvo && alvo.type === 'checkbox' ? !!alvo.checked : valor;
  const [a, b] = String(chave).split('.');
  if (b) { if (b in CATEGORIAS) p[a][b] = v } else if (a in PADRAO) p[a] = v;
  store.set(PREFS_KEY, p);
  render();
}

/** Jogo decisivo: contra um dos 4 primeiros da tabela da sua série, ou nas 5 últimas rodadas. Chamada depois da rodada. */
export function jogoDecisivo(g) {
  const uc = userClub(), adv = g.h === uc.id ? g.a : g.h, pos = table(divOf(uc)).findIndex(x => x.id === adv);
  return (pos >= 0 && pos < 4) || S.round > S.fixtures.length - 5;
}
export function verAoVivo(g) { const v = prefs().aoVivo; return v === 'sempre' || (v === 'decisivos' && jogoDecisivo(g)) }

/** Categoria de uma notícia, pelo texto (as notícias são só texto). */
export function categoriaNoticia(t) {
  if (/lesionou|expuls|suspens/i.test(t)) return 'lesoes';
  if (/da base|na base|à base|base e foi/i.test(t)) return 'base';
  if (/grande fase|má fase/i.test(t)) return 'forma';
  if (/diretoria|demitiu|caixa negativo/i.test(t)) return 'diretoria';
  if (/vendid|contratad|recusou|emprest|proposta|ofereceu|opção de compra|negócio|contrato|renovou|voltou ao/i.test(t)) return 'mercado';
  return 'outros';
}
export const noticiaVisivel = n => prefs().noticias[categoriaNoticia(n.t)] !== false;

export function vConfig() {
  const p = prefs(), opcoes = (lista, atual) => lista.map(([v, r]) => `<option value="${v}"${v === atual ? ' selected' : ''}>${r}</option>`).join('');
  const marca = (chave, rotulo, ligado) => `<label class="opcao"><input type="checkbox" data-mudar="mudarPref|${chave}"${ligado ? ' checked' : ''}>${esc(rotulo)}</label>`;
  return `${S ? '' : '<h1>Configurações</h1>'}<div class="config">
  <section class="card"><h3>Jogo ao vivo</h3>
   <div class="config-campo"><label for="cfgVelocidade">Velocidade</label>
    <select id="cfgVelocidade" data-mudar="mudarPref|velocidade">${opcoes([['lenta', 'Lenta'], ['normal', 'Normal'], ['rapida', 'Rápida']], p.velocidade)}</select></div>
   <div class="config-campo"><label for="cfgAoVivo">Ver os jogos do seu clube ao vivo</label>
    <select id="cfgAoVivo" data-mudar="mudarPref|aoVivo">${opcoes([['sempre', 'Sempre'], ['decisivos', 'Só os decisivos'], ['nunca', 'Nunca (direto para o resultado)']], p.aoVivo)}</select>
    <p class="muted">Decisivos: contra um dos 4 primeiros da tabela, ou nas 5 últimas rodadas. Vale também para o replay da liga.</p></div>
  </section>
  <section class="card"><h3>Confirmações</h3>
   ${marca('confirmar', 'Pedir confirmação na venda rápida, na venda de jovens da base e ao simular até o fim', p.confirmar)}
   <p class="muted">Excluir um jogo salvo sempre pede confirmação.</p>
  </section>
  <section class="card"><h3>Notícias no Painel do clube</h3>
   <fieldset class="config-grupo"><legend class="sr">Categorias de notícias que aparecem</legend>
    ${Object.entries(CATEGORIAS).map(([k, r]) => marca('noticias.' + k, r, p.noticias[k])).join('')}</fieldset>
  </section>
  <p class="muted">As configurações ficam neste navegador e valem para todos os seus jogos.</p></div>`;
}
