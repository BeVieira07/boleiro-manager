/* ================= landing page (#316): a primeira tela ao abrir o site =================
   Apresenta o jogo e leva ao menu (Continuar, Novo jogo, jogos salvos) ou direto à escolha de clube. */
import { BRASIL } from '../../core/campeonatos.mjs';
import { corOk } from '../../core/dados.mjs';
import { DIVS, divOf, divsOf } from '../../core/estado.mjs';
import { esc, money } from '../../core/utils.mjs';
import { onlineConfigurado, usuarioAtual } from './conta.mjs';
import { MAX_TECNICOS, dadosDoNovoJogo, getData, ui } from '../estado.mjs';
import { icone } from '../icones.mjs';
import { crest } from '../partida/partida.mjs';
import { novoJogo } from './saves.mjs';
import { clubesPreparados, estrelas, expectativa, paisDoNovoJogo, selecionarPais, seletorPaises, statusClubes } from './escolha.mjs';
import { render } from '../telas.mjs';

const ITENS = [
  ['Séries A, B, C e D', 'No Brasil, 80 clubes disputam quatro divisões em pontos corridos, com jogos de ida e volta. Cada país tem suas próprias regras de acesso e rebaixamento.'],
  ['Copas no Brasil', 'Estadual na pré-temporada, Copa do Brasil no mata-mata, e Libertadores ou Sul-Americana para quem se classifica.'],
  ['O time no campo', 'Escolha a formação, troque titulares e reservas direto no gramado e fique de olho na energia de quem joga toda rodada.'],
  ['Mercado e caixa', 'Compre, venda e empreste jogadores sem estourar o caixa. Bilheteria, TV e premiação entram; salários e contratações saem.'],
  ['Diretoria e carreira', 'A diretoria cobra a meta da temporada. Perdeu a confiança, perdeu o cargo, mas outros clubes podem mandar proposta.']
];
// campo de exemplo da seção Escalação: [posição, nome], do ataque para o goleiro
const CAMPO = [
  [['ATA', 'Flaco López'], ['ATA', 'Estêvão']],
  [['MEI', 'F. Anderson'], ['MEI', 'Veiga', true], ['MEI', 'R. Ríos'], ['MEI', 'A. Moreno']],
  [['LE', 'Piquerez'], ['ZAG', 'Murilo'], ['ZAG', 'G. Gómez'], ['LD', 'Mayke']],
  [['GOL', 'Weverton']]
];
const PERGUNTAS = [
  ['Precisa instalar alguma coisa?', 'Não. O jogo abre no navegador, no computador ou no celular.'],
  ['Onde ficam os meus jogos salvos?', 'No próprio navegador, até 5 jogos. Com uma conta, eles também vão para a nuvem e dá para continuar em outro aparelho.'],
  ['Preciso criar conta?', 'Não para jogar sozinho. A conta só serve para guardar os jogos na nuvem e para as ligas online com amigos.'],
  ['Os jogadores são de verdade?', 'Os elencos são baseados em temporadas reais dos clubes. O jogo é um projeto independente, sem ligação com as federações, os clubes ou os jogadores.'],
  ['Quantas pessoas podem jogar juntas?', `No mesmo computador, até ${MAX_TECNICOS} técnicos, um por clube. Na liga online, até 20, cada um no seu aparelho.`]
];

const jogar = (rotulo, acao, extra = '') => `<button type="button" class="lp-jogar${extra}" data-acao="${acao}">${icone('play', { tam: 16 })}<span>${rotulo}</span></button>`;

function previa(casa, fora, clubes) {
  const tabela = clubes.map((c, i) => `<li${i === 1 ? ' class="lp-meu"' : ''}><span>${i + 1} ${esc(c.name)}</span><b>${16 - i - (i > 1)}</b></li>`).join('');
  return `<figure class="lp-previa">
    <div class="lp-tela" aria-hidden="true">
      <div class="lp-tela-abas"><span class="lp-tela-marca"></span><span class="on">Clube</span><span>Time</span><span>Temporada</span><span>Mercado</span></div>
      <div class="lp-tela-corpo">
        <div class="lp-tela-painel"><div><b class="lp-tela-titulo">Painel do clube</b>
          <dl><div><dt>Rodada</dt><dd>7<small>/38</small></dd></div><div><dt>Posição</dt><dd>2º</dd></div><div><dt>Caixa</dt><dd class="gold">R$ 38,8 mi</dd></div></dl></div>
          <span class="lp-tela-botao">${icone('play', { tam: 12 })}Jogar rodada 7</span></div>
        <div class="lp-tela-grade">
          <div class="lp-tela-jogo"><small>Próximo jogo</small><div>${crest(casa, 'm')}<b>x</b>${crest(fora, 'm')}</div>
            <div class="lp-tela-nomes"><span>${esc(casa.name)}</span><span>${esc(fora.name)}</span></div></div>
          <div class="lp-tela-tabela"><small>Classificação</small><ol>${tabela}</ol></div>
        </div>
      </div>
    </div>
    <figcaption>O Painel do clube: rodada, posição, caixa e o próximo jogo.</figcaption>
  </figure>`;
}

function campo() {
  const carta = ([pos, nome, sel]) => `<div class="carta${sel ? ' sel' : ''}"><span class="carta-vaga">${pos}</span><span class="carta-nome">${esc(nome)}</span></div>`;
  return `<div class="campo mini lp-campo" role="img" aria-label="Exemplo de escalação num 4-4-2, com um meia escolhido para a troca">
    ${CAMPO.map(l => `<div class="linha">${l.map(carta).join('')}</div>`).join('')}</div>`;
}

/* #338: seção de clubes, com o favorito contra o azarão e o álbum de cada série */
// a cor do clube vai numa variável CSS (é dado do clube, como no escudo); cor inválida cai no verde do tema
const corDo = c => corOk(c.color) ? ` style="--cor:${c.color}"` : '';
const porForca = (a, b) => b.strength - a.strength || a.name.localeCompare(b.name, 'pt-BR');

function cartaoDuelo(c, rotulo, clubes, pais) {
  return `<article class="lp-duelo-card"${corDo(c)} aria-labelledby="lp-duelo-${esc(c.id)}">
    <div class="lp-duelo-faixa"><span class="lp-duelo-rotulo">${rotulo}</span><span class="lp-uf">${esc(c.uf || '')}</span></div>
    <div class="lp-duelo-corpo">${crest(c, 'g')}
      <h3 id="lp-duelo-${esc(c.id)}">${esc(c.name)}</h3>
      <p class="muted">${esc(DIVS[divOf(c)])} · ${esc(pais)} · ${estrelas(c.strength)}</p>
      <dl class="lp-duelo-dados"><div><dt>Força</dt><dd>${c.strength}</dd></div><div><dt>Caixa inicial</dt><dd>${money(c.balance)}</dd></div></dl>
      <dl class="lp-duelo-meta"><div><dt>A diretoria quer</dt><dd>${esc(expectativa(c, clubes))}</dd></div></dl>
      <button type="button" class="btn sec" data-acao="escolherClubeLanding|${esc(c.id)}">Jogar com ${esc(c.name)}</button>
    </div>
  </article>`;
}

function album(clubes, series, serie) {
  const daSerie = clubes.filter(c => divOf(c) === serie).sort(porForca);
  const abas = series.map(s => {
    const n = clubes.filter(c => divOf(c) === s).length;
    return `<button type="button" class="lp-aba" data-acao="lpSerie|${s}" aria-pressed="${s === serie}">${esc(DIVS[s])} <small>${n}</small></button>`;
  }).join('');
  return `<div class="lp-album-topo"><h3 class="lp-album-titulo" id="lp-album-t">O álbum completo</h3>
      <div class="lp-abas" role="group" aria-label="Divisão do álbum">${abas}</div></div>
    <ol class="lp-album" aria-labelledby="lp-album-t">${daSerie.map((c, i) => `<li><button type="button" class="lp-figurinha"${corDo(c)} data-acao="escolherClubeLanding|${esc(c.id)}">
      <span class="lp-figurinha-faixa"><span class="lp-pos">${i + 1}</span></span>${crest(c, 'm')}
      <b>${esc(c.name)}</b>${estrelas(c.strength)}<span class="sr">: começar um jogo novo com este clube</span></button></li>`).join('')}</ol>
    <p class="muted lp-album-nota">Toque num escudo para começar um jogo novo com o clube.</p>`;
}

function secaoClubes() {
  const { pais, serie } = ui.albumClubes;
  const seletor = seletorPaises(pais, 'lpPais');
  const clubes = clubesPreparados(pais);
  if (!clubes.length) return seletor + statusClubes(ui.albumClubes, 'lpPais');
  const series = divsOf(clubes);
  const ordem = [...clubes].sort(porForca);
  const favorito = ordem[0], azarao = pais === BRASIL ? ordem.findLast(c => divOf(c) === 'D') ?? ordem.at(-1) : ordem.at(-1);
  const ativa = series.includes(serie) ? serie : series[0];
  return `${seletor}<div class="lp-duelo">${cartaoDuelo(favorito, 'O favorito', clubes, pais)}
      <div class="lp-duelo-x" aria-hidden="true"><b>X</b><span>${favorito.strength - azarao.strength} pontos de força de diferença</span></div>
      ${cartaoDuelo(azarao, 'O azarão', clubes, pais)}</div>
    <p class="sr">${favorito.strength - azarao.strength} pontos de força de diferença entre ${esc(favorito.name)} e ${esc(azarao.name)}.</p>
    ${album(clubes, series, ativa)}`;
}

export const lpPais = pais => selecionarPais(ui.albumClubes, pais, 'landing');

/** Aba do álbum de clubes da landing. */
export function lpSerie(s) {
  if (!divsOf(clubesPreparados(ui.albumClubes.pais)).includes(s)) return;
  ui.albumClubes.serie = s;
  render();
}

function ligaOnline() {
  if (!onlineConfigurado()) return '<p class="muted">As ligas online estão indisponíveis agora. No mesmo computador dá para jogar normalmente.</p>';
  if (usuarioAtual()) return `<div class="row"><button type="button" class="btn" data-acao="abrirLigas">${icone('liga', { tam: 16 })}Abrir as ligas</button></div>`;
  return `<div class="row"><button type="button" class="btn lp-google" data-acao="entrarComGoogle">Entrar com Google</button>
    <button type="button" class="btn sec" data-acao="go|menu">Entrar com e-mail</button></div>`;
}

export function vLanding() {
  const fortes = [...(getData().clubs || [])].filter(c => divOf(c) === 'A').sort((a, b) => b.strength - a.strength);
  const palmeiras = fortes.find(c => c.short === 'PAL') ?? fortes[0], bragantino = fortes.find(c => c.short === 'RBB') ?? fortes[1];
  const tabela = [fortes.find(c => c.short === 'FLA') ?? fortes[2], palmeiras, fortes.find(c => c.short === 'BOT') ?? fortes[3], fortes.find(c => c.short === 'FOR') ?? fortes[4]];
  return `<div class="lp">
  <header class="lp-topo"><div class="lp-largura">
    <span class="lp-marca" role="img" aria-label="Boleiro Manager"><img src="img/figma/marca-jogo.svg" alt="" width="34" height="34"><span aria-hidden="true"><b>Boleiro</b><small>Manager</small></span></span>
    <nav class="lp-links" aria-label="Seções"><a href="#lp-jogo">O jogo</a><a href="#lp-clubes">Clubes</a><a href="#lp-amigos">Com amigos</a><a href="#lp-perguntas">Perguntas</a></nav>
    <div class="lp-topo-acoes"><button type="button" class="btn sec" data-acao="go|menu">Jogar agora</button>
    ${onlineConfigurado() && !usuarioAtual() ? '<button type="button" class="btn" data-acao="abrirCadastro">Criar conta</button>' : ''}</div>
  </div></header>

  <section class="lp-heroi" aria-labelledby="lp-titulo"><div class="lp-largura lp-heroi-grade">
    <div>
      <p class="lp-sobre">Manager de futebol no navegador</p>
      <h1 id="lp-titulo">Assuma o clube. <span>Aguente a diretoria.</span></h1>
      <p class="lp-texto">Escolha um clube para comandar, arme o time, negocie no mercado e jogue a temporada inteira. Abre no navegador, no computador ou no celular, sem instalar nada.</p>
      <div class="lp-acoes">${jogar('Jogar agora', 'go|menu')}<a class="btn sec lp-ver" href="#lp-jogo">Ver o que tem no jogo</a></div>
      <p class="lp-nota">Seus jogos ficam salvos no navegador. Criar conta é opcional e só serve para a nuvem e as ligas online.</p>
    </div>
    ${previa(palmeiras, bragantino, tabela.filter(Boolean))}
  </div></section>

  <section class="lp-secao" id="lp-jogo" aria-labelledby="lp-jogo-t"><div class="lp-largura lp-duas">
    <div><p class="lp-sobre">O jogo</p><h2 id="lp-jogo-t">Uma temporada inteira no seu colo</h2>
      <p class="lp-texto">Prepare o time para a próxima rodada, negocie no mercado e cuide das contas do clube ao longo da temporada.</p></div>
    <ol class="lp-itens">${ITENS.map(([t, d], i) => `<li><span class="lp-num">0${i + 1}</span><div><h3>${t}</h3><p>${d}</p></div></li>`).join('')}</ol>
  </div></section>

  <section class="lp-secao lp-escuro" aria-labelledby="lp-esc-t"><div class="lp-largura lp-duas lp-escalacao">
    ${campo()}
    <div><p class="lp-sobre">Escalação</p><h2 id="lp-esc-t">Toque no titular, toque no reserva. Pronto.</h2>
      <p class="lp-texto">A troca acontece no próprio campo. Mudou de 4-4-2 para 4-3-3? As vagas se ajeitam e o botão "Escalar melhores" monta o time pela força.</p>
      <p class="lp-texto">O exemplo usa o elenco do Palmeiras no Brasileirão 2024.</p></div>
  </div></section>

  <section class="lp-secao" id="lp-clubes" aria-labelledby="lp-clubes-t"><div class="lp-largura">
    <div class="lp-cab-secao"><div><h2 id="lp-clubes-t">${ui.albumClubes.pais === BRASIL ? 'Do Maracanã ao Barradão' : `Clubes · ${esc(ui.albumClubes.pais)}`}</h2>
      <p class="lp-texto">Compare a força, o caixa inicial e a expectativa da diretoria antes de assumir o time.</p></div>
      <button type="button" class="btn sec" data-acao="escolherClubeLanding">Escolher meu clube</button></div>
    ${secaoClubes()}
  </div></section>

  <section class="lp-secao lp-escuro" id="lp-amigos" aria-labelledby="lp-amigos-t"><div class="lp-largura">
    <p class="lp-sobre">Com amigos</p><h2 id="lp-amigos-t">Ninguém joga a rodada antes de todo mundo confirmar</h2>
    <div class="lp-modos">
      <div class="card lp-modo"><h3>No mesmo computador</h3><p>Cada um assume um clube. O jogo mostra de quem é a vez, e a rodada só roda quando todos os técnicos confirmam a escalação.</p>
        <p class="lp-vez" aria-hidden="true">Vez de <b>Bernardo</b> <span class="tag ok">${icone('ok', { tam: 12 })} Lucas</span> <span class="tag">… Bernardo</span></p></div>
      <div class="card lp-modo"><h3>Liga online</h3><p>Crie uma liga e chame os amigos, cada um no seu aparelho. Para entrar, use a conta Google ou um e-mail e senha.</p>${ligaOnline()}</div>
    </div>
  </div></section>

  <section class="lp-secao" id="lp-perguntas" aria-labelledby="lp-perg-t"><div class="lp-largura lp-estreita">
    <p class="lp-sobre">Perguntas</p><h2 id="lp-perg-t">Antes do apito</h2>
    <div class="lp-perguntas">${PERGUNTAS.map(([p, r]) => `<details><summary>${p}</summary><p>${r}</p></details>`).join('')}</div>
  </div></section>

  <section class="lp-final" aria-labelledby="lp-final-t"><div class="lp-largura">
    <h2 id="lp-final-t">A rodada 1 <span>tá esperando</span></h2>
    <p class="lp-texto">Abre no navegador, escolhe o clube e começa. Leva menos tempo que o aquecimento.</p>
    ${jogar('Jogar agora', 'go|menu')}
  </div></section>

  <footer class="lp-rodape"><div class="lp-largura">
    <p><b>Boleiro Manager</b> · projeto independente, sem ligação com a CBF, os clubes ou os jogadores.</p>
    <p class="lp-rodape-links"><button type="button" class="lp-link" data-acao="go|menu">Jogar</button><a href="https://github.com/BeVieira07/boleiro-manager" rel="noopener" target="_blank">Código no GitHub</a></p>
  </div></footer>
  </div>`;
}

/** Cartão de clube da landing: abre a escolha de clube do jogo novo já com ele marcado. */
export function escolherClubeLanding(id) {
  const { pais, serie } = ui.albumClubes;
  const clube = id && clubesPreparados(pais).find(c => c.id === id);
  if (id && !clube) return;
  if (novoJogo({ pais, serie: clube ? divOf(clube) : serie, id }) && !dadosDoNovoJogo(pais)) return paisDoNovoJogo(pais);
}
