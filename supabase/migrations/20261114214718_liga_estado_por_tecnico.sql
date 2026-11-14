-- #121: liga_estado.estado ia inteiro para todos os membros: notícias, ofertas e propostas de clube dos outros técnicos,
-- as propostas entre outros dois técnicos, a base dos outros clubes e o potencial exato de cada jogador (a tela só mostra
-- estrelas). Agora o navegador lê o estado pela função liga_estado_meu, que monta a visão de quem chama; a leitura direta
-- de liga_estado sai na migração seguinte, depois que o site passar a usar a função.

-- potencial trocado por um valor que dá as mesmas estrelas (estrelasPot em core/base.mjs: ceil((pot-55)/8), de 1 a 5)
create function privado.pot_em_faixa(jogadores jsonb) returns jsonb
  language sql immutable set search_path = ''
as $$
  select coalesce(jsonb_agg(
    case when jsonb_typeof(p->'pot') = 'number'
      then jsonb_set(p, '{pot}', to_jsonb(51 + 8 * least(5, greatest(1, ceil(((p->>'pot')::numeric - 55) / 8)))))
      else p end
    order by o), '[]'::jsonb)
  from jsonb_array_elements(coalesce(jogadores, '[]'::jsonb)) with ordinality as x(p, o);
$$;

create function public.liga_estado_meu(p_liga uuid) returns jsonb
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
  return e;
end;
$$;
revoke execute on function public.liga_estado_meu(uuid) from public, anon;
grant execute on function public.liga_estado_meu(uuid) to authenticated;
