# Produção e publicação — procedimento atual

Atualizado em 11/11/2026. Ambiente principal: https://estoqueuniformes.vercel.app. Histórico de migrations, backups, ensaios, deployments e autorizações: [HISTORICO-PRODUCAO-ATE-2026-10-28.md](HISTORICO-PRODUCAO-ATE-2026-10-28.md). Não interpretar estados antigos de preparação como pendências atuais.

## Autorização e fluxo

A autorização permanente registrada em 28/10/2026 permite publicar as alterações solicitadas e realizar os próximos deploys sem nova confirmação por publicação. O fluxo é commit/push da `main` para a integração Vercel do projeto `estoque_uniformes`, conferindo deployment Ready, SHA exato e domínio principal. A autorização não dispensa validação, preservação de alterações locais, backup/ensaio quando houver migration ou cuidados com dados reais.

1. Conferir versão remota e alterações locais. Não incluir arquivos de ambiente, segredos, backups ou configuração pessoal de IDE no commit.
2. Executar `npm run verify`, `npm run test:smoke` e os testes de interface pertinentes em desktop/celular. Para regras/consultas críticas, usar PostgreSQL isolado com dados sintéticos e `npm run test:integration`.
3. Conferir ambiente com `npm run check:deploy-env` ou `npm run vercel-build`, sem imprimir valores. Builds validam/geram Prisma, lint, testes e Next; **não aplicam migrations**.
4. Publicar pela integração Git e conferir o build remoto, SHA, domínio estável e proteção das APIs. Não criar pedidos, movimentações ou contas reais como smoke test.
5. Registrar comandos, resultados, limitações e evidências. Recarregar abas antigas após publicação.

## Foto por classificação na solicitação — 11/11/2026

Corrigida a prévia em `/solicitar`: a foto aparece somente após escolher uniforme e classificação, independentemente do tamanho. Trocar o tamanho preserva a foto; trocar a classificação atualiza a imagem e limpa o tamanho. Textos de orientação atualizados. Regras completas em [PREVIA-SOLICITACAO.md](PREVIA-SOLICITACAO.md). Sem migration, dependência ou variável nova.

Validação local com Node 24.21.0: `npm run verify` aprovado (Prisma, lint, 104 testes, tipos e build), `npm run check:deploy-env` aprovado e `npm run test:smoke` com 23 verificações HTTP aprovadas. O comando `npx playwright test tests/browser/request-edit.spec.ts -g "colaborador escolhe"` passou em desktop e celular (2 testes). Conferência adicional por navegador automatizado com APIs e imagens sintéticas, em 1280 e 390 px, confirmou foto oculta antes da classificação, imagens masculina/feminina antes do tamanho, estabilidade entre P/M e ocultação ao limpar a classificação. Essa conferência adicional foi pontual e não adicionou um teste versionado. Nenhum teste usou dados reais.

Commit [`a5ee5f630a111e6a13a270626fccd05ecdcbc7c7`](https://github.com/LcsTvrs/VScode/commit/a5ee5f630a111e6a13a270626fccd05ecdcbc7c7) enviado à `main`. A integração GitHub registrou status Vercel `success` para esse SHA no [deployment HBm56F3M1EfG9RJsyRZJuSAq3bvg](https://vercel.com/oktus2/estoque_uniformes/HBm56F3M1EfG9RJsyRZJuSAq3bvg). No domínio principal, os arquivos JavaScript servidos por `/solicitar` continham a orientação atualizada; `/solicitar` e `/admin/login` retornaram 200, `/api/dashboard` e `/api/requests?page=1` retornaram 401 e `/preview/solicitar` retornou 404. Verificação de produção somente de leitura, sem criar pedidos. Não foram inspecionados logs privados da Vercel nesta revisão.

Para os próximos prompts, manter a dinâmica de implementação, validação, documentação, commit/push e acompanhamento do deploy, sem nova confirmação por publicação dentro do escopo autorizado. Preservar `.vscode/settings.json`, que permanece local e não versionado. Recarregar abas antigas após publicação. Rollback desta correção pode usar `6d6ffad`, sem alterar banco ou registros operacionais.

## Revisão de 30–31/10/2026

Histórico paginado com filtros no servidor; painel compacto e colaboradores sob demanda; estados de consulta/erro corrigidos; diálogos acessíveis e proteção contra envios duplicados; seleção entre filtros sem truncamento; documentação atual separada do histórico. Revisão funcional `5be4add` publicada em 31/10/2026; deployment Production `7459803659` concluído, CI GitHub aprovada e 12 verificações públicas no domínio principal aprovadas. A API privada da Vercel retornou 403; não foram inspecionados seus logs privados. Ver [RELATORIO-MELHORIAS.md](RELATORIO-MELHORIAS.md) para evidências e limites.

**Sem migration, dependência ou variável nova.** Nenhum reset, seed, limpeza, edição de saldo real, alteração de senha ou alteração de configuração remota faz parte desta revisão. As nove migrations existentes foram aplicadas somente a um cluster PostgreSQL novo com fixtures sintéticas para a integração. O schema e as transações de escrita do produto permaneceram iguais.

Compatibilidade: `/api/dashboard` sem `compact=1` mantém o contrato anterior; a interface atual usa `compact=1`, `GET /api/requests` e `GET /api/employees`. Rollback para `6e3d7ab` não exige reversão de banco; reconstrua/republique o código anterior e recarregue abas. Não reverta registros operacionais efetuados pelos usuários como parte do rollback de código.

## Layout de solicitação — 10/11/2026

Nova apresentação de `/solicitar`: identidade Leroy Merlin, imagem ilustrativa compactada, identificação, seleção progressiva com prévia da peça, resumo com quantidades e confirmação copiável. Estilos limitados à área pública; fotos cadastradas continuam vinculadas aos itens reais. A rota `/preview/solicitar` usa dados sintéticos apenas em desenvolvimento e retorna 404 no build de produção.

Sem migration, dependência ou variável nova. Validação em cópia isolada fora do OneDrive com Node 24.22.2: `npm run verify` (lint, tipos, 104 testes e build), smoke HTTP com 23 verificações e 106 cenários Playwright em desktop/celular. Na execução completa, 104 passaram; os dois cenários com expectativa do texto anterior foram corrigidos e passaram na repetição. Prévia demonstrativa validada também em 320 px, sem chamadas à API de solicitações.

Publicar pela integração da `main` e conferir o SHA do deployment Ready e o domínio principal. A verificação pública deve ser somente de leitura. Rollback do layout pode usar `7d5fb82`, sem alterar banco ou registros operacionais. Imagem e prompt: [PREVIA-SOLICITACAO.md](PREVIA-SOLICITACAO.md).

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
