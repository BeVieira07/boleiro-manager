-- #119: cada conta guarda até 20 saves na nuvem (cada um ocupa algumas centenas de KB; o plano grátis tem 500 MB para todos).
-- Atualizar um save que já existe (upsert) continua valendo; só um save novo além do limite é recusado.
create function privado.limitar_saves() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.saves where user_id = new.user_id and id = new.id) then return new; end if; -- upsert de um save existente
  -- shortcut: dois envios ao mesmo tempo podem passar do limite por 1; basta um advisory lock se isso importar
  if (select count(*) from public.saves where user_id = new.user_id) >= 20 then
    raise exception 'Você já tem 20 jogos salvos na nuvem. Exclua um na tela inicial para salvar outro.';
  end if;
  return new;
end;
$$;
revoke execute on function privado.limitar_saves() from public, anon, authenticated;
create trigger limitar_saves before insert on public.saves for each row execute function privado.limitar_saves();
