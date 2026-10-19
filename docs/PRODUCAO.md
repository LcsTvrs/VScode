# Operação e publicação em produção

Atualizado em 18/10/2026. Leia também [ESCOPO.md](./ESCOPO.md), que registra a arquitetura, as regras de negócio, o estado conhecido e as pendências do projeto. Confirme o estado real da Vercel e do PostgreSQL antes de executar qualquer procedimento.

## Estado conhecido

- O projeto `estoque_uniformes` está na equipe `oktus2` da Vercel; o ramo `main` do repositório [LcsTvrs/VScode](https://github.com/LcsTvrs/VScode) publica em https://estoqueuniformes.vercel.app.
- A revisão funcional `79fd6eb` ficou Ready em 18/10/2026. Alterações posteriores no Git precisam de nova confirmação do deployment ativo.
- O usuário informou que a base já possuía dados de negócio, uma loja de código `0012` e uma conta `MASTER_ADMIN`. Esse retrato pode mudar; consulte a aplicação e o banco.
- Login individual, troca obrigatória de senha temporária, isolamento de `STORE_ADMIN`, seletor de loja do `MASTER_ADMIN` e CRUD de usuários e lojas estão implementados. Não há validação corporativa do LDAP nem suíte automatizada de testes.
- A coluna opcional `User.name` foi criada em produção por uma rotina aditiva no primeiro acesso. O histórico formal de `20261018230000_add_user_name` no Prisma Migrate ainda precisa ser verificado.

## Segredos e variáveis

| Variável | Finalidade |
| --- | --- |
| `DATABASE_URL` | Conexão de execução ao PostgreSQL, normalmente via pooler. |
| `DIRECT_URL` | Conexão direta para migrations. |
| `ADMIN_SESSION_SECRET` | Assinatura JWT, com pelo menos 32 bytes aleatórios. |
| `ADMIN_PASSWORD` | Provisionamento inicial e scripts pontuais de senha; não altera logins já criados por simples troca da variável. |

Configure os valores como segredos na Vercel. O projeto usa arquivos `.env`/ `.env.local` ignorados pelo Git apenas em desenvolvimento local. Não exponha valores, hashes, cookies ou URLs completas de banco em logs, documentação ou commits. No ambiente deste projeto, os segredos de produção não puderam ser exportados com `vercel env run -e production`; não presuma que comandos locais acessam o banco de produção.

O login verifica `User.passwordHash` com bcrypt. A sessão usa cookie HTTP-only, Secure em produção e SameSite=Strict; o servidor revalida o usuário e seu escopo. Alterar `ADMIN_PASSWORD` na Vercel, isoladamente, não redefine a senha de uma conta existente.

## Provisionamento e recuperação administrativa

**Banco totalmente vazio:** após conferir que não há usuários nem dados de negócio, `POST /api/setup` cria a loja inicial e a conta `admin` com papel `MASTER_ADMIN`, usando `ADMIN_PASSWORD` (12 a 128 caracteres). O endpoint é público, mas bloqueia novas execuções quando o banco já tem usuários ou dados de negócio. Não o use na base existente.

**Banco com dados e sem usuários:** `npm run admin:inspect` consulta o estado sem alterar o banco. Depois de confirmar a conexão, `npm run admin:bootstrap-existing` cria uma única conta master preservando os dados. Ele recusa a operação se já houver usuário ou se o banco estiver vazio.

**Conta `admin` master já existente:** `npm run admin:set-password` grava novo hash a partir de `ADMIN_PASSWORD` no ambiente e encerra a exigência de troca dessa conta. Verifique `DATABASE_URL` e o ambiente antes de usar. A senha não é exibida pelo script. Para contas comuns, o `MASTER_ADMIN` usa o reset em Administração → Usuários.

O `npm run db:seed` apaga tabelas de negócio e cria dados e acesso demonstrativos. Use somente em banco local descartável. A trava `ALLOW_DESTRUCTIVE_SEED` não o torna procedimento de produção.

## Migrações e dados existentes

1. Faça backup consistente do PostgreSQL e teste a restauração.
2. Confira o estado real do schema e o histórico com `prisma migrate status` usando a conexão direta correta. Bancos anteriores à migration inicial podem exigir baseline após conferência detalhada; não aplique `migrate resolve` por suposição.
3. Ensaie as migrations em staging com cópia representativa da base. A migration `20261014185052_add_multi_store` só faz backfill automático de legado com no máximo uma loja e aborta se houver ambiguidade.
4. Verifique a coluna `User.name` e a migration `20261018230000_add_user_name`. A rotina `ALTER TABLE IF NOT EXISTS` permite o uso atual, mas não marca a migration como aplicada no histórico do Prisma. Planeje `npm run db:deploy` após conferir o estado, sem repetir SQL manualmente.
5. Depois da migration, confira usuários, lojas, vínculos, variações, saldos, movimentos e solicitações. Prepare rollback da aplicação e restauração do banco para a janela de release.

Não use `db:push` nem `db:seed` em produção.

## Verificação de release

- Confirme que o deployment esperado está Ready e associado ao commit desejado, no domínio estável.
- Verifique login e logout, troca obrigatória após criação/reset de usuário e bloqueio de sessão antiga após edição ou desativação.
- Teste `STORE_ADMIN` em duas lojas, incluindo tentativa de passar `storeId` de outra loja nas APIs. Teste o `MASTER_ADMIN` escolhendo lojas distintas.
- Teste criação/edição/exclusão de lojas e usuários, reset de senha, estoque, solicitação pública, aprovação/recusa e CSV. A exclusão de loja com dados vinculados deve ser recusada.
- Confira `/solicitar?loja=CODIGO` para cada unidade. O LDAP/nome do autoatendimento são declarações do visitante, não identidade corporativa comprovada.
- Execute `npm run lint`, `npm run build` e `npx prisma validate` no código a publicar. Faça testes manuais de fluxos críticos, pois ainda não há suíte automatizada.
- Configure limites de tentativa/WAF para login e solicitação pública e monitore erros de autenticação e banco. Revise `npm audit` antes de atualizações de dependências.

## Riscos conhecidos para a próxima alteração

- `POST /api/inventory` aceita `SAIDA`, mas a implementação atual soma uma quantidade positiva ao saldo. A interface não oferece esse tipo; corrigir a API antes de expor novos clientes.
- Os botões CSV do painel master não enviam o `storeId` selecionado e, portanto, exportam todas as lojas. A API aceita o filtro; a interface precisa repassá-lo.
- O cadastro de loja pede apenas nome; cidade e UF recebem valores provisórios.
- O cadastro administrativo de solicitação só verifica insuficiência de saldo na aprovação, ao contrário do fluxo público que reserva quantidades pendentes.

Veja o contexto e a ordem sugerida de trabalho em [ESCOPO.md](./ESCOPO.md).
