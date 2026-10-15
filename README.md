# Gestão de uniformes

Aplicação full stack para controlar o estoque de uniformes de uma loja, registrar movimentações e acompanhar solicitações de colaboradores.

## Requisitos

- Node.js 20.19 ou superior e npm
- PostgreSQL 14 ou superior

## Configuração local

1. Instale as dependências com `npm install`.
2. Crie um banco PostgreSQL chamado `estoque_uniformes`.
3. Copie `.env.example` para `.env` e configure `DATABASE_URL`, `DIRECT_URL` e `ADMIN_SESSION_SECRET`.
4. Use uma chave de sessão com no mínimo 32 bytes aleatórios. As credenciais são lidas da tabela `User`; cada usuário precisa ter senha bcrypt.
5. Aplique as migrations: `npm run db:deploy`. Para bancos criados antes da migration inicial, faça o baseline uma única vez com `npx prisma migrate resolve --applied 20261013000000_init` depois de confirmar que o schema já está sincronizado.
6. Em um banco de desenvolvimento descartável, sincronize o schema multi-loja e execute `npm run db:seed` para recriar os dados iniciais.
7. Inicie a aplicação: `npm run dev`. O painel fica em `http://localhost:3000` e a solicitação pública em `http://localhost:3000/solicitar`.

O primeiro usuário precisa existir na tabela `User`. O seed cria uma conta demonstrativa (`admin` / `admin123`) com bcrypt, mas apaga todos os dados do banco; use-o apenas em ambiente local descartável. O fluxo administrativo de criação de usuários e provisionamento inicial em produção ainda precisa ser operado por um procedimento seguro fora do seed.

A migration multi-loja só faz backfill automático de instalações legadas com no máximo uma loja e deve ser ensaiada em staging com backup restaurável antes de qualquer uso. Consulte [docs/PRODUCAO.md](docs/PRODUCAO.md) para o estado e os passos de release.

## Funcionalidades

- Painel por loja com total de peças, itens abaixo do mínimo e solicitações pendentes.
- Cadastro de uniformes por categoria, SKU, tamanho e cor, com saldo inicial e mínimo.
- Entradas e ajustes de estoque com registro de movimentação e proteção contra saldo negativo.
- Solicitações para colaboradores com múltiplos itens e quantidades.
- Área pública de autoatendimento em `/solicitar`, sem login, que identifica a pessoa por LDAP e nome antes de exibir o catálogo disponível.
- O catálogo público desconta solicitações pendentes do saldo exibido e valida novamente a disponibilidade ao enviar o pedido.
- Login administrativo em `/admin/login`, com sessão JWT em cookie HTTP-only, `SameSite=Strict` e proteção do painel/API.
- Login individual via `POST /api/auth/login`, validado contra `User.passwordHash` com bcryptjs; o JWT em cookie HTTP-only inclui usuário, perfil, loja e estado da troca obrigatória de senha.
- Primeiro acesso redireciona para `/admin/trocar-senha`; o backend verifica a sessão, grava o hash novo e renova o cookie.
- APIs de loja derivam o escopo `STORE_ADMIN` da sessão; o `MASTER_ADMIN` pode selecionar uma loja ou consultar exports globais.
- Edição administrativa por item de saldo disponível e estoque mínimo, com registro de movimentação para alterações de saldo.
- Exportação CSV autenticada do saldo atual e do histórico detalhado de solicitações.
- Aprovação ou recusa de solicitações; a aprovação baixa o saldo e registra a saída de forma transacional.
- Painel MASTER_ADMIN para consultar/criar lojas e utilizadores; novos acessos recebem uma senha temporária de uso único e devem alterá-la no primeiro login.
- APIs administrativas protegidas e endpoints públicos de login/solicitação em `/api/auth/*` e `/api/requests/public`.

## Vercel

- Importe o repositório e mantenha o framework Next.js detectado automaticamente.
- Configure `DATABASE_URL` com a URL de runtime/pooler do PostgreSQL e `DIRECT_URL` com a URL direta para migrations.
- Configure `ADMIN_SESSION_SECRET` como variável sensível, com pelo menos 32 bytes aleatórios. Não existe mais `ADMIN_PASSWORD` global.
- O build usa `npm run build`. Não execute `db:push` ou `db:seed` em produção; cumpra o checklist de [docs/PRODUCAO.md](docs/PRODUCAO.md) antes de liberar o deploy.
- O código não depende de APIs exclusivas do Live Server. As rotas e o middleware são executados pelo Next.js na Vercel.
- Antes de produção pública, revise `npm audit`; a árvore ainda contém vulnerabilidades transitivas cujas correções sugeridas envolvem upgrades maiores.

Ver o documento [docs/ESCOPO.md](docs/ESCOPO.md) para arquitetura, regras de negócio, segurança e checklist operacional.

## Observações

O seed cria uma loja, usuário de demonstração e itens fictícios; não execute em produção. O LDAP e o nome do formulário público não são autenticados em diretório corporativo. A aplicação ainda não tem rate limit distribuído nem painéis de gestão de usuários/lojas do MASTER_ADMIN; configure firewall/rate limits e conclua esses fluxos antes de exposição ampla. O audit reporta dependências transitivas vulneráveis; avalie as atualizações sugeridas sem aplicar `npm audit fix --force` sem revisão.

Validações disponíveis: `npm run lint`, `npm run build`, `npx prisma validate` e `npm run db:deploy`.
