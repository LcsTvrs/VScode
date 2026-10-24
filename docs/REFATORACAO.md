# Refatoração por funcionalidades

Atualizado em 24/10/2026. Refatoração integrada na main pelo [PR #1](https://github.com/LcsTvrs/VScode/pull/1) e publicada em produção junto da solicitação por Setor na revisão funcional `011c067`. Pasta isolada de trabalho: `VScode-refatoracao`; a pasta original foi atualizada para a main após a autorização de produção. As seções de preparação abaixo são históricas.

## Evolução para produção — 24/10/2026

Preview aprovado pelo usuário; publicação em produção e reinício do estoque autorizados e concluídos. A release adiciona Setor e seleção progressiva ao catálogo público, sem transmitir saldos. Migração/backup/restauração/limpeza pontual em [PRODUCAO.md](./PRODUCAO.md). Validação ampliada: 76 testes, 56 casos de navegador, 19 checks HTTP e 12 resultados de integração PostgreSQL. Onze checks HTTP de produção aprovados, sete migrations concluídas, lojas/contas/colaboradores preservados e variáveis de produção intactas. Preview mantido na versão histórica aprovada; conferir a observação de schema em PRODUCAO.md antes de usá-lo para testar Setor. As seções seguintes registram a preparação original da refatoração, anterior à autorização de produção.

## Entregas locais

| Etapa | Resultado |
| --- | --- |
| Isolamento | Worktree próprio, dependências próprias, sessão local nova e banco sintético separado. |
| Organização | Funcionalidades auth, users, stores, dashboard, inventory e requests; entradas de página mantidas no App Router. |
| HTTP e usuários | Helper comum de respostas, status/código preservados, formulário/tabela/hook separados; falhas não apagam campos nem reenviam automaticamente. |
| Autorização | requireAdmin/requireMasterAdmin revalidam conta e bloqueiam troca pendente; middleware permanece independente de Prisma. |
| Painel | Navegação, visão geral, estoque, histórico e campos separados; hooks para consulta e operações. |
| Servidor | Operações de estoque, pedidos e imagens extraídas com transações integrais; Excel e recibos preservados. |
| Estilos | CSS dividido em seis arquivos, mantendo conteúdo e ordem da cascata. |
| Automação | Workflow de aplicação/UI e PostgreSQL descartável preparado, sem publicação automática. |

A descrição das fronteiras e responsabilidades fica em [ARQUITETURA.md](./ARQUITETURA.md).

## Referência e validação

Antes das alterações: Node 24, instalação pelo lockfile, Prisma/lint/build e 72 testes aprovados; 48 casos de navegador desktop/celular aprovados. Capturas originais em `.local/baseline-browser`, ignoradas pelo Git.

Depois das alterações:

- `npm run verify`: Prisma, lint, 75 testes e build aprovados.
- `npm run test:smoke`: 19 verificações HTTP aprovadas.
- `npm run test:ui -- --max-failures=1`: 52 casos desktop/celular aprovados, incluindo novos testes de HTML/429 nas telas administrativas.
- `npm run test:integration`: 11 resultados aprovados (um grupo e dez cenários), usando PostgreSQL 18 real, isolado e com dados sintéticos.
- CI executada e aprovada no GitHub para `b20b886`: [execução 40092664273](https://github.com/LcsTvrs/VScode/actions/runs/40092664273), com os jobs application e postgres concluídos com sucesso.
- Comparação de 26 capturas com as referências: mesmas dimensões em todas; 22 sem diferença acima de 10 níveis por canal. Quatro diferenças pequenas (até 0,623% dos pixels) ficam nas notificações animadas; pares mobile inspecionados, sem mudança de layout identificada. Métricas em `.local/visual-comparison.json`.

A integração confirma login temporário/troca/recuperação, revogação, escopo de loja, cadastro/classificação, conflito de estoque, aprovação concorrente com uma única baixa, edição por versão, rollback completo quando falta saldo no segundo item, Excel real com recibo sem duplicação, replicação de imagem por SKU e CSV autorizado. Ela cria identificadores próprios e remove somente as respectivas fixtures. Não mede carga/latência de produção nem comprova a liberação no filtro corporativo.

## Ambiente local

O worktree usa `.env.local` novo, sem copiar configurações da main ou da Vercel. Banco sintético `uniformes_refactor_test`, somente em `127.0.0.1:55439`. As seis migrations existentes foram aplicadas apenas nesse banco novo; não há migration nova.

Comandos a partir da pasta `VScode-refatoracao`:

```powershell
npm run dev:refactor
```

Desenvolvimento na porta 3108; testes de navegador na porta 3137. Usar perfis de navegador separados para evitar interferência entre cookies da aplicação original e da refatoração. O banco não contém contas reais nem cópia dos dados de produção.

Para executar a integração no cluster local preparado:

```powershell
$env:ALLOW_LOCAL_INTEGRATION = "1"
npm run test:integration
```

Se o cluster precisar ser reiniciado, usar o executável local do PostgreSQL 18 e o diretório `.local/postgres` deste worktree, porta 55439 e endereço 127.0.0.1. Para interrompê-lo, usar `pg_ctl stop` apontando para esse mesmo diretório. Nunca usar o diretório de dados de outro servidor.

`.env.local`, `.local`, capturas, logs e dados do cluster estão ignorados. Não copiar esses arquivos para commits, artefatos públicos ou Preview. O runner de integração recusa produção, hosts remotos, conexões divergentes e outro nome de banco.

## Preview publicado e revisão pendente

Publicação do Preview autorizada pelo usuário em 24/10/2026. Branch enviada e [PR #1 em rascunho](https://github.com/LcsTvrs/VScode/pull/1) aberto para revisão. O deployment de `b20b886` ficou Ready: [Preview da refatoração](https://estoqueuniformes-git-refatoracao-estrutura-oktus2.vercel.app). A integração Neon obrigatória foi conferida para Preview, e o build confirmou endpoint diferente do de produção. Onze verificações HTTP no deployment passaram, incluindo páginas, CSS, catálogo e proteções de sessão/origem. A proteção de acesso da Vercel foi mantida; o revisor pode precisar entrar na conta Vercel autorizada antes do login da aplicação.

Na revisão, comparar `main...refatoracao/estrutura`, com atenção aos novos helpers de autorização, operações transacionais e tratamento HTTP. Conferir as últimas correções da main antes de integrar, repetindo validações se houver conflitos ou mudanças novas.

Revisar o Preview, validar também na rede corporativa e só então decidir a integração na main. Não houve merge nem promoção a produção. A revisão de produção continuou em `4722fed`, e seus metadados/variáveis foram comparados antes e depois sem alteração. Registrar o commit/deployment estável anterior para rollback. Como não há alteração de schema, o retorno pode usar a versão anterior da aplicação, sem reversão de migration. Não executar seed nem db:push em produção.
