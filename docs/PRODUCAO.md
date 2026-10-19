# Operação e publicação em produção

Atualizado em 19/10/2026. As correções descritas abaixo foram feitas e verificadas localmente; ainda não foram publicadas. Leia também [ESCOPO.md](./ESCOPO.md). Confirme o estado real da Vercel e do PostgreSQL antes de executar qualquer procedimento.

## Estado conhecido

- O projeto `estoque_uniformes` está na equipe `oktus2` da Vercel; o ramo `main` do repositório [LcsTvrs/VScode](https://github.com/LcsTvrs/VScode) publica em https://estoqueuniformes.vercel.app.
- A revisão funcional `79fd6eb` ficou Ready em 18/10/2026. Alterações posteriores no Git precisam de nova confirmação do deployment ativo.
- O usuário informou que a base já possuía dados de negócio, uma loja de código `0012` e uma conta `MASTER_ADMIN`. Esse retrato pode mudar; consulte a aplicação e o banco.
- Login individual, troca obrigatória de senha temporária, isolamento de `STORE_ADMIN`, seletor de loja do `MASTER_ADMIN` e CRUD de usuários e lojas estão implementados. Há testes automatizados locais de regras e APIs com banco simulado; não há validação corporativa do LDAP.
- A coluna opcional `User.name` foi criada em produção por uma rotina aditiva no primeiro acesso. O histórico formal de `20261018230000_add_user_name` no Prisma Migrate ainda precisa ser verificado.

## Configuração de deploy versionada

O [vercel.json](../vercel.json) define os comandos do projeto. A versão principal do Node é fixada em `24.x` no `package.json`, conforme o [suporte da Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions). Os comandos seguem a [configuração oficial por arquivo](https://vercel.com/docs/project-configuration/vercel-json).

| Configuração | Valor |
| --- | --- |
| Root Directory | Raiz do repositório (`.`); conferir no painel da Vercel. |
| Framework | Next.js (`nextjs`). |
| Node.js | 24.x, também registrado em `.nvmrc` para desenvolvimento. |
| Install Command | `npm ci --include=dev`, usando o lockfile sem atualizar versões. |
| Build Command | `npm run vercel-build`. |
| Output Directory | `.next`. |

O build verifica configuração de ambiente, gera o Prisma Client, valida o schema, executa lint e testes e compila o Next.js. Qualquer falha interrompe o build. Não aplica migrations, não executa seed e não conecta ao banco para validar credenciais. `DATABASE_URL`, `DIRECT_URL` e `ADMIN_SESSION_SECRET` precisam estar presentes no ambiente de destino; `ADMIN_PASSWORD` só é necessária para provisionamento/recuperação e, se definida, precisa ter 12 a 128 caracteres. A chave de sessão exige pelo menos 32 bytes. URLs localhost são recusadas quando `VERCEL=1`.

Antes de publicar:

1. Execute `npm ci --include=dev` e `npm run vercel-build` com Node 24.x.
2. Inclua no commit os arquivos novos de `src/lib/`, `tests/`, `scripts/`, `.nvmrc` e `vercel.json`, além de todas as alterações relacionadas. Confira `git status` e `git diff --cached --check`. Nunca inclua arquivos `.env*` com valores reais.
3. Confira Root Directory, ramo `main` e variáveis do ambiente Production no painel. Se usar Preview, configure credenciais de staging nesse ambiente, separadas de produção.
4. Faça o commit/push quando pronto para publicar; a integração existente da `main` dispara produção. Após o status Ready, execute as verificações funcionais abaixo.

As mudanças desta revisão não adicionam tabelas, colunas ou migrations. Não é necessário executar comandos de banco para instalar estas correções. A pendência histórica de `User.name` deve ser tratada separadamente, com backup e conferência do estado real. As configurações remotas, WAF, backups e credenciais da Vercel não foram alterados por esta preparação local.

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
- Na identificação, confira LDAP de exatamente 8 dígitos, incluindo zeros iniciais, e nome com letras, acentos e espaços. O nome não tem limite de comprimento na validação da aplicação. Verifique a recusa de LDAP com letras/comprimento incorreto e nomes com números ou pontuação, tanto no formulário quanto por POST direto (400). Os registros anteriores não foram convertidos.
- Execute `npm run vercel-build` no código a publicar. Os testes usam banco simulado; faça testes funcionais em staging com PostgreSQL, incluindo operações simultâneas.
- Configure limites de tentativa/WAF para login e solicitação pública e monitore erros de autenticação e banco. Revise `npm audit` antes de atualizações de dependências.

## Correções locais de 19/10/2026

- `POST /api/inventory`: SAIDA subtrai o saldo e grava movimento negativo; ENTRADA soma e AJUSTE define o saldo final. Quantidade deve ser inteira entre 0 e 1.000.000. Saldo negativo é recusado com 409. A atualização compara o saldo lido e retorna 409 em conflito, sem gravar movimento na transação revertida.
- Os dois botões CSV enviam o `storeId` da loja exibida. A API mantém exportação global para MASTER_ADMIN sem filtro e força a loja da sessão para STORE_ADMIN.
- Cadastro e edição de lojas exigem cidade (2 a 100 caracteres) e UF brasileira válida. Lojas antigas com valores provisórios devem ser corrigidas pela interface; nenhum dado existente foi alterado automaticamente.
- Solicitações administrativas e públicas compartilham a verificação de saldo menos reservas PENDENTE, dentro de transação Serializable. Pedidos administrativos agregam linhas repetidas, limitam a 20 peças por variação e usam UUID no código. Indisponibilidade e conflitos de serialização retornam 409; o cliente deve atualizar os dados e tentar novamente.
- Testes automatizados cobrem sinais de movimentos, saldo insuficiente, conflito simulado de atualização, isolamento de loja, reservas, conflito de serialização simulado e localização. Não substituem testes de concorrência real no PostgreSQL nem validação visual dos formulários/CSV.
- Autoatendimento: formulário e API exigem LDAP numérico de 8 dígitos e nome apenas com letras, acentos e espaços, sem limite de comprimento. O LDAP continua sendo texto, preservando zeros iniciais. A integração com uma base de colaboradores e elegibilidade de uniformes está planejada no escopo, ainda não implementada.
- A suíte inclui testes de identificação, POST público com banco simulado e bloqueio de configuração de deploy inválida. Os resultados da preparação de release estão registrados abaixo.

## Pendências operacionais e de segurança

- Confirmar e regularizar o histórico de migrations em produção, especialmente `User.name`; a rotina DDL em runtime continua presente e exige permissões de alteração no banco. Não removê-la antes de confirmar a migration no ambiente.
- Configurar rate limit distribuído/WAF, monitoramento e backup restaurável no provedor. Não foram configurados nesta alteração.
- LDAP continua autodeclarado; integração corporativa e MFA exigem definição do provedor e regras de acesso.
- Revisar dependências com `npm audit` antes de cada release. O resultado final desta revisão está na seção de validação abaixo; ainda há avisos na cadeia de lint.
- O seed demonstrativo ainda usa senha fixa e apaga dados. Restringir a banco local descartável.
- Validar em staging saída/ajuste simultâneos, pedidos públicos e administrativos concorrentes, aprovação, CSV por loja e cadastro/edição de localização antes de publicar.

Nenhum deploy, push, migration ou acesso ao banco de produção foi executado nesta revisão.

## Validação da preparação de release — 19/10/2026

- Instalação limpa pelo lockfile realizada. Versão local: Node 24.21.0; requisito versionado: 24.x.
- `npm run vercel-build` passou: verificação de ambiente local, geração/validação do Prisma, lint, 13 testes e build Next.js.
- `npm run test:smoke` passou com 8 verificações HTTP em servidor local de produção: solicitação, login, CSS, logo, redirecionamento de acesso protegido, API sem sessão e dois pedidos com identificação inválida. O script substitui conexões por endereços fictícios; nenhum banco real é consultado.
- `npm audit --omit=dev`: zero vulnerabilidades reportadas. `npm audit` completo: 5 alertas altos relacionados à mesma cadeia `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`.
- O resultado anterior de zero alertas na árvore completa não se confirmou na consulta direta ao registro. Após instalação limpa, foram encontrados 10 alertas; as correções abaixo reduziram o total para 5.
- Overrides restritos e registrados no lockfile: PostCSS 8.5.31 para Next.js e deepmerge-ts 8.0.0 para `@prisma/config`. O segundo altera o tratamento de Maps e referências circulares; o projeto usa configuração simples, e a suíte valida seu carregamento pelo Prisma, além de geração e validação do schema. Revisar os overrides ao atualizar Next.js/Prisma. [Aviso deepmerge-ts](https://github.com/advisories/GHSA-ggr8-5vv4-36mx).
- O alerta restante de `braces` afeta padrões profundamente aninhados; não há versão corrigida publicada. Nesta árvore, ele é usado pelo lint durante desenvolvimento/build, com configuração do repositório, não pelas rotas da aplicação. Não é erro de compilação, mas permanece uma pendência de segurança das ferramentas; avaliar antes de executar builds de contribuições não confiáveis. Não foi aplicado o downgrade de `eslint-config-next` sugerido por `npm audit fix --force`. [Aviso braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

Limites: não houve teste de concorrência com PostgreSQL real nem verificação de credenciais, histórico de migrations, WAF ou backups no projeto remoto. A integração Vercel foi localizada, mas não está instalada/conectada nesta sessão. A chave de sessão ausente no ambiente local foi gerada em `.env.local`, ignorado pelo Git; a chave de produção não foi alterada.

Veja o contexto e a ordem sugerida de trabalho em [ESCOPO.md](./ESCOPO.md).
