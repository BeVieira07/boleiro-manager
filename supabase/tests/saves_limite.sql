-- #119: até 20 saves por conta na nuvem; atualizar um save existente continua valendo. Rollback no fim.
begin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c9', 'teste-limite@exemplo.com');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c9","role":"authenticated"}';
insert into public.saves (id, resumo, estado) select 's' || g, '{}', '{}' from generate_series(1, 20) g;
do $$ begin
  begin insert into public.saves (id, resumo, estado) values ('s21', '{}', '{}'); raise exception 'o 21º save entrou';
  exception when raise_exception then
    if sqlerrm not like '%20 jogos salvos na nuvem%' then raise; end if;
  end;
  -- atualizar um save existente pelo upsert do navegador continua valendo
  insert into public.saves (id, resumo, estado) values ('s5', '{"r":1}', '{}') on conflict (user_id, id) do update set resumo = excluded.resumo;
  if (select resumo->>'r' from public.saves where id = 's5') <> '1' then raise exception 'upsert de save existente falhou'; end if;
  delete from public.saves where id = 's1';
  insert into public.saves (id, resumo, estado) values ('s21', '{}', '{}'); -- abriu vaga
end $$;
select 'limite de saves OK' as resultado;
rollback;
