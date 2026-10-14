# Gestão de uniformes

Aplicação full stack para controlar o estoque de uniformes de uma loja, registrar movimentações e acompanhar solicitações de colaboradores.

## Requisitos

- Node.js 20.19 ou superior e npm
- PostgreSQL 14 ou superior

## Configuração local

1. Instale as dependências com `npm install`.
2. Crie um banco PostgreSQL chamado `estoque_uniformes`.
3. Copie `.env.example` para `.env` e configure `DATABASE_URL`, `DIRECT_URL`, `ADMIN_PASSWORD` e `ADMIN_SESSION_SECRET`.
4. Use uma senha administrativa aleatória com pelo menos 20 caracteres e uma chave de sessão com no mínimo 32 bytes aleatórios.
5. Aplique as migrations: `npm run db:deploy`. Para bancos criados antes da migration inicial, faça o baseline uma única vez com `npx prisma migrate resolve --applied 20261013000000_init` depois de confirmar que o schema já está sincronizado.
6. Carregue os dados de demonstração, se necessário: `npm run db:seed`.
7. Inicie a aplicação: `npm run dev`. O painel fica em `http://localhost:3000` e a solicitação pública em `http://localhost:3000/solicitar`.

No primeiro login de um banco vazio, o painel mostra um formulário protegido para cadastrar código, nome, cidade e UF da loja. Esse passo não insere catálogo, colaboradores, saldo ou solicitações de demonstração. Em seguida, cadastre os uniformes reais em **Estoque → Cadastrar item** com o saldo inicial e estoque mínimo.

A senha administrativa local deste workspace foi gerada e está somente no `.env` ignorado pelo Git. Não a copie para arquivos versionados.

## Funcionalidades

- Painel por loja com total de peças, itens abaixo do mínimo e solicitações pendentes.
- Cadastro de uniformes por categoria, SKU, tamanho e cor, com saldo inicial e mínimo.
- Entradas e ajustes de estoque com registro de movimentação e proteção contra saldo negativo.
- Solicitações para colaboradores com múltiplos itens e quantidades.
- Área pública de autoatendimento em `/solicitar`, sem login, que identifica a pessoa por LDAP e nome antes de exibir o catálogo disponível.
- O catálogo público desconta solicitações pendentes do saldo exibido e valida novamente a disponibilidade ao enviar o pedido.
- Login administrativo em `/admin/login`, com sessão JWT em cookie HTTP-only, `SameSite=Strict` e proteção do painel/API.
- Login sem POST de senha: a tela envia credenciais via cabeçalho `Authorization: Basic` em GET sem cache e recebe o cookie de sessão HTTP-only.
- Edição administrativa por item de saldo disponível e estoque mínimo, com registro de movimentação para alterações de saldo.
- Exportação CSV autenticada do saldo atual e do histórico detalhado de solicitações.
- Aprovação ou recusa de solicitações; a aprovação baixa o saldo e registra a saída de forma transacional.
- APIs administrativas protegidas e endpoints públicos de login/solicitação em `/api/auth/*` e `/api/requests/public`.

## Vercel

- Importe o repositório e mantenha o framework Next.js detectado automaticamente.
- Configure `DATABASE_URL` com a URL de runtime/pooler do PostgreSQL e `DIRECT_URL` com a URL direta para migrations.
- Configure `ADMIN_PASSWORD` e `ADMIN_SESSION_SECRET` como variáveis sensíveis em Production, Preview e Development conforme necessário.
- O build usa `npm run build`; aplique migrations com `npm run db:deploy` antes de liberar a nova versão. Em um banco vazio, faça login após o deploy e cadastre a loja pelo formulário inicial. Não execute `db:push` no deploy de produção.
- O código não depende de APIs exclusivas do Live Server. As rotas e o middleware são executados pelo Next.js na Vercel.
- Antes de produção pública, revise `npm audit`; a árvore ainda contém vulnerabilidades transitivas cujas correções sugeridas envolvem upgrades maiores.

Ver o documento [docs/ESCOPO.md](docs/ESCOPO.md) para arquitetura, regras de negócio, segurança e checklist operacional.

## Observações

O seed cria uma loja, um usuário de demonstração e itens fictícios para validar os fluxos. O LDAP e o nome informados no formulário público não são autenticados contra um diretório corporativo. O painel usa uma senha administrativa compartilhada, sem contas individuais, recuperação de senha ou rate limit distribuído; aplique Vercel Firewall/limites de acesso antes de exposição pública. O audit atual reporta 10 vulnerabilidades transitivas; não aplique `npm audit fix --force` sem revisar as migrações maiores de Next.js/Prisma. Múltiplas lojas na interface e integrações externas ainda não fazem parte deste MVP.

Validações disponíveis: `npm run lint`, `npm run build`, `npx prisma validate` e `npm run db:deploy`.
