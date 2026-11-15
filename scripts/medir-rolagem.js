// #166: lista, em cada tela do jogo, o que tem rolagem horizontal (barra para arrastar para o lado). Vazio = nenhuma.
// Uso: npm start; depois LARGURA=390 node scripts/navegador.mjs http://localhost:3000/ scripts/medir-rolagem.js (repita com 1280, 1366, 1920).
(async () => {
  const tel = await import('/ui/telas.mjs'), api = await import('/core/estado.mjs'), motor = await import('/core/motor.mjs'), est = await import('/ui/estado.mjs');
  const desc = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '');
  const medir = () => {
    const res = [];
    if (document.documentElement.scrollWidth > innerWidth + 1) res.push(`PÁGINA ${document.documentElement.scrollWidth}>${innerWidth}`);
    for (const el of document.querySelectorAll('*')) {
      const ox = getComputedStyle(el).overflowX;
      if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) res.push(`${desc(el)} ${el.scrollWidth}>${el.clientWidth}`);
    }
    return res;
  };
  const out = {};
  out.menu = medir();
  tel.go('inicio'); out.inicio = medir();
  const { DADOS_PADRAO } = await import('/core/dados-padrao.mjs');
  api.criarJogo('c127', DADOS_PADRAO);
  for (let i = 0; i < 4; i++) { const uc = api.userClub(); if (motor.validateLineup(uc)) uc.lineup = motor.autoXI(uc); motor.jogarRodada() }
  const um = await import('/ui/motor.mjs'); { const uc = api.userClub(); if (motor.validateLineup(uc)) uc.lineup = motor.autoXI(uc) } um.playRound(false);
  for (const t of ['clube', 'elenco', 'escalacao', 'jogos', 'rodada', 'tabela', 'competicoes', 'copa', 'estadual', 'libertadores', 'sulamericana', 'artilharia', 'mercado', 'financas', 'dados', 'config']) {
    try { tel.go(t); await new Promise(r => setTimeout(r, 50)); out[t] = medir() } catch (e) { out[t] = ['ERRO ' + e.message] }
  }
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v.length));
})()
