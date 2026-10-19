# Instruções do repositório

Este é o projeto Gestão Uniformes: Next.js App Router, React, TypeScript, Tailwind CSS, Prisma e PostgreSQL. A interface é em português brasileiro. Leia [docs/ESCOPO.md](../docs/ESCOPO.md) antes de continuar o projeto; ele reúne arquitetura, rotas, dados, permissões, implantação, estado conhecido e pendências. Para operações no banco e na Vercel, consulte também [docs/PRODUCAO.md](../docs/PRODUCAO.md).

## Regras de implementação

- Há contas individuais `MASTER_ADMIN` e `STORE_ADMIN`. O login valida o hash bcrypt em `User.passwordHash`; `ADMIN_PASSWORD` só serve para provisionamento e scripts administrativos pontuais. Não trate essa variável como senha compartilhada de todas as sessões.
- Toda API administrativa deve conferir sessão, papel e escopo de loja no servidor. `STORE_ADMIN` opera somente na loja do vínculo da conta; parâmetros enviados pelo navegador não podem ampliar esse escopo.
- A rota pública `/solicitar` coleta LDAP e nome informados pelo visitante. Não há autenticação no diretório corporativo.
- Login e nome de exibição do usuário são campos distintos; código e nome de loja também. Mostre o nome na interface, com login como fallback para contas legadas sem nome.
- Preserve transações e validações de saldo em movimentações e aprovações. Não permita saldo negativo nem vínculos entre dados de lojas diferentes.
- Não execute `db:seed` ou `db:push` em produção. Antes de migrations, confira banco e histórico, faça backup restaurável e ensaie em staging.
- Nunca inclua segredos, hashes, cookies, tokens ou URLs de banco em documentação ou commits. Os arquivos `.env`, `.env.local` e `.vercel` devem continuar ignorados.
- Atualize [README.md](../README.md), [docs/ESCOPO.md](../docs/ESCOPO.md) e [docs/PRODUCAO.md](../docs/PRODUCAO.md) quando alterar fluxos, schema, segurança ou deploy.

## Validação

Use Node.js 24.x e `npm run verify` quando houver mudanças de código ou schema: gera/valida o Prisma, executa lint, testes e build. Os testes usam cliente Prisma simulado; verifique os fluxos com PostgreSQL em staging e registre os limites do que foi testado. `npm run vercel-build` inclui a validação de ambiente sem expor segredos nem conectar ao banco. Não acrescente migrations, seed ou redefinições de senha ao build.
