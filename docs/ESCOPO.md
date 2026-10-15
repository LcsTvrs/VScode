# Escopo do projeto

## Objetivo

Aplicação web full stack para controlar uniformes de uma loja Leroy Merlin, com estoque por variação, movimentações, autoatendimento de solicitações e análise/aprovação por administrador.

## Stack e execução

- Next.js 15 App Router, React 19 e TypeScript.
- PostgreSQL com Prisma Client e migrations versionadas.
- CSS responsivo em `src/app/globals.css`; interface e API em português brasileiro.
- Node.js 20.19 ou superior.
- Execução local: `npm run dev`.
- Build de produção: `npm run build`.
- Aplicação de migrations: `npm run db:deploy`.
- Seed demonstrativa: `npm run db:seed`.

## Perfis e fluxos

### Colaborador

- Acessa `/solicitar` sem login.
- Informa LDAP e nome antes de consultar o catálogo.
- Visualiza somente variações com saldo disponível após considerar solicitações pendentes.
- Seleciona quantidades e envia o pedido.
- Recebe um código de solicitação; o pedido inicia como `PENDENTE`.

LDAP e nome são dados informados pelo usuário e não são verificados em diretório corporativo.

### Administrador

- Acessa `/admin/login` com login individual e senha armazenada como hash bcrypt no model `User`.
- A sessão JWT em cookie HTTP-only contém `userId`, `login`, `role`, `storeId` e `mustChangePassword`.
- Utilizadores criados com senha temporária ou que receberam reset devem trocar a senha uma vez; o MASTER_ADMIN inicial usa a senha `ADMIN_PASSWORD` do provisionamento e não recebe troca obrigatória.
- `STORE_ADMIN` opera somente na loja associada à sessão. `MASTER_ADMIN` pode selecionar uma loja para operações ou consultar exports globais.
- `MASTER_ADMIN` consulta/cria lojas em `/admin/lojas` e consulta/cria utilizadores em `/admin/usuarios`; a senha temporária do novo acesso é exibida uma única vez.
- Visualiza estoque e solicitações identificadas por nome e LDAP.
- Pode aprovar/recusar solicitações; aprovar baixa o estoque e grava a saída na mesma transação.
- Pode registrar entradas/ajustes ou editar quantidade disponível e estoque mínimo por variação.
- Sair remove o cookie de sessão.

### Primeiro acesso em banco vazio

- Após login, o dashboard identifica `STORE_NOT_CONFIGURED` e mostra um formulário protegido para cadastrar código, nome, cidade e UF da unidade real.
- A configuração cria somente o registro da loja; não insere uniforme, estoque, funcionário ou pedido de demonstração.
- Depois do cadastro, o administrador adiciona os uniformes reais no painel com saldo inicial e estoque mínimo.

## Modelo de dados

- `Store`: loja, código e localização.
- `Employee`: LDAP único opcional, nome, e-mail opcional e loja.
- `UniformVariant`: SKU, categoria, tamanho e cor.
- `StockLevel`: saldo e mínimo por loja/variação.
- `StockMovement`: entradas, saídas e ajustes auditáveis.
- `UniformRequest`: código, colaborador, loja, estado e observações.
- `RequestItem`: variação e quantidade pedidas.

Categorias: camiseta, calça, jaqueta, colete e outro. Estados: pendente, aprovada e recusada.

## Rotas

### Páginas

- `/`: painel administrativo protegido.
- `/admin/login`: login administrativo.
- `/admin/lojas`: gestão de lojas para MASTER_ADMIN.
- `/admin/usuarios`: gestão de utilizadores para MASTER_ADMIN.
- `/admin/trocar-senha`: troca obrigatória no primeiro acesso.
- `/solicitar`: autoatendimento público.

### API

- `POST /api/auth/login`: valida login/senha no model `User` com bcryptjs e cria cookie JWT de sessão.
- `POST /api/auth/change-password`: exige sessão, grava o hash da nova senha e renova o JWT.
- `POST /api/auth/logout`: encerra a sessão.
- `GET/POST /api/stores`: lista/cria lojas; exclusivo de MASTER_ADMIN.
- `GET/POST /api/users`: lista/cria usuários; exclusivo de MASTER_ADMIN. O POST gera uma senha temporária de 10 caracteres e persiste somente o hash.
- `GET /api/dashboard`: métricas, estoque e solicitações; exige sessão.
- `POST /api/variants`: cadastra variação e saldo inicial; exige sessão.
- `POST /api/inventory`: registra entrada/ajuste; exige sessão.
- `PATCH /api/inventory`: altera saldo absoluto e mínimo; exige sessão.
- `POST /api/requests`: cria pedido pelo painel; exige sessão.
- `PATCH /api/requests/[id]`: aprova ou recusa; exige sessão.
- `GET /api/requests/public`: catálogo de saldo público.
- `POST /api/requests/public`: cria pedido sem login, validando novamente o saldo.
- `GET /api/exports/inventory`: exporta o saldo atual por variação em CSV; exige sessão.
- `GET /api/exports/requests`: exporta o histórico, com uma linha por item solicitado, em CSV; exige sessão.

Middleware protege `/`, `/admin/:path*` e `/api/:path*`, exceto login, troca de senha, logout durante troca obrigatória e rotas públicas de solicitação. Quando `mustChangePassword` está ativo, o painel e demais APIs ficam bloqueados. Não ignorar `src/app/api` no Git: a proteção é aplicada em runtime.

## Configuração e segredos

Variáveis necessárias:

- `DATABASE_URL`: URL de runtime do PostgreSQL; pode ser a URL com pooler.
- `DIRECT_URL`: URL direta para comandos Prisma/migrations.
- `ADMIN_SESSION_SECRET`: segredo aleatório com pelo menos 32 bytes.

Localmente, guardar os valores em `.env`, nunca no Git. Na Vercel, criar as três variáveis como secrets/env vars nos ambientes desejados. Cookie administrativo: HTTP-only, `SameSite=Strict`, sessão de 8 horas e `Secure` em produção.
Cabeçalhos de resposta incluem `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` e HSTS em produção.

## Segurança e limitações conhecidas

- `.gitignore` exclui `.env*` (exceto exemplos), chaves privadas, backups e artefatos; confira `git check-ignore .env` antes de publicar.
- O nome/LDAP não autenticam identidade corporativa.
- A aplicação ainda não tem MFA, recuperação de senha ou rate limiting distribuído. Configurar Vercel Firewall/rate limits antes de disponibilizar publicamente.
- O middleware protege a aplicação, mas nenhuma API deve ser considerada protegida se for adicionada fora do matcher ou sem teste de `401` anônimo.
- A interface administrativa ainda não oferece seletor de loja no dashboard principal; a gestão de lojas/usuários cobre consulta e criação, mas edição, exclusão e reset de senha ainda não existem. O autoatendimento público suporta URLs `/solicitar?loja=CODIGO`.
- Nunca registrar senha, cookie, `DATABASE_URL` ou `ADMIN_SESSION_SECRET` em logs.
- O audit npm atual reporta 10 vulnerabilidades transitivas. As correções propostas envolvem upgrades maiores; avaliar Next.js/Prisma e repetir lint/build antes de produção pública.

## Deploy e operação na Vercel

1. Criar PostgreSQL gerenciado e configurar as três variáveis em Vercel Project Settings > Environment Variables.
2. Para um banco novo, executar `npm run db:deploy`; ele cria tabelas a partir de `prisma/migrations`.
3. Para o banco local existente que foi criado por `db:push`, a migration inicial já foi marcada como aplicada por baseline. Em outro banco existente, revisar o schema e marcar baseline somente depois de confirmar que ele corresponde à migration.
4. Deploy Next.js padrão. O build executa `prisma generate && next build`; não executar migrations dentro do build.
5. Em futuras alterações de schema, criar migration com Prisma em desenvolvimento, revisar SQL, aplicar no banco de staging e usar `npm run db:deploy` no fluxo de release.
6. Seed é apenas para desenvolvimento; não executar automaticamente em produção.

## Verificações

- `npm run lint`
- `npm run build`
- `npx prisma validate`
- `npm run db:deploy`
- Verificar que `/` e `/api/dashboard` retornam redirect/401 sem sessão.
- Verificar que `/solicitar` e `/api/requests/public` permanecem públicos.
- Testar login, cookie, logout, aprovação e edição de estoque em staging.
