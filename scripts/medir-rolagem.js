// Audita as telas no Chrome real. Ligas usam dados locais para exercitar a interface sem tocar no servidor.
// Uso: node scripts/navegador.mjs http://localhost:3000/ scripts/medir-rolagem.js (defina LARGURA e ALTURA).
(async () => {
  const { go, verClassificacao } = await import('/ui/telas.mjs');
  const { TITULOS } = await import('/ui/layout.mjs');
  const { criarJogo, divOf, userClub } = await import('/core/estado.mjs');
  const { compAba, compPainel } = await import('/ui/temporada/competicoes.mjs');
  const { DADOS_PADRAO } = await import('/core/dados-padrao.mjs');
  const { autoXI, jogarRodada, validateLineup } = await import('/core/motor.mjs');
  const { avAba, encerrarVivo, iniciarVivo, avPausar } = await import('/ui/partida/aovivo.mjs');
  const { ui } = await import('/ui/estado.mjs');
  const { executar } = await import('/ui/main.mjs');
  const { configurarConta, iniciarConta } = await import('/ui/inicio/conta.mjs');
  const { abrirLigas, abrirLobby } = await import('/ui/liga/liga.mjs');
  const { confirmar } = await import('/ui/avisos.mjs');

  const resultados = {};
  const app = document.getElementById('app');
  const raiz = document.scrollingElement;
  const rolavel = (el, eixo) => /^(auto|scroll)$/.test(getComputedStyle(el)['overflow' + eixo]);
  const nome = el => el.id ? '#' + el.id : el.tagName.toLowerCase() + [...el.classList].map(c => '.' + c).join('');
  function medir(tela) {
    const largura = raiz.clientWidth;
    const elementos = [...document.querySelectorAll('body *')].filter(el => el instanceof HTMLElement && el.clientWidth);
    const horizontal = elementos.filter(el => rolavel(el, 'X') && el.scrollWidth > el.clientWidth + 1);
    const vertical = elementos.filter(el => rolavel(el, 'Y') && el.scrollHeight > el.clientHeight + 1);
    const cortes = horizontal.filter(el => {
      el.scrollLeft = el.scrollWidth;
      const chegou = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      el.scrollLeft = 0;
      return !chegou || el.tabIndex !== 0;
    });
    resultados[tela] = {
      pagina: raiz.scrollWidth > largura ? `${raiz.scrollWidth} > ${largura}` : null,
      horizontal: horizontal.map(nome),
      vertical: vertical.map(nome),
      semAcessoHorizontal: cortes.map(nome)
    };
  }

  go('landing'); medir('landing');
  const carregarIngleses = executar('lpPais|Inglaterra');
  medir('landing/clubes carregando');
  await carregarIngleses;
  medir('landing/Premier League');
  executar('lpSerie|GB2'); medir('landing/Championship');
  document.querySelector('.lp-figurinha').click(); medir('inicio/atalho do álbum');
  go('menu'); medir('menu');
  executar('novoJogo'); medir('inicio');
  document.querySelector('.clube-escolha')?.click(); medir('inicio/clube escolhido');
  await executar('paisDoNovoJogo|Inglaterra'); medir('inicio/Premier League');
  executar('serieDoNovoJogo|GB2'); medir('inicio/Championship');
  document.querySelector('.clube-escolha').click();
  document.querySelector('.escolha-confirmar .btn').click(); medir('clube/Championship');
  executar('voltarMenu');
  go('config'); medir('config/fora do jogo');

  const usuario = { id: 'tecnico-1', email: 'tecnico@example.test' };
  const registro = { id: 'audit', nome: 'Liga de demonstração com vários técnicos', codigo_convite: 'AUDITORIA', series: ['A', 'B'], dono_id: usuario.id, status: 'aberta' };
  const membros = DADOS_PADRAO.clubs.slice(0, 12).map((c, i) => ({ user_id: `tecnico-${i + 1}`, club_id: c.id, nome: `Nome completo do técnico da liga ${i + 1}` }));
  configurarConta({ url: 'http://localhost', chave: 'auditoria', cliente: {
    auth: { getSession: async () => ({ data: { session: { user: usuario } } }), onAuthStateChange() {} },
    from(tabela) {
      const consulta = {
        select() { return this },
        eq() { return this },
        maybeSingle: async () => ({ data: tabela === 'ligas' ? registro : membros[0] }),
        order: async () => ({ data: tabela === 'ligas' ? [{ ...registro, status: 'andamento', liga_membros: membros }] : membros }),
        in: async () => ({ data: membros.map(m => ({ id: m.user_id, nome: m.nome })) })
      };
      return consulta;
    }
  } });
  await iniciarConta(() => {});
  go('menu');
  document.querySelector('.conta-menu').open = true;
  medir('menu/conta aberta');
  await abrirLigas(); medir('ligas');
  await abrirLobby(registro.id); medir('lobby');
  configurarConta({ url: '', chave: '' });

  const s = criarJogo('c127', DADOS_PADRAO);
  function rodada() {
    const clube = userClub();
    if (validateLineup(clube)) clube.lineup = autoXI(clube);
    return jogarRodada();
  }
  for (let i = 0; i < 12 && s.round < 4; i++) rodada();
  const { jogos, meu } = rodada();
  ui.lastRound = { round: s.round, games: jogos };
  iniciarVivo(jogos, meu, () => {});
  avPausar();
  for (const aba of ['meu', 'rodada', 'classif']) {
    avAba(aba);
    medir('aovivo/' + aba);
  }
  encerrarVivo();

  for (const tela of Object.keys(TITULOS).filter(t => t !== 'aovivo' && t !== 'liga')) {
    go(tela);
    medir(tela);
  }
  go('competicoes');
  const estatisticas = app.querySelector('.figma-estatisticas input');
  estatisticas.checked = true;
  medir('competicoes/estatísticas completas');
  for (const aba of ['nacional', 'internacional', 'estadual']) { // #409: cada competição de cada aba
    compAba(aba);
    for (const opcao of app.querySelectorAll('#compCompeticao option')) { verClassificacao(opcao.value); medir('competicoes/' + opcao.value) }
  }
  verClassificacao(divOf(userClub())); compPainel('rodadas'); medir('competicoes/rodadas'); compPainel('estat');

  criarJogo(membros.map(m => ({ id: m.user_id, nome: m.nome, clubId: m.club_id })), DADOS_PADRAO);
  go('mercado'); medir('mercado/revezamento');
  ui.liga = { id: registro.id, nome: registro.nome, prontos: [], dono: true };
  go('liga'); medir('liga');
  document.getElementById('opcoes-jogo').click();
  medir('liga/opções abertas');

  confirmar({ titulo: 'Diálogo longo', texto: ('Linha de confirmação com texto longo. ').repeat(85) });
  medir('liga/confirmação');
  return { largura: innerWidth, altura: innerHeight, telas: resultados };
})()
