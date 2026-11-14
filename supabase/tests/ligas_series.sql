-- #118: liga só com séries vizinhas (A e C não; B, C e D sim). Rollback no fim.
begin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b1', 'teste-series@exemplo.com');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
do $$ begin
  begin perform public.criar_liga('Furada', array['A','C'], 'c118'); raise exception 'liga com A e C foi criada';
  exception when check_violation then null; end;
  perform public.criar_liga('Boa', array['B','C','D'], 'c118');
  if not exists (select 1 from public.ligas where nome = 'Boa') then raise exception 'liga com B, C e D não foi criada'; end if;
end $$;
select 'séries vizinhas OK' as resultado;
rollback;
