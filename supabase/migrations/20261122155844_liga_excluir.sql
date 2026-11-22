-- #318: a exclusão da liga leva os dados vinculados por chaves estrangeiras em cascata.
create function public.liga_excluir(p_liga uuid, p_dono uuid) returns boolean
  language sql security definer set search_path = ''
as $$
  with excluida as (
    delete from public.ligas where id = p_liga and dono_id = p_dono returning id
  )
  select exists (select 1 from excluida);
$$;

revoke execute on function public.liga_excluir(uuid, uuid) from public, anon, authenticated;
grant execute on function public.liga_excluir(uuid, uuid) to service_role;

create or replace function public.liga_remover_membro(p_liga uuid, p_user uuid, p_versao int, p_estado jsonb) returns boolean
  language plpgsql security definer set search_path = ''
as $$
declare
  l public.ligas;
  novo_dono uuid;
begin
  -- Serializa as saídas, inclusive no lobby, com as mudanças de dono e a exclusão da liga.
  select * into l from public.ligas where id = p_liga for update;
  if not found then return false; end if;
  if l.status = 'andamento' and p_estado is null then return false; end if;
  if p_estado is not null and l.versao is distinct from p_versao then return false; end if;

  delete from public.liga_entradas where liga_id = p_liga and user_id = p_user;
  delete from public.liga_membros where liga_id = p_liga and user_id = p_user;
  if not found then return false; end if;
  select user_id into novo_dono from public.liga_membros where liga_id = p_liga order by entrou_em, user_id limit 1;
  if novo_dono is null then
    delete from public.ligas where id = p_liga;
    return true;
  end if;

  if l.dono_id = p_user then
    update public.ligas set dono_id = novo_dono where id = p_liga;
  end if;
  if p_estado is not null then
    update public.ligas set versao = p_versao + 1 where id = p_liga;
    update public.liga_estado set estado = p_estado, versao = p_versao + 1 where liga_id = p_liga;
  end if;
  return true;
end;
$$;

delete from public.ligas l
where not exists (select 1 from public.liga_membros m where m.liga_id = l.id);
