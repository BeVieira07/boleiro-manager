# Boleiro Manager

Jogo de gerenciamento de futebol no navegador. Comande um clube do Brasileirão nas Séries A, B, C ou D. O calendário inclui estaduais, Copa do Brasil, Libertadores e Sul-Americana.

[Jogue no GitHub Pages](https://bevieira07.github.io/boleiro-manager/)

## Rodar e testar

Use o Node.js 22 com npm. Na raiz do repositório, rode `npm start` e abra `http://localhost:3000/`. Os módulos JavaScript precisam de um servidor HTTP para carregar.

Rode `npm test` para executar a suíte de testes. O workflow [pages.yml](.github/workflows/pages.yml) roda os testes e publica o site a cada push na `main`.

## Dados e overall

- A base de clubes e elencos em `data/` vem da API-Football e cobre as Séries A a D de 2024 e os clubes estrangeiros da Libertadores e da Sul-Americana.
- O overall dos jogadores do Brasileirão prioriza `data/overalls-manual.json`. Nos demais casos, combina as notas de `data/notas-2024.json`, quando disponíveis, com uma estimativa que pode usar o valor de mercado do Transfermarkt nas Séries A e B.
- Após alterar os dados do jogo em `data/`, rode `npm run dados:padrao` para gerar `core/dados-padrao.mjs` e `core/dados-continentais.mjs`. Não edite esses módulos à mão.
- `npm run europa -- --ligas=GB1,GB2,ES1,ES2` importa os clubes da Inglaterra e da Espanha para `data/europa-2025.json`, com `API_FOOTBALL_KEY` no `.env`. Se atingir a margem da cota diária, rode o mesmo comando no dia seguinte para retomar. A integração com o mercado está na issue #355.
- Veja os detalhes na [skill do Boleiro Manager](.claude/skills/boleiro-manager/SKILL.md).

## Jogar online

No modo solo, o progresso é salvo no navegador e pode ser sincronizado na nuvem com uma conta. Entre com e-mail e senha ou com Google. Na liga com amigos, cada pessoa comanda um clube na mesma campanha e a função `jogar-rodada` simula as rodadas no Supabase.

### Configurar um projeto Supabase

1. Preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY` em [ui/config.mjs](ui/config.mjs) com a URL do projeto e a chave pública `publishable` ou `anon`. Com esses campos vazios, o modo solo funciona offline. Guarde as chaves privadas fora do repositório.
2. Habilite o provedor de e-mail para cadastro e login com senha. Em **Authentication → URL Configuration**, defina a **Site URL** da sua instalação e permita `http://localhost:3000/` em **Redirect URLs** para desenvolvimento. Se quiser oferecer login com Google, [configure o provedor](https://supabase.com/docs/guides/auth/social-sign-in/auth-google) no Supabase.
3. Aplique as migrações e publique a função da liga. Substitua `REF_DO_PROJETO` pela referência do seu projeto.

   ```bash
   npx supabase login
   npx supabase link --project-ref REF_DO_PROJETO
   npx supabase db push
   npx supabase functions deploy jogar-rodada --project-ref REF_DO_PROJETO --use-api
   ```

Neste repositório, o workflow [funcao.yml](.github/workflows/funcao.yml) testa e publica `jogar-rodada` quando `core/`, `supabase/functions/` ou o próprio workflow mudam na `main`, com o segredo `SUPABASE_ACCESS_TOKEN` configurado no GitHub Actions. A função importa o `core/` do próprio repositório, então não há passo manual ao alterar o motor.

Veja o [projeto da arquitetura online](docs/online.md) e a [skill de operação da liga](.claude/skills/liga-online/SKILL.md).
