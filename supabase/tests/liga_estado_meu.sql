-- #121: cada técnico lê o estado da liga sem o que é privado dos outros. Rollback no fim.
begin;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'ana@exemplo.com'),
  ('00000000-0000-0000-0000-0000000000e2', 'bia@exemplo.com'),
  ('00000000-0000-0000-0000-0000000000e3', 'cris@exemplo.com');
insert into public.ligas (id, nome, dono_id, codigo_convite, status, rodada, versao)
  values ('00000000-0000-0000-0000-0000000000f1', 'Teste visão', '00000000-0000-0000-0000-0000000000e1', 'ZZVISA', 'andamento', 0, 1);
insert into public.liga_membros (liga_id, user_id, club_id) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1', 'c1'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e2', 'c2'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e3', 'c3');
insert into public.liga_estado (liga_id, versao, estado) values ('00000000-0000-0000-0000-0000000000f1', 1, '{
  "season": 2026,
  "managers": {
    "00000000-0000-0000-0000-0000000000e1": {"id": "00000000-0000-0000-0000-0000000000e1", "nome": "Ana", "clubId": "c1", "conf": 70, "news": [{"t": "da Ana"}], "offers": [{"id": "o1"}]},
    "00000000-0000-0000-0000-0000000000e2": {"id": "00000000-0000-0000-0000-0000000000e2", "nome": "Bia", "clubId": "c2", "conf": 30, "news": [{"t": "da Bia"}], "offers": [{"id": "o2"}], "propostasClube": ["c9"]}
  },
  "propostas": [
    {"id": "pp1", "de": "00000000-0000-0000-0000-0000000000e1", "para": "00000000-0000-0000-0000-0000000000e2"},
    {"id": "pp2", "de": "00000000-0000-0000-0000-0000000000e2", "para": "00000000-0000-0000-0000-0000000000e3"}
  ],
  "clubs": [
    {"id": "c1", "name": "Um", "players": [{"id": "p1", "ovr": 70, "pot": 88}], "base": [{"id": "b1", "pot": 66}]},
    {"id": "c2", "name": "Dois", "players": [{"id": "p2", "ovr": 60, "pot": 62}, {"id": "p3", "ovr": 50}], "base": [{"id": "b2", "pot": 90}]}
  ]
}');
create temp table v (e jsonb);
grant all on v to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';
insert into v select public.liga_estado_meu('00000000-0000-0000-0000-0000000000f1');
do $$
declare e jsonb := (select e from v); bia jsonb := e->'managers'->'00000000-0000-0000-0000-0000000000e2';
begin
  -- o meu técnico fica inteiro
  if e->'managers'->'00000000-0000-0000-0000-0000000000e1'->'news'->0->>'t' <> 'da Ana' then raise exception 'perdi minhas notícias'; end if;
  -- dos outros, só nome e clube
  if bia->>'nome' <> 'Bia' or bia->>'clubId' <> 'c2' then raise exception 'nome ou clube da Bia sumiu'; end if;
  if bia ? 'conf' or bia ? 'propostasClube' or jsonb_array_length(bia->'news') > 0 or jsonb_array_length(bia->'offers') > 0 then
    raise exception 'dados privados da Bia apareceram'; end if;
  -- só as propostas em que estou
  if jsonb_array_length(e->'propostas') <> 1 or e->'propostas'->0->>'id' <> 'pp1' then raise exception 'propostas de outros apareceram'; end if;
  -- base só do meu clube; potencial em faixa (mesmas estrelas)
  if not (e->'clubs'->0 ? 'base') or e->'clubs'->1 ? 'base' then raise exception 'base errada'; end if;
  if (e->'clubs'->0->'players'->0->>'pot')::int <> 91 or (e->'clubs'->1->'players'->0->>'pot')::int <> 59
     or (e->'clubs'->0->'base'->0->>'pot')::int <> 67 then raise exception 'potencial não ficou em faixa: %', e->'clubs'; end if;
  if e->'clubs'->1->'players'->1 ? 'pot' then raise exception 'jogador sem potencial ganhou um'; end if;
end $$;
-- quem não é membro não lê
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000dead","role":"authenticated"}';
do $$ begin
  begin perform public.liga_estado_meu('00000000-0000-0000-0000-0000000000f1'); raise exception 'não membro leu';
  exception when raise_exception then if sqlerrm not like '%não é membro%' then raise; end if; end;
end $$;
select 'visão por técnico OK' as resultado;
rollback;
