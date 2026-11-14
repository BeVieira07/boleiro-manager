-- #37: membro sai da liga, ou o dono o remove. Atômico: grava o estado da liga sem o técnico (se a liga já começou),
-- apaga a entrada e o membro, e passa a liga para o membro mais antigo quando quem sai é o dono (sem ninguém: encerrada).
-- Só a função do servidor chama (ela confere quem pode, e tira o técnico do estado com core/liga.mjs).
create function public.liga_remover_membro(p_liga uuid, p_user uuid, p_versao int, p_estado jsonb) returns boolean
  language plpgsql security definer set search_path = ''
as $$
declare novo_dono uuid;
begin
  if not exists (select 1 from public.liga_membros where liga_id = p_liga and user_id = p_user) then return false; end if;
  if p_estado is not null then
    update public.ligas set versao = versao + 1 where id = p_liga and versao = p_versao;
    if not found then return false; end if;
    update public.liga_estado set estado = p_estado, versao = p_versao + 1 where liga_id = p_liga;
  end if;
  delete from public.liga_entradas where liga_id = p_liga and user_id = p_user;
  delete from public.liga_membros where liga_id = p_liga and user_id = p_user;
  if (select dono_id from public.ligas where id = p_liga) = p_user then
    select user_id into novo_dono from public.liga_membros where liga_id = p_liga order by entrou_em, user_id limit 1;
    if novo_dono is null then update public.ligas set status = 'encerrada' where id = p_liga;
    else update public.ligas set dono_id = novo_dono where id = p_liga; end if;
  end if;
  return true;
end;
$$;

revoke execute on function public.liga_remover_membro(uuid, uuid, int, jsonb) from public, anon, authenticated;
grant execute on function public.liga_remover_membro(uuid, uuid, int, jsonb) to service_role;
