-- #355: migração de liga, empréstimo para a Europa, retorno e proteção da projeção.
begin;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000003551', 'europa-a@exemplo.com'),
  ('00000000-0000-0000-0000-000000003552', 'europa-b@exemplo.com');
insert into public.ligas (id, nome, dono_id, codigo_convite, status, rodada, versao)
  values ('00000000-0000-0000-0000-000000003559', 'Teste Europa', '00000000-0000-0000-0000-000000003551', 'EU355A', 'andamento', 0, 1);
insert into public.liga_membros (liga_id, user_id, club_id) values
  ('00000000-0000-0000-0000-000000003559', '00000000-0000-0000-0000-000000003551', 'c1'),
  ('00000000-0000-0000-0000-000000003559', '00000000-0000-0000-0000-000000003552', 'c2');
insert into public.liga_estado (liga_id, versao, estado) values ('00000000-0000-0000-0000-000000003559', 1, '{
  "versao":18,
  "managers":{
    "00000000-0000-0000-0000-000000003551":{"id":"00000000-0000-0000-0000-000000003551","nome":"Ana","clubId":"c1","contraIA":{"id":"privada"},"offers":[{"id":"oferta-europa"}]},
    "00000000-0000-0000-0000-000000003552":{"id":"00000000-0000-0000-0000-000000003552","nome":"Bia","clubId":"c2"}
  },
  "clubs":[{"id":"c1","players":[{"id":"p1","pot":88}]},{"id":"c2","players":[]}]
}');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000003551","role":"authenticated"}';
do $$
declare e jsonb := public.liga_estado_meu('00000000-0000-0000-0000-000000003559');
begin
  if e ? 'europaLiga' or e->>'versao' is distinct from '18'
    or e#>>'{clubs,0,players,0,pot}' is distinct from '91' then raise exception 'projeção da liga antiga mudou'; end if;
end $$;
reset role;

do $$
declare
  liga uuid := '00000000-0000-0000-0000-000000003559';
  e jsonb := (select estado from public.liga_estado where liga_id = liga);
  p jsonb := e#>'{clubs,0,players,0}';
begin
  e := jsonb_set(e, '{clubs,0,players}', '[]') || '{
    "versao":19,"loans":[{"pid":"p1","from":"c1","to":"e1"}],
    "europaLiga":{"catalogo":"versao-teste","clubes":[{"id":"e1","ordem":["p1"]}]}
  }';
  e := jsonb_set(e, '{europaLiga,jogadores}', jsonb_build_array(p, '{"id":"p2","listed":true}'::jsonb));
  if not public.liga_gravar_acao(liga, 1, e) then raise exception 'empréstimo não foi gravado'; end if;
  if public.liga_gravar_acao(liga, 1, e) then raise exception 'retry gravou uma versão velha'; end if;
  if (select estado#>>'{europaLiga,jogadores,0,pot}' from public.liga_estado where liga_id = liga) is distinct from '88'
    then raise exception 'potencial íntegro sumiu do servidor'; end if;
end $$;

set local role authenticated;
do $$
declare
  liga uuid := '00000000-0000-0000-0000-000000003559';
  ana text := '00000000-0000-0000-0000-000000003551';
  e jsonb := public.liga_estado_meu(liga);
begin
  if e->'managers'->ana#>>'{contraIA,id}' is distinct from 'privada'
    or e->'managers'->ana#>>'{offers,0,id}' is distinct from 'oferta-europa'
    then raise exception 'a própria negociação ficou invisível'; end if;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000003552","role":"authenticated"}', true);
  e := public.liga_estado_meu(liga);
  if (e->'managers'->ana) ? 'contraIA' or e->'managers'->ana->'offers' is distinct from '[]'
    then raise exception 'negociação ou oferta privada apareceu para Bia'; end if;
  if e#>>'{europaLiga,jogadores,0,pot}' is distinct from '91'
    or (e#>'{europaLiga,jogadores,1}') ? 'pot'
    or e#>>'{europaLiga,clubes,0,ordem,0}' is distinct from 'p1'
    or e#>>'{loans,0,to}' is distinct from 'e1'
    then raise exception 'projeção europeia incorreta'; end if;
end $$;
reset role;

do $$
declare
  liga uuid := '00000000-0000-0000-0000-000000003559';
  e jsonb := (select estado from public.liga_estado where liga_id = liga);
  p jsonb := e#>'{europaLiga,jogadores,0}';
begin
  e := jsonb_set(e, '{clubs,0,players}', jsonb_build_array(p));
  e := jsonb_set(e - 'loans', '{europaLiga}', '{"catalogo":"versao-teste"}');
  if not public.liga_gravar_acao(liga, 2, e) then raise exception 'retorno não foi gravado'; end if;
  if (select estado#>>'{clubs,0,players,0,pot}' from public.liga_estado where liga_id = liga) is distinct from '88'
    then raise exception 'retorno alterou potencial no servidor'; end if;
end $$;
set local role authenticated;
do $$
declare e jsonb := public.liga_estado_meu('00000000-0000-0000-0000-000000003559');
begin
  if e#>>'{clubs,0,players,0,pot}' is distinct from '91' or (e->'europaLiga') ? 'jogadores'
    then raise exception 'projeção do retorno incorreta'; end if;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000003550","role":"authenticated"}', true);
  begin
    perform public.liga_estado_meu('00000000-0000-0000-0000-000000003559');
    raise exception 'não membro leu a liga';
  exception when raise_exception then
    if sqlerrm not like '%não é membro%' then raise; end if;
  end;
end $$;
select 'Europa na projeção por técnico OK' as resultado;
rollback;
