# Produção e publicação — procedimento atual

Atualizado na revisão de 30–31/10/2026. Ambiente principal: https://estoqueuniformes.vercel.app. Histórico de migrations, backups, ensaios, deployments e autorizações: [HISTORICO-PRODUCAO-ATE-2026-10-28.md](HISTORICO-PRODUCAO-ATE-2026-10-28.md). Não interpretar estados antigos de preparação como pendências atuais.

## Autorização e fluxo

A autorização permanente registrada em 28/10/2026 permite publicar as alterações solicitadas e realizar os próximos deploys sem nova confirmação por publicação. O fluxo é commit/push da `main` para a integração Vercel do projeto `estoque_uniformes`, conferindo deployment Ready, SHA exato e domínio principal. A autorização não dispensa validação, preservação de alterações locais, backup/ensaio quando houver migration ou cuidados com dados reais.

1. Conferir versão remota e alterações locais. Não incluir arquivos de ambiente, segredos, backups ou configuração pessoal de IDE no commit.
2. Executar `npm run verify`, `npm run test:smoke` e os testes de interface pertinentes em desktop/celular. Para regras/consultas críticas, usar PostgreSQL isolado com dados sintéticos e `npm run test:integration`.
3. Conferir ambiente com `npm run check:deploy-env` ou `npm run vercel-build`, sem imprimir valores. Builds validam/geram Prisma, lint, testes e Next; **não aplicam migrations**.
4. Publicar pela integração Git e conferir o build remoto, SHA, domínio estável e proteção das APIs. Não criar pedidos, movimentações ou contas reais como smoke test.
5. Registrar comandos, resultados, limitações e evidências. Recarregar abas antigas após publicação.

## Revisão de 30–31/10/2026

Histórico paginado com filtros no servidor; painel compacto e colaboradores sob demanda; estados de consulta/erro corrigidos; diálogos acessíveis e proteção contra envios duplicados; seleção entre filtros sem truncamento; documentação atual separada do histórico. Revisão funcional `5be4add` publicada em 31/10/2026; deployment Production `7459803659` concluído, CI GitHub aprovada e 12 verificações públicas no domínio principal aprovadas. A API privada da Vercel retornou 403; não foram inspecionados seus logs privados. Ver [RELATORIO-MELHORIAS.md](RELATORIO-MELHORIAS.md) para evidências e limites.

**Sem migration, dependência ou variável nova.** Nenhum reset, seed, limpeza, edição de saldo real, alteração de senha ou alteração de configuração remota faz parte desta revisão. As nove migrations existentes foram aplicadas somente a um cluster PostgreSQL novo com fixtures sintéticas para a integração. O schema e as transações de escrita do produto permaneceram iguais.

Compatibilidade: `/api/dashboard` sem `compact=1` mantém o contrato anterior; a interface atual usa `compact=1`, `GET /api/requests` e `GET /api/employees`. Rollback para `6e3d7ab` não exige reversão de banco; reconstrua/republique o código anterior e recarregue abas. Não reverta registros operacionais efetuados pelos usuários como parte do rollback de código.

## Banco e migrations

### Ordenação e visibilidade nas solicitações — 10/11/2026

O estoque e o CSV passam a ordenar por nome, classificação e tamanho. Na aba Estoque, gestores podem ocultar ou liberar um SKU na própria loja; o master também pode aplicar uma restrição global, inclusive para lojas futuras. A restrição global prevalece sobre a local. O servidor filtra o catálogo e bloqueia novas solicitações de itens ocultos, preservando saldo, movimentos e pedidos existentes. Detalhes: [VISIBILIDADE-UNIFORMES.md](VISIBILIDADE-UNIFORMES.md).

Migração aditiva `20261110000000_uniform_request_visibility`: duas colunas booleanas com padrão `false`. O procedimento desta publicação inclui backup completo, restauração em banco local separado, ensaio e comparação dos dados antes/depois, seguido da aplicação em produção antes do código. Backups e evidências operacionais ficam em arquivos ignorados pelo Git. Rollback de código pode manter as colunas adicionais, mas uma versão anterior não aplica as regras de ocultamento; não remova colunas nem reverta registros operacionais como parte do rollback.

Validação: `npm run verify` (104 testes, lint, Prisma e build), teste específico de visibilidade em desktop/celular (2 testes), PostgreSQL isolado com dados sintéticos (23 testes), smoke HTTP local (21 verificações) e configuração de deploy. A API privada da Vercel retornou 403; o acompanhamento remoto usa o GitHub e verificações públicas, sem criação de registros de negócio em produção.

A migração foi aplicada em produção com as duas colunas e a visibilidade inicial preservadas. Uma desconexão P1017 ocorreu após o DDL; foram conferidos schema, valores padrão e hashes de todas as tabelas de negócio contra a cópia restaurada. A sessão ociosa da própria migração, sem transação aberta e ainda com o lock do Prisma, foi encerrada. O histórico foi regularizado com `prisma migrate resolve --applied`, após essas verificações, sem repetir o DDL.

### Correção de SKU — 09/11/2026

O Cadastro global permite ao Master Admin alterar o SKU. A interface envia `originalSku` e a versão do catálogo; a API valida origem, versão e disponibilidade do destino, incluindo cadastros arquivados. A relação existente `ON UPDATE CASCADE` propaga o código às variantes, mantendo IDs, saldos, mínimos, fotos, pedidos e movimentações. Clientes anteriores podem continuar editando metadados sem `originalSku`.

Sem migration, dependência ou variável nova. Validação local: `npm run verify` (101 testes, lint, Prisma e build), Playwright do catálogo em desktop/celular (10 testes), integração PostgreSQL sintética (22 testes), `npm run test:smoke` (21 verificações HTTP) e `npm run check:deploy-env`. A integração confirma a preservação dos vínculos e a recusa de destinos ativos/arquivados e versões antigas. O build apresentou avisos da dependência `jose` sobre Edge Runtime, sem impedir a conclusão.

Publicar por commit/push da `main` e conferir o SHA exato no deployment, o domínio principal e as APIs protegidas. A validação pública de produção não altera SKUs reais nem substitui os testes autenticados com dados sintéticos. Recarregar abas antigas após a publicação. Rollback de código não desfaz SKUs já alterados pelos usuários.

O último registro histórico informa nove migrations aplicadas em produção, incluindo `20261028000000_archive_uniform_catalog`. Esta revisão não usa esse registro como uma nova inspeção remota do banco. Não há nova migration a aplicar.

Para uma futura mudança de schema: confirmar explicitamente o destino e histórico; obter backup completo restaurável; restaurar em ambiente separado; ensaiar a migration; comparar registros e schema; definir compatibilidade/rollback e eventual janela sem gravações. Somente então aplicar no destino e publicar código compatível. Nunca executar `db:push` ou `db:seed` em produção. Não reutilizar as rotinas históricas de reinício de estoque.

Exclusões de catálogo atuais dependem de `deletedAt`: preservar variantes e histórico e manter esse filtro em qualquer rollback compatível. Alterações já gravadas não são desfeitas por rollback da aplicação.

## Ambiente e autenticação

- Node 24.x; instalação pelo lockfile com dependências de desenvolvimento; Vercel usa a raiz do repositório e `npm run vercel-build`.
- `DATABASE_URL` para runtime/pooler, `DIRECT_URL` para migrations, `ADMIN_SESSION_SECRET` com pelo menos 32 bytes. `ADMIN_PASSWORD` só provisiona a primeira conta ou serve a scripts explícitos; não altera logins existentes automaticamente.
- Senhas temporárias exigem troca imediatamente. Preservar o POST de login/troca e o corpo `{"ok":true,"mustChangePassword":false}` por compatibilidade com o filtro externo. Não redefinir contas para testar release.
- Preview Neon usa banco próprio por deployment e chave de sessão exclusiva. O build valida URLs dinâmicas e bloqueia reutilização do destino de produção. Não copiar configurações de produção para testes/Preview.
- `.env*`, `.local`, `.vercel`, backups, tokens e traces privados não devem ser publicados. Capturas versionadas nesta revisão contêm somente dados sintéticos.

## Verificação após publicação

Conferir login e autoatendimento, assets, redirecionamento do painel sem sessão e 401 nas novas APIs protegidas. Confirmar que o catálogo público não transmite `quantity`, `minimum` ou reservas. Fluxos autenticados completos devem ser verificados em staging com dados de teste; verificações públicas de produção não comprovam esses fluxos.

Monitoramento, retenção de backups, regras WAF e restrições do plano exigem acesso ao provedor e continuam como verificações operacionais separadas. Consulte o relatório para o que foi efetivamente validado nesta execução.
