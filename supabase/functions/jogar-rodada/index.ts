// Função do servidor da liga com amigos (#34): começa a liga, joga a rodada quando todos confirmam (ou o dono força)
// e faz as ações de mercado com a IA (#35). Uma função só: um deploy e um commit do core/ para manter igual ao site.
// O motor é o mesmo do site: o core/ é importado do GitHub (jsDelivr) FIXADO num commit.
// Sempre que core/ mudar, troque o commit nos três imports abaixo e publique a função de novo, senão site e servidor
// rodam motores diferentes. Veja supabase/functions/README.md.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { acaoMercadoLiga, iniciarLiga, jogarRodadaLiga, removerTecnicoLiga } from 'https://cdn.jsdelivr.net/gh/BeVieira07/boleiro-manager@fb6527a63c0bc223faef6128e209477cc3cf5528/core/liga.mjs';
import { S } from 'https://cdn.jsdelivr.net/gh/BeVieira07/boleiro-manager@fb6527a63c0bc223faef6128e209477cc3cf5528/core/estado.mjs';
import { DADOS_PADRAO } from 'https://cdn.jsdelivr.net/gh/BeVieira07/boleiro-manager@fb6527a63c0bc223faef6128e209477cc3cf5528/core/dados-padrao.mjs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const erro = (msg: string, status = 400) => resposta({ erro: msg }, status);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return erro('Use POST.', 405);
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    // quem chama vem do token de login, nunca do corpo do pedido
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: u } = await admin.auth.getUser(token);
    const eu = u?.user?.id;
    if (!eu) return erro('Entre na sua conta.', 401);
    const corpo = await req.json().catch(() => ({}));
    const ligaId = String(corpo.liga || ''), acao = corpo.acao, forcar = !!corpo.forcar;

    const { data: liga } = await admin.from('ligas').select('id, dono_id, status, rodada, versao, series').eq('id', ligaId).maybeSingle();
    if (!liga) return erro('Liga não encontrada.', 404);
    const { data: membros } = await admin.from('liga_membros').select('user_id, club_id').eq('liga_id', ligaId);
    if (!membros || !membros.some((m) => m.user_id === eu)) return erro('Você não é membro desta liga.', 403);

    if (acao === 'iniciar') {
      if (liga.dono_id !== eu) return erro('Só o dono começa a liga.', 403);
      if (liga.status !== 'aberta') return erro('A liga já começou.', 409);
      const { data: perfis } = await admin.from('profiles').select('id, nome').in('id', membros.map((m) => m.user_id));
      const nomes = Object.fromEntries((perfis || []).map((p) => [p.id, p.nome]));
      // bloco síncrono: monta o estado e copia para texto antes de qualquer await (o core usa um estado global)
      const r = iniciarLiga(membros.map((m) => ({ ...m, nome: nomes[m.user_id] })), liga.series, DADOS_PADRAO);
      if (r.erro) return erro(r.erro);
      const estado = JSON.stringify(S);
      const { data: ok, error } = await admin.rpc('liga_iniciar', { p_liga: ligaId, p_estado: JSON.parse(estado) });
      if (error) throw error;
      return ok ? resposta({ ok: true, iniciada: true }) : erro('A liga já começou.', 409);
    }

    if (acao === 'jogar') {
      if (forcar && liga.dono_id !== eu) return erro('Só o dono pode forçar a rodada.', 403);
      // false na gravação: outra rodada ou uma ação de mercado gravou antes. Se a rodada mudou, ela já foi jogada
      // (duas confirmações ao mesmo tempo, não é erro); senão foi o mercado, e a rodada é refeita com o estado novo.
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        const { data: l } = await admin.from('ligas').select('status, rodada').eq('id', ligaId).single();
        if (l.status !== 'andamento') return erro('A liga ainda não começou.', 409);
        if (l.rodada !== liga.rodada) return resposta({ ok: true, jogada: false, jaJogada: true });
        const { data: entradas } = await admin.from('liga_entradas').select('*').eq('liga_id', ligaId).eq('rodada', l.rodada);
        const { data: est } = await admin.from('liga_estado').select('estado, versao').eq('liga_id', ligaId).single();
        const prontos = new Set((entradas || []).filter((e) => e.pronto).map((e) => e.user_id));
        // #37: quem está sem clube (escolhendo uma proposta) não é esperado
        const semClube = new Set(Object.values(est.estado.managers || {}).filter((t: any) => t.demitido).map((t: any) => t.id));
        const faltam = membros.filter((m) => !prontos.has(m.user_id) && !semClube.has(m.user_id)).length;
        if (faltam && !forcar) return resposta({ ok: true, jogada: false, faltam });
        // bloco síncrono: joga e copia o resultado para texto antes do próximo await
        const r = jogarRodadaLiga(est.estado, Object.fromEntries((entradas || []).map((e) => [e.user_id, e])));
        const novo = JSON.stringify(S), jogos = JSON.stringify(r.jogos);
        const { data: ok, error } = await admin.rpc('liga_gravar_rodada', {
          p_liga: ligaId, p_rodada: l.rodada, p_versao: est.versao, p_estado: JSON.parse(novo),
          p_temporada: r.temporada, p_rodada_temporada: r.rodada, p_semente: r.semente, p_jogos: JSON.parse(jogos)
        });
        if (error) throw error;
        if (ok) {
          // #37: quem não escolheu clube assumiu a melhor proposta; a lista de ligas mostra o clube novo
          for (const tr of r.trocas || []) await admin.from('liga_membros').update({ club_id: tr.club_id }).eq('liga_id', ligaId).eq('user_id', tr.user_id);
          return resposta({ ok: true, jogada: true, virada: r.virada });
        }
      }
      return erro('A liga mudou ao mesmo tempo. Tente de novo.', 409);
    }

    if (acao === 'mercado') { // #35: a resposta da IA é sorteada aqui, então recarregar a página não muda nada
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        const { data: est } = await admin.from('liga_estado').select('estado, versao').eq('liga_id', ligaId).maybeSingle();
        if (!est || liga.status !== 'andamento') return erro('A liga ainda não começou.', 409);
        // bloco síncrono, como na rodada
        const r = acaoMercadoLiga(est.estado, eu, corpo.mercado || {});
        if (r.erro) return erro(r.erro);
        const novo = JSON.stringify(S);
        const { data: ok, error } = await admin.rpc('liga_gravar_acao', { p_liga: ligaId, p_versao: est.versao, p_estado: JSON.parse(novo) });
        if (error) throw error;
        if (ok) {
          if (r.clube) await admin.from('liga_membros').update({ club_id: r.clube }).eq('liga_id', ligaId).eq('user_id', eu); // #37: assumiu outro clube
          return resposta({ ok: true, aceita: r.ok, msg: r.msg || null });
        }
      }
      return erro('A liga mudou ao mesmo tempo. Tente de novo.', 409);
    }
    if (acao === 'sair' || acao === 'remover') { // #37: sair da liga, ou o dono remove um membro; o clube volta para a IA
      const alvo = acao === 'sair' ? eu : String(corpo.membro || '');
      if (acao === 'remover' && liga.dono_id !== eu) return erro('Só o dono remove membros.', 403);
      if (acao === 'remover' && alvo === eu) return erro('Para sair da liga, use "Sair da liga".');
      if (!membros.some((m) => m.user_id === alvo)) return erro('Esse técnico não é membro da liga.', 404);
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        let p_estado = null, p_versao = null;
        if (liga.status === 'andamento') {
          const { data: est } = await admin.from('liga_estado').select('estado, versao').eq('liga_id', ligaId).single();
          // bloco síncrono, como na rodada
          const r = removerTecnicoLiga(est.estado, alvo);
          if (r.erro) return erro(r.erro);
          p_estado = JSON.parse(JSON.stringify(S)); p_versao = est.versao;
        }
        const { data: ok, error } = await admin.rpc('liga_remover_membro', { p_liga: ligaId, p_user: alvo, p_versao, p_estado });
        if (error) throw error;
        if (ok) return resposta({ ok: true, saiu: alvo });
        if (liga.status !== 'andamento') break;
      }
      return erro('A liga mudou ao mesmo tempo. Tente de novo.', 409);
    }
    return erro('Ação desconhecida.');
  } catch (e) {
    console.error(e);
    return erro('Erro no servidor: ' + (e instanceof Error ? e.message : String(e)), 500);
  }
});
