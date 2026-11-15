-- #121: o navegador lê o estado da liga pela função liga_estado_meu (sem os dados privados dos outros técnicos);
-- a leitura direta de liga_estado sai, senão o console ainda leria o estado inteiro. Só o servidor (chave de serviço) lê a tabela.
drop policy "estado: membros leem" on public.liga_estado;
