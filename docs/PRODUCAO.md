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
