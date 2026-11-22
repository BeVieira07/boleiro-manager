/* ================= landing page (#316): a primeira tela ao abrir o site =================
   Apresenta o jogo e leva ao menu (Continuar, Novo jogo, jogos salvos) ou direto à escolha de clube. */
import { DIVS, divOf } from '../../core/estado.mjs';
import { esc } from '../../core/utils.mjs';
import { onlineConfigurado, usuarioAtual } from './conta.mjs';
import { MAX_TECNICOS, getData, ui } from '../estado.mjs';
import { icone } from '../icones.mjs';
import { crest } from '../partida/partida.mjs';
import { novoJogo } from './saves.mjs';
import { estrelas, selecionarClubeInicio } from './escolha.mjs';

const ITENS = [
  ['Séries A, B, C e D', '80 clubes em quatro divisões, pontos corridos com ida e volta. No fim do ano sobem 4 e caem 4 entre séries vizinhas, e quanto mais baixa a série, menor a cota de TV e o caixa.'],
  ['Copas no meio do caminho', 'Estadual na pré-temporada, Copa do Brasil no mata-mata, e Libertadores ou Sul-Americana para quem se classifica.'],
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
  ['Onde ficam os meus jogos salvos?', 'No próprio navegador, até 5 jogos. Com uma conta, eles também vão para a nuvem e dá para continuar em outro aparelho. Em Configurações você exporta um save como cópia de segurança.'],
  ['Preciso criar conta?', 'Não para jogar sozinho. A conta só serve para guardar os jogos na nuvem e para as ligas online com amigos.'],
  ['Os jogadores são de verdade?', 'Os elencos vêm do Brasileirão 2024, e o overall de cada jogador sai das notas da temporada real. O jogo é um projeto independente, sem ligação com a CBF, os clubes ou os jogadores.'],
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

function cartaoClube(c) {
  return `<li><button type="button" class="lp-clube" data-acao="escolherClubeLanding|${esc(c.id)}">
    <span class="lp-clube-faixa"><span>${esc(c.uf || '')}</span></span>${crest(c, 'm')}
    <b>${esc(c.name)}</b><span class="muted">${DIVS[divOf(c)] || ''} · ${estrelas(c.strength)}</span>
    <span class="sr">: começar um jogo novo com este clube</span></button></li>`;
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
    <button type="button" class="btn sec lp-topo-jogar" data-acao="go|menu">Jogar agora</button>
  </div></header>

  <section class="lp-heroi" aria-labelledby="lp-titulo"><div class="lp-largura lp-heroi-grade">
    <div>
      <p class="lp-sobre">Manager de futebol no navegador</p>
      <h1 id="lp-titulo">Assuma o clube. <span>Aguente a diretoria.</span></h1>
      <p class="lp-texto">Escolha um dos 80 clubes das Séries A, B, C e D, arme o time, negocie no mercado e jogue a temporada inteira. Abre no navegador, no computador ou no celular, sem instalar nada.</p>
      <div class="lp-acoes">${jogar('Jogar a rodada 1', 'novoJogo')}<a class="btn sec lp-ver" href="#lp-jogo">Ver o que tem no jogo</a></div>
      <p class="lp-nota">Seus jogos ficam salvos no navegador. Criar conta é opcional e só serve para a nuvem e as ligas online.</p>
    </div>
    ${previa(palmeiras, bragantino, tabela.filter(Boolean))}
  </div></section>

  <section class="lp-secao" id="lp-jogo" aria-labelledby="lp-jogo-t"><div class="lp-largura lp-duas">
    <div><p class="lp-sobre">O jogo</p><h2 id="lp-jogo-t">Uma temporada inteira no seu colo</h2>
      <p class="lp-texto">Do estadual à última rodada: Brasileirão, copas, mercado e as contas do clube. Você decide, a rodada mostra se deu certo.</p></div>
    <ol class="lp-itens">${ITENS.map(([t, d], i) => `<li><span class="lp-num">0${i + 1}</span><div><h3>${t}</h3><p>${d}</p></div></li>`).join('')}</ol>
  </div></section>

  <section class="lp-secao lp-escuro" aria-labelledby="lp-esc-t"><div class="lp-largura lp-duas lp-escalacao">
    ${campo()}
    <div><p class="lp-sobre">Escalação</p><h2 id="lp-esc-t">Toque no titular, toque no reserva. Pronto.</h2>
      <p class="lp-texto">A troca acontece no próprio campo. Mudou de 4-4-2 para 4-3-3? As vagas se ajeitam e o botão "Escalar melhores" monta o time pela força.</p>
      <p class="lp-texto">Os elencos vêm do Brasileirão 2024, e o overall de cada jogador sai das notas da temporada real, de 40 a 95.</p></div>
  </div></section>

  <section class="lp-secao" id="lp-clubes" aria-labelledby="lp-clubes-t"><div class="lp-largura">
    <div class="lp-cab-secao"><div><p class="lp-sobre">80 clubes</p><h2 id="lp-clubes-t">Do Maracanã ao Barradão</h2>
      <p class="lp-texto">Cada clube começa com força, caixa e cobrança diferentes. Pegar um gigante é mais fácil; subir com um clube da Série D é outra história.</p></div>
      <button type="button" class="btn sec" data-acao="novoJogo">Escolher meu clube</button></div>
    <ul class="lp-clubes">${fortes.slice(0, 8).map(cartaoClube).join('')}</ul>
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
    ${jogar('Jogar agora', 'novoJogo')}
  </div></section>

  <footer class="lp-rodape"><div class="lp-largura">
    <p><b>Boleiro Manager</b> · projeto independente, sem ligação com a CBF, os clubes ou os jogadores.</p>
    <p class="lp-rodape-links"><button type="button" class="lp-link" data-acao="go|menu">Jogar</button><a href="https://github.com/BeVieira07/boleiro-manager" rel="noopener" target="_blank">Código no GitHub</a></p>
  </div></footer>
  </div>`;
}

/** Cartão de clube da landing: abre a escolha de clube do jogo novo já com ele marcado. */
export function escolherClubeLanding(id) {
  novoJogo();
  if (ui.view === 'inicio') selecionarClubeInicio(id); // com 5 jogos salvos, novoJogo só avisa e não abre a escolha
}
