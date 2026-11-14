-- #37: saída de membros. Usuário logado não chama a função; versão velha não grava; o dono que sai passa a liga ao membro
-- mais antigo; o último que sai encerra a liga; quem não é membro não muda nada. Rollback no fim.
begin;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'dono@exemplo.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'segundo@exemplo.com'),
  ('00000000-0000-0000-0000-0000000000b3', 'terceiro@exemplo.com');
insert into public.ligas (id, nome, dono_id, codigo_convite, status, rodada, versao)
  values ('00000000-0000-0000-0000-0000000000c1', 'Teste saída', '00000000-0000-0000-0000-0000000000b1', 'ZZTEST', 'andamento', 0, 1);
insert into public.liga_estado (liga_id, versao, estado) values ('00000000-0000-0000-0000-0000000000c1', 1, '{"n":3}');
insert into public.liga_membros (liga_id, user_id, club_id, entrou_em) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'c118', now() - interval '3 min'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2', 'c119', now() - interval '2 min'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b3', 'c120', now() - interval '1 min');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
do $$ begin
  begin perform public.liga_remover_membro('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2', 1, '{}'); raise exception 'usuário chamou direto';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
do $$
declare l uuid := '00000000-0000-0000-0000-0000000000c1';
begin
  if public.liga_remover_membro(l, '00000000-0000-0000-0000-0000000000b3', 0, '{"n":2}') then raise exception 'versão velha removeu'; end if;
  if not public.liga_remover_membro(l, '00000000-0000-0000-0000-0000000000b3', 1, '{"n":2}') then raise exception 'não removeu'; end if;
  if (select versao from public.ligas where id = l) <> 2 or (select estado->>'n' from public.liga_estado where liga_id = l) <> '2' then raise exception 'estado errado'; end if;
  if exists (select 1 from public.liga_membros where liga_id = l and user_id = '00000000-0000-0000-0000-0000000000b3') then raise exception 'membro ficou'; end if;
  if not public.liga_remover_membro(l, '00000000-0000-0000-0000-0000000000b1', 2, '{"n":1}') then raise exception 'dono não saiu'; end if;
  if (select dono_id from public.ligas where id = l) <> '00000000-0000-0000-0000-0000000000b2' then raise exception 'dono não passou ao mais antigo'; end if;
  if not public.liga_remover_membro(l, '00000000-0000-0000-0000-0000000000b2', 3, '{"n":0}') then raise exception 'último não saiu'; end if;
  if (select status from public.ligas where id = l) <> 'encerrada' then raise exception 'liga não encerrou'; end if;
  if public.liga_remover_membro(l, '00000000-0000-0000-0000-0000000000b2', 4, '{"n":0}') then raise exception 'removeu quem não é membro'; end if;
end $$;
select 'saída de membros OK' as resultado;
rollback;
