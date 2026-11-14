-- #118: o banco aceitava liga com séries não vizinhas (ex.: A e C), que nunca podia começar (acesso e rebaixamento
-- valem entre séries vizinhas). A tela já confere (erroSeries); aqui a mesma regra vale para qualquer pedido.
create function privado.series_vizinhas(s text[]) returns boolean
  language sql immutable set search_path = ''
as $$
  select coalesce(max(i) - min(i) + 1 = count(distinct i), false)
  from (select array_position(array['A','B','C','D'], x) as i from unnest(s) as x) t;
$$;
alter table public.ligas add constraint ligas_series_vizinhas check (privado.series_vizinhas(series));
