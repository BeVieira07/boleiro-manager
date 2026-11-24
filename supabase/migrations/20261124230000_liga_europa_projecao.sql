-- #355: mantém a assinatura, as permissões e a autorização por membro.
create or replace function public.liga_estado_meu(p_liga uuid) returns jsonb
  language plpgsql stable security definer set search_path = ''
as $$
declare
  eu text := (select auth.uid())::text;
  e jsonb;
  meu text;
begin
  if not privado.eh_membro(p_liga) then raise exception 'Você não é membro desta liga.'; end if;
  select estado into e from public.liga_estado where liga_id = p_liga;
  if e is null then return null; end if;
  meu := e->'managers'->eu->>'clubId';
  -- dos outros técnicos, só o que a tela mostra: nome e clube
  e := jsonb_set(e, '{managers}', (
    select coalesce(jsonb_object_agg(k, case when k = eu then v else jsonb_build_object(
      'id', v->'id', 'nome', v->'nome', 'clubId', v->'clubId', 'demitido', coalesce(v->'demitido', 'false'::jsonb),
      'news', '[]'::jsonb, 'offers', '[]'::jsonb) end), '{}'::jsonb)
    from jsonb_each(coalesce(e->'managers', '{}'::jsonb)) as m(k, v)));
  -- propostas entre técnicos: só as que envolvem quem chama
  e := jsonb_set(e, '{propostas}', (
    select coalesce(jsonb_agg(p), '[]'::jsonb) from jsonb_array_elements(coalesce(e->'propostas', '[]'::jsonb)) as x(p)
    where p->>'de' = eu or p->>'para' = eu));
  -- jogadores com o potencial em faixa; base (jovens) só do próprio clube
  e := jsonb_set(e, '{clubs}', (
    select coalesce(jsonb_agg(
      (c - 'base' - 'players')
      || jsonb_build_object('players', privado.pot_em_faixa(c->'players'))
      || case when c->>'id' = meu and c ? 'base' then jsonb_build_object('base', privado.pot_em_faixa(c->'base')) else '{}'::jsonb end
      order by o), '[]'::jsonb)
    from jsonb_array_elements(coalesce(e->'clubs', '[]'::jsonb)) with ordinality as x(c, o)));
  -- Europeus que mudaram de elenco usam a mesma projeção do potencial.
  if jsonb_typeof(e->'europaLiga'->'jogadores') = 'array' then
    e := jsonb_set(e, '{europaLiga,jogadores}', privado.pot_em_faixa(e->'europaLiga'->'jogadores'));
  end if;
  return e;
end;
$$;
