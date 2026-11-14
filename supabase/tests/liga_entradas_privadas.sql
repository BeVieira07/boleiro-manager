-- #78: cada técnico lê só a própria entrada (escalação e tática); quem confirmou aparece em liga_membros.pronto_rodada,
-- que os membros leem, e a rodada jogada zera as confirmações. Rollback no fim.
begin;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'ana@exemplo.com'),
  ('00000000-0000-0000-0000-0000000000d2', 'bia@exemplo.com');
insert into public.ligas (id, nome, dono_id, codigo_convite, status, rodada, versao)
  values ('00000000-0000-0000-0000-0000000000e1', 'Teste entradas', '00000000-0000-0000-0000-0000000000d1', 'ZZENTR', 'andamento', 0, 1);
insert into public.liga_estado (liga_id, versao, estado) values ('00000000-0000-0000-0000-0000000000e1', 1, '{}');
insert into public.liga_membros (liga_id, user_id, club_id) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', 'c118'),
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d2', 'c119');
create temp table r (v int);
grant all on r to authenticated, service_role;
-- a Bia confirma a rodada, com a escalação dela
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';
insert into public.liga_entradas (liga_id, user_id, rodada, escalacao, formacao, estilo, modo, pronto)
  values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d2', 0, '{"lineup":["x"]}', '4-3-3', 'toque', 'ofensivo', true);
insert into r select count(*) from public.liga_entradas;  -- a Bia vê a dela
-- a Ana não vê a escalação da Bia, mas vê que ela confirmou
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
do $$ begin
  if (select v from r) <> 1 then raise exception 'a Bia não viu a própria entrada'; end if;
  if exists (select 1 from public.liga_entradas) then raise exception 'a Ana leu a escalação da Bia'; end if;
  if (select pronto_rodada from public.liga_membros where user_id = '00000000-0000-0000-0000-0000000000d2') is distinct from 0 then raise exception 'confirmação não apareceu para a Ana'; end if;
end $$;
-- a rodada jogada zera as confirmações
reset role;
set local role service_role;
do $$ begin
  if not public.liga_gravar_rodada('00000000-0000-0000-0000-0000000000e1', 0, 1, '{}', 2024, 0, 1, '[]') then raise exception 'rodada não gravou'; end if;
  if (select pronto_rodada from public.liga_membros where user_id = '00000000-0000-0000-0000-0000000000d2') is not null then raise exception 'confirmação não foi zerada'; end if;
end $$;
select 'entradas privadas OK' as resultado;
rollback;
