# Boleiro Manager

Jogo de gerenciamento de futebol no navegador. Comande um clube do Brasileirão nas Séries A, B, C ou D. O calendário inclui estaduais, Copa do Brasil, Libertadores e Sul-Americana.

[Jogue no GitHub Pages](https://bevieira07.github.io/boleiro-manager/)

## Rodar e testar

Use o Node.js 22 com npm. Na raiz do repositório, rode `npm start` e abra `http://localhost:3000/`. Os módulos JavaScript precisam de um servidor HTTP para carregar.

Rode `npm test` para executar a suíte de testes. O workflow [pages.yml](.github/workflows/pages.yml) roda os testes e publica o site a cada push na `main`.

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

Neste repositório, o workflow [funcao.yml](.github/workflows/funcao.yml) testa e publica `jogar-rodada` quando `core/`, `supabase/functions/` ou o próprio workflow mudam na `main`, com o segredo `SUPABASE_ACCESS_TOKEN` configurado no GitHub Actions. Ao alterar `core/`, use `npm run fixar-core` para atualizar a referência da função ao commit do motor já enviado ao GitHub.

Veja o [projeto da arquitetura online](docs/online.md) e a [skill de operação da liga](.claude/skills/liga-online/SKILL.md).
