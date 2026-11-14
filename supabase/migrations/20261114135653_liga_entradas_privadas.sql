-- #78: a escalação, a formação e a tática de cada técnico (liga_entradas) só ele lê; antes, qualquer membro lia as dos outros
-- antes da rodada, e o tempo real mandava a linha inteira. Quem confirmou passa a ficar em liga_membros.pronto_rodada
-- (a rodada em que confirmou, ou null), que todos os membros leem, mantido por um gatilho; o tempo real ouve liga_membros.
drop policy "entradas: membros leem" on public.liga_entradas;
create policy "entradas: o técnico lê a sua" on public.liga_entradas
  for select to authenticated using ((select auth.uid()) = user_id);

alter table public.liga_membros add column pronto_rodada int;

create function privado.marcar_pronto() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  update public.liga_membros set pronto_rodada = case when new.pronto then new.rodada else null end
    where liga_id = new.liga_id and user_id = new.user_id;
  return new;
end;
$$;
revoke execute on function privado.marcar_pronto() from public, anon, authenticated;
create trigger marcar_pronto after insert or update of pronto, rodada on public.liga_entradas
  for each row execute function privado.marcar_pronto();

-- as confirmações que já existem
update public.liga_membros m set pronto_rodada = e.rodada
  from public.liga_entradas e where e.liga_id = m.liga_id and e.user_id = m.user_id and e.pronto;

alter publication supabase_realtime drop table public.liga_entradas;
alter publication supabase_realtime add table public.liga_membros;
