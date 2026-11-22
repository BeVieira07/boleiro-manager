-- #318: apenas o serviço chama a função, que exige o dono e exclui os dados da liga em cascata.
begin;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'dono@exemplo.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'membro@exemplo.com');
insert into public.ligas (id, nome, dono_id, codigo_convite, status) values
  ('00000000-0000-0000-0000-0000000000c1', 'Teste exclusão', '00000000-0000-0000-0000-0000000000b1', 'ZZEXCL', 'andamento'),
  ('00000000-0000-0000-0000-0000000000c2', 'Teste último membro', '00000000-0000-0000-0000-0000000000b2', 'ZZSAIU', 'aberta');
insert into public.liga_membros (liga_id, user_id, club_id) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'c118'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2', 'c119'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b2', 'c119');
insert into public.liga_estado (liga_id, estado)
values ('00000000-0000-0000-0000-0000000000c1', '{"seed":1,"rng":2}');
insert into public.liga_entradas (liga_id, user_id, rodada)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2', 0);
insert into public.liga_resultados (liga_id, temporada, rodada, semente, jogos)
values ('00000000-0000-0000-0000-0000000000c1', 1, 0, 0, '[]');

do $$ begin
  if has_function_privilege('anon', 'public.liga_excluir(uuid, uuid)', 'execute') then raise exception 'anônimo pode executar'; end if;
end $$;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
do $$
declare
  l uuid := '00000000-0000-0000-0000-0000000000c1';
  dono uuid := '00000000-0000-0000-0000-0000000000b1';
begin
  begin
    perform public.liga_excluir(l, dono);
    raise exception 'usuário chamou a função direto';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.ligas where id = l;
    if found then raise exception 'membro apagou a liga direto'; end if;
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set local role service_role;
do $$
declare
  l uuid := '00000000-0000-0000-0000-0000000000c1';
  lobby uuid := '00000000-0000-0000-0000-0000000000c2';
  dono uuid := '00000000-0000-0000-0000-0000000000b1';
  membro uuid := '00000000-0000-0000-0000-0000000000b2';
begin
  if public.liga_excluir(l, membro) then raise exception 'exclusão aceitou quem não é dono'; end if;
  if not public.liga_excluir(l, dono) then raise exception 'exclusão pelo dono falhou'; end if;
  if exists (select 1 from public.ligas where id = l)
    or exists (select 1 from public.liga_membros where liga_id = l)
    or exists (select 1 from public.liga_estado where liga_id = l)
    or exists (select 1 from public.liga_entradas where liga_id = l)
    or exists (select 1 from public.liga_resultados where liga_id = l)
    or exists (select 1 from public.liga_segredo where liga_id = l)
  then raise exception 'exclusão deixou dados da liga'; end if;
  if public.liga_excluir(l, dono) then raise exception 'exclusão de liga ausente aceitou'; end if;

  if not public.liga_remover_membro(lobby, membro, null, null) then raise exception 'último membro não saiu'; end if;
  if exists (select 1 from public.ligas where id = lobby) then raise exception 'lobby sem membros ficou no banco'; end if;
end $$;
select 'exclusão de liga OK' as resultado;
rollback;
