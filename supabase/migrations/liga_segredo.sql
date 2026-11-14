-- #79: a semente do sorteio da liga (seed) e o estado do gerador (rng) ficavam no estado que todos os membros leem, e a
-- semente também ia para liga_resultados. Com o motor público, dava para prever a resposta da IA e testar escalações.
-- Agora ficam em liga_segredo, que só o servidor lê; um gatilho tira os dois de todo estado gravado em liga_estado.
create table public.liga_segredo (
  liga_id uuid primary key references public.ligas (id) on delete cascade,
  seed bigint,
  rng bigint
);
alter table public.liga_segredo enable row level security; -- sem regra de leitura: só a chave de serviço lê

create function privado.guardar_segredo() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  if new.estado ? 'seed' or new.estado ? 'rng' then
    insert into public.liga_segredo (liga_id, seed, rng)
      values (new.liga_id, (new.estado->>'seed')::bigint, (new.estado->>'rng')::bigint)
      on conflict (liga_id) do update set seed = coalesce(excluded.seed, public.liga_segredo.seed),
                                          rng = coalesce(excluded.rng, public.liga_segredo.rng);
    new.estado := new.estado - 'seed' - 'rng';
  end if;
  return new;
end;
$$;
revoke execute on function privado.guardar_segredo() from public, anon, authenticated;
create trigger guardar_segredo before insert or update of estado on public.liga_estado
  for each row execute function privado.guardar_segredo();

-- ligas que já existem: tira seed e rng do estado (o gatilho guarda) e, como a semente já estava exposta, troca por uma nova
update public.liga_estado set estado = estado;
update public.liga_segredo set seed = floor(random() * 2147483647)::bigint, rng = floor(random() * 2147483647)::bigint;
-- os resultados antigos guardavam a semente da liga
update public.liga_resultados set semente = 0;
