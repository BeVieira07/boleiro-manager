-- #79: seed e rng nunca ficam no estado que os membros leem; vão para liga_segredo, que só o servidor lê. Rollback no fim.
begin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f1', 'ana@exemplo.com');
insert into public.ligas (id, nome, dono_id, codigo_convite, status, rodada, versao)
  values ('00000000-0000-0000-0000-0000000000f2', 'Teste segredo', '00000000-0000-0000-0000-0000000000f1', 'ZZSEGR', 'andamento', 0, 1);
insert into public.liga_membros (liga_id, user_id, club_id)
  values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f1', 'c118');
insert into public.liga_estado (liga_id, versao, estado)
  values ('00000000-0000-0000-0000-0000000000f2', 1, '{"seed":12345,"rng":678,"season":2024}');
do $$ begin
  if (select estado ? 'seed' or estado ? 'rng' from public.liga_estado where liga_id = '00000000-0000-0000-0000-0000000000f2')
    then raise exception 'semente ficou no estado'; end if;
  if (select (seed, rng) from public.liga_segredo where liga_id = '00000000-0000-0000-0000-0000000000f2') is distinct from (12345::bigint, 678::bigint)
    then raise exception 'semente não foi guardada'; end if;
end $$;
-- gravação nova troca o rng e mantém a seed
update public.liga_estado set estado = '{"rng":999,"season":2024}' where liga_id = '00000000-0000-0000-0000-0000000000f2';
do $$ begin
  if (select (seed, rng) from public.liga_segredo where liga_id = '00000000-0000-0000-0000-0000000000f2') is distinct from (12345::bigint, 999::bigint)
    then raise exception 'rng não foi atualizado'; end if;
end $$;
-- o membro lê o estado da liga, mas não o segredo
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
do $$ begin
  if not exists (select 1 from public.liga_estado where liga_id = '00000000-0000-0000-0000-0000000000f2') then raise exception 'membro não leu o estado'; end if;
  if exists (select 1 from public.liga_segredo) then raise exception 'membro leu a semente'; end if;
end $$;
select 'segredo OK' as resultado;
rollback;
