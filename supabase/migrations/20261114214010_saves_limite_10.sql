-- #119: limite de saves na nuvem por conta passa de 20 para 10. Contas que já têm mais continuam com os saves e podem
-- atualizá-los; só não entram saves novos até ficarem abaixo de 10.
create or replace function privado.limitar_saves() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.saves where user_id = new.user_id and id = new.id) then return new; end if; -- upsert de um save existente
  -- shortcut: dois envios ao mesmo tempo podem passar do limite por 1; basta um advisory lock se isso importar
  if (select count(*) from public.saves where user_id = new.user_id) >= 10 then
    raise exception 'Você já tem 10 jogos salvos na nuvem. Exclua um na tela inicial para salvar outro.';
  end if;
  return new;
end;
$$;
