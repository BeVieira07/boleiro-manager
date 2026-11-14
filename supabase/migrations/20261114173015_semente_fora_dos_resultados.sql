-- #116: liga_resultados.semente guardava semente(seed, temporada, rodada), que os membros leem. Com 2^32 sementes possíveis,
-- testar todas leva minutos, e duas rodadas confirmam a semente da liga. Agora o servidor grava sempre 0, e o banco exige isso.
update public.liga_resultados set semente = 0;
alter table public.liga_resultados add constraint liga_resultados_sem_semente check (semente = 0);
-- a semente das ligas que já existem pode ter sido descoberta: sorteia outra
update public.liga_segredo set seed = floor(random() * 2147483647)::bigint, rng = floor(random() * 2147483647)::bigint;
