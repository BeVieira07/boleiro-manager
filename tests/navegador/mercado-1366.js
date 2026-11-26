// LARGURA=1366 node scripts/navegador.mjs http://localhost:3000/ tests/navegador/mercado-1366.js
(async () => {
  await import('/ui/main.mjs');
  const { criarJogo } = await import('/core/estado.mjs');
  const { DADOS_PADRAO } = await import('/core/dados-padrao.mjs');
  const { DADOS_EUROPA } = await import('/core/dados-europa.mjs');
  const { clubesEuropa, definirBaseEuropa } = await import('/core/europa.mjs');
  const { filtrar } = await import('/ui/clube/jogadores.mjs');
  const { ui } = await import('/ui/estado.mjs');
  const { go } = await import('/ui/telas.mjs');

  definirBaseEuropa(DADOS_EUROPA);
  const jogo = criarJogo('c127', DADOS_PADRAO);
  go('mercado');
  await document.fonts.ready;

  const erros = [];
  const conferir = (ok, detalhe) => { if (!ok) erros.push(detalhe) };
  const listaCompleta = document.querySelector('.figma-mercado .tabela-rolavel');
  conferir(listaCompleta.scrollWidth === listaCompleta.clientWidth, 'a lista de todos os clubes rola para o lado');

  const clube = clubesEuropa().reduce((maior, atual) => atual.name.length > maior.name.length ? atual : maior);
  Object.assign(ui.mf, { club: clube.id, ord: 'nome', dir: -1 });
  const jogadores = filtrar(clube.players, ui.mf).slice(0, 5);
  const rodada = jogo.round + '_' + jogo.season;
  const casos = [
    ['À venda', true, false, '', ['comprarJa', 'makeBid']],
    ['Para empréstimo', false, true, '', ['emprestimoJa', 'loanForm', 'makeBid']],
    ['Sob contrato', false, false, '', ['makeBid']],
    ['Proposta enviada nesta rodada', true, false, rodada, ['comprarJa']],
    ['Para empréstimo', true, true, '', ['comprarJa', 'emprestimoJa', 'loanForm', 'makeBid']],
  ];
  for (const [i, [, listed, emprestar, bidRound]] of casos.entries()) {
    Object.assign(jogadores[i], { listed, emprestar, bidRound });
  }
  go('mercado');
  await document.fonts.ready;

  const tabela = document.querySelector('.figma-mercado table');
  const regiao = tabela.parentElement;
  const raiz = document.scrollingElement;
  conferir(innerWidth === 1366 && document.querySelector('.nav-lateral').offsetWidth > 0, 'use 1366 px com barra lateral');
  conferir(raiz.scrollWidth === raiz.clientWidth, 'a página rola para o lado');
  conferir(regiao.scrollWidth === regiao.clientWidth, `a tabela mede ${regiao.scrollWidth} px dentro de ${regiao.clientWidth} px`);
  conferir([...tabela.tHead.rows[0].cells].every(c => c.offsetWidth > 0), 'há cabeçalho oculto');
  conferir([...tabela.tBodies[0].rows].every(linha => [...linha.cells].every(c => c.offsetWidth > 0)), 'há célula oculta');

  const tamanhos = new Set();
  const textos = document.createTreeWalker(tabela, NodeFilter.SHOW_TEXT);
  while (textos.nextNode()) {
    const { parentElement, textContent } = textos.currentNode;
    if (!textContent.trim() || !parentElement.getClientRects().length || parentElement.closest('.sr, [aria-hidden="true"]')) continue;
    const tamanho = parseFloat(getComputedStyle(parentElement).fontSize);
    tamanhos.add(tamanho);
    if (tamanho < 12 && !erros.includes(`texto a ${tamanho} px em ${parentElement.className}`)) {
      erros.push(`texto a ${tamanho} px em ${parentElement.className}`);
    }
  }
  const fonteMinima = Math.min(...tamanhos);

  const limite = regiao.getBoundingClientRect();
  for (const [i, [situacao, , , , acoes]] of casos.entries()) {
    const pid = jogadores[i].id;
    const linha = tabela.querySelector(`[data-acao="makeBid|${pid}"], [data-acao="comprarJa|${pid}"]`)?.closest('tr');
    conferir(linha?.textContent.includes(situacao), `situação ausente para ${jogadores[i].name}: ${situacao}`);
    for (const acao of acoes) {
      const botao = linha?.querySelector(`[data-acao^="${acao}|${pid}"]`);
      if (!botao) { erros.push(`ação ${acao} ausente em ${situacao}`); continue }
      window.scrollTo(0, window.scrollY + botao.getBoundingClientRect().top - innerHeight / 2);
      const { left, right, top, bottom } = botao.getBoundingClientRect();
      const alvo = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
      conferir(left >= limite.left && right <= limite.right && botao.contains(alvo), `ação ${acao} cortada em ${situacao}`);
    }
  }
  if (!erros.length) {
    const jogador = jogadores[2];
    tabela.querySelector(`[data-acao="makeBid|${jogador.id}"]`).click();
    conferir(document.getElementById('dlgTitulo')?.textContent === `Proposta por ${jogador.name}`, 'o botão não abriu a proposta');
    document.querySelector('#dialogo [data-acao="responderDialogo|nao"]')?.click();
  }
  window.scrollTo(0, window.scrollY + tabela.getBoundingClientRect().top - 90);
  return { erros, casos: casos.length, fonteMinima, larguraTabela: regiao.clientWidth, rolagemHorizontal: regiao.scrollLeft };
})().catch(erro => ({ erros: [erro.stack] }))
