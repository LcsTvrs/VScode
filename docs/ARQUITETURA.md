# Arquitetura por funcionalidades

## Uniformes comuns a todos os setores — 26/10/2026

No formulário público, o setor `Todos` (sem distinção de caixa/espaços externos) identifica uniformes comuns: aparecem junto às peças do setor escolhido e não geram uma opção de setor. `requests/sectors.ts` centraliza essa identificação. A API pública retorna `sectors`, derivado dos cadastros da loja inclusive sem saldo, excluindo `Todos`; assim setores sem peças próprias disponíveis ainda podem solicitar peças comuns. `variants` continua contendo somente itens com saldo disponível após reservas, sem expor quantidades. O seletor mantém os IDs originais e o resumo acumula a mesma peça mesmo ao trocar de setor. Se houver somente cadastros comuns, a escolha de uniforme é liberada sem seletor de setor. Sem mudança de schema ou escrita de dados.

## Exclusão de cadastro de uniforme — 26/10/2026

`DELETE /api/variants` revalida MasterAdmin e exige SKU e versão do catálogo. `deleteCatalog` usa a trava compartilhada do catálogo e transação Serializable; bloqueia saldo diferente de zero em qualquer loja e qualquer pedido ou movimentação vinculados. Remove saldos zerados, réplicas e cadastro canônico nessa ordem, preservando históricos e outros cadastros. Não requer migration. A ação “Excluir cadastro” na tabela abre `delete-catalog-dialog.tsx`, que informa o alcance global e pede confirmação antes do envio.

Planilha de estoque de Morumbi aplicada em produção em 26/10/2026: 100 novos SKUs, 1.196 peças somente na loja 0012; campo vazio de `MCLRYPL0050324203` convertido em zero por orientação do usuário. Cadastro compartilhado inclui as lojas futuras com saldo inicial zero. Dados anteriores preservados; detalhes operacionais em [PRODUCAO.md](./PRODUCAO.md).

## Publicado: operações entre lojas — 26/10/2026

Sem alteração de schema. A rota de dashboard monta o mesmo contrato de painel para uma loja ou todas, acrescentando o proprietário de cada saldo/pedido. O catálogo global e as relações compostas existentes são mantidos. O hook de consulta descarta respostas antigas; os componentes mantêm o filtro entre áreas e vinculam ações à loja da linha. Janelas de movimentação, criação de pedidos e importação escolhem explicitamente uma loja quando abertas no consolidado.

`inventory/bulk.ts` contém tipos, validação pura e cálculo dos resultados usados na conferência. `inventory/server/bulk.ts` ordena e grava os registros selecionados em uma única transação Serializable, reutilizando `editStockInTransaction` de `inventory/server/operations.ts`. O helper não abre transação aninhada. As operações individuais também usam Serializable; `assertReservationCoverage` confere as reservas antes de reduzir saldo. `bulk-dialog.tsx` mantém um retrato dos registros conferidos e bloqueia reenvio após uma confirmação incerta até recarregar o estoque.

`DELETE /api/catalog/options` revalida MasterAdmin, adquire a trava existente do catálogo, confere vínculos no catálogo e nas réplicas e remove exclusivamente a opção livre. Não usa cascatas nem altera outras entidades. A confirmação pertence ao `catalog-options-dialog.tsx`.

Integrado à `main` e publicado com autorização do usuário na revisão funcional `a3e6af8`, sem migration. Deployment Ready no domínio principal e 17 verificações HTTP aprovadas; detalhes em [PRODUCAO.md](./PRODUCAO.md). As seções seguintes descrevem as releases anteriores.

Evolução publicada em 26/10/2026, revisão funcional `dcde66f`: `inventory/server/catalog.ts` coordena o catálogo global, validando opções e sincronizando variantes locais em transação Serializable. `UniformCatalog` mantém metadados e versão próprios; saldos e pedidos preservam as relações compostas existentes. Cadastro, imagens, opções e criação de lojas compartilham uma trava transacional para manter o catálogo completo. Edição de estoque não escreve metadados. `catalog-fields.tsx` e `catalog-options-dialog.tsx` cuidam dos seletores e da manutenção de opções. A oitava migration está aplicada em produção, com dados preservados. O restante deste documento registra a refatoração anterior.

Revisão local de 24/10/2026, branch `refatoracao/estrutura`. Referência funcional: `4722fed`. Stack, schema e contratos HTTP preservados.

## Organização

| Local | Responsabilidade |
| --- | --- |
| src/app | Entradas de páginas/layouts e handlers HTTP: interpretação, validação, autorização e resposta. |
| src/features/auth | Sessão JWT e política de senha; server revalida a conta; components contém login e troca. |
| src/features/users | Hook de operações, formulário, tabela e janela copiável. |
| src/features/stores | Administração de lojas, seleção e validação de localização. |
| src/features/dashboard | Composição, navegação, visão geral e hooks de consulta/ações. |
| src/features/inventory | Estoque, campos, imagens, Excel e operações transacionais. |
| src/features/requests | Pedidos públicos/administrativos, histórico, edição e operações transacionais. |
| src/lib | Infraestrutura compartilhada: Prisma, ambiente, JSON limitado, CSV, HTTP e redirecionamento seguro. |
| src/app/styles | CSS de base, painel, formulários, solicitação pública, autenticação e responsividade. |

## Fronteiras

Componentes e hooks consultam APIs HTTP. O lint impede imports de Prisma e módulos server nesses diretórios. Regras puras e tipos ficam fora de server; banco, arquivos e processamento de imagem ficam dentro. O middleware usa apenas JWT e não importa módulos de banco. Cada API usa requireAdmin ou requireMasterAdmin para revalidar a conta no banco, a pendência de troca e o perfil. A loja de STORE_ADMIN continua derivada da sessão; consultas de pedidos mantêm o vínculo composto por loja.

Login e troca têm autenticação especial para permitir senha temporária e recuperação após perda de resposta. Manter POST /api/auth/login e o sucesso {"ok":true,"mustChangePassword":false}; não retomar o corpo genérico bloqueado pelo filtro externo. requireAdmin destina-se às operações após a troca obrigatória.

## Transações

| Módulo | Unidade atômica |
| --- | --- |
| inventory/server/operations.ts | Saldo, controle de concorrência e movimento. |
| requests/server/create-request.ts | Reserva, colaborador público quando aplicável e itens do pedido. |
| requests/server/operations.ts | Versão/status, substituição de itens ou aprovação com baixa e movimentos. |
| inventory/server/import.ts | Conferência, soma do lote e recibos duráveis. |
| inventory/server/image-assignment.ts | Conferência da seleção, atribuição/replicação e limpeza de imagens sem uso. |

As extrações mantêm as transações e suas opções originais, inclusive Serializable e timeout da importação. Não chamar um serviço que abra outra transação para uma parte da mesma gravação. Não há camada de repositórios que apenas replique o Prisma.

## Estado da interface e falhas

useUsers controla dados e ações; UsersForm e UsersTable apresentam a tela. useDashboard controla consulta e carregamento; useDashboardActions controla envios e operação em andamento. A composição mantém somente o estado compartilhado entre áreas. Campos de estoque e pedidos pertencem às suas funcionalidades.

readApiResponse trata JSON inválido, HTML de proxy, HTTP 429 e exclusão sem conteúdo (204). ApiResponseError preserva status e código para conflitos/redirecionamentos. Não há repetição automática: resposta perdida pode corresponder a gravação concluída. Importação mantém recuperação pelo mesmo recibo.

globals.css importa os arquivos na ordem original. Classes e marcação foram preservadas; não houve redesenho. Comparar desktop/celular, teclado, foco e estados desabilitados ao alterar estilos.

## Validação

Executar npm run verify, npm run test:smoke e npm run test:ui. Para operações críticas, também executar integração PostgreSQL isolada. O runner exige ALLOW_LOCAL_INTEGRATION=1, hosts locais, conexões coincidentes e banco uniformes_refactor_test. Recusa produção/endpoints remotos antes de importar a aplicação; só remove fixtures identificadas pela própria execução.

O workflow verify.yml prepara aplicação/UI com banco inacessível e integração em PostgreSQL descartável. Não publica a aplicação nem usa segredos reais. Execução no GitHub depende da publicação autorizada da branch.

Não há nova migration. O Preview foi publicado com autorização para revisão. Merge na main e promoção a produção permanecem pendentes de aprovação. Consulte [REFATORACAO.md](./REFATORACAO.md) e [PRODUCAO.md](./PRODUCAO.md).

## Seleção pública por setor

UniformVariant.sector agrupa os modelos da loja; o componente requests/components/uniform-selector.tsx encadeia Setor, modelo (nome/categoria/cor), classificação e tamanho. O estado do resumo é separado da escolha atual, permitindo incluir peças de setores distintos. Disponibilidade é filtrada apenas no servidor, descontando pedidos pendentes. Não incluir quantity/available/minimum no contrato público. Conflito de reserva atualiza o catálogo sem reenvio e exige retirar itens indisponíveis.
