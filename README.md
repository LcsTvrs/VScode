# Gestão de uniformes

Aplicação full stack para controlar o estoque de uniformes de uma loja, registrar movimentações e acompanhar solicitações de colaboradores.

## Requisitos

- Node.js 20 ou superior e npm
- PostgreSQL 14 ou superior

## Configuração local

1. Instale as dependências com `npm install`.
2. Crie um banco PostgreSQL chamado `uniformes_leroy`.
3. Copie `.env.example` para `.env` e ajuste `DATABASE_URL` para as credenciais do seu PostgreSQL.
4. Gere o cliente Prisma e crie as tabelas: `npm run db:generate` e `npm run db:push`.
5. Carregue os dados de demonstração: `npm run db:seed`.
6. Inicie a aplicação: `npm run dev` e acesse `http://localhost:3000`.

## Funcionalidades

- Painel por loja com total de peças, itens abaixo do mínimo e solicitações pendentes.
- Cadastro de uniformes por categoria, SKU, tamanho e cor, com saldo inicial e mínimo.
- Entradas e ajustes de estoque com registro de movimentação e proteção contra saldo negativo.
- Solicitações para colaboradores com múltiplos itens e quantidades.
- Aprovação ou recusa de solicitações; a aprovação baixa o saldo e registra a saída de forma transacional.
- API no App Router em `/api/dashboard`, `/api/variants`, `/api/inventory` e `/api/requests`.

## Observações

O seed cria uma loja, um usuário de demonstração e itens fictícios para validar os fluxos. Autenticação corporativa, permissões por perfil, múltiplas lojas na interface e integrações externas ainda não fazem parte deste MVP. Antes de disponibilizar dados reais, configure autenticação, autorização, backups e as políticas de segurança do ambiente PostgreSQL.
