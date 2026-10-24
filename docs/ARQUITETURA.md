# Arquitetura por funcionalidades

Evolução local de 24/10/2026: `inventory/server/catalog.ts` passa a coordenar o catálogo global, validando opções e sincronizando variantes locais em transação Serializable. `UniformCatalog` mantém metadados e versão próprios; saldos e pedidos preservam as relações compostas existentes. Cadastro, imagens, opções e criação de lojas compartilham uma trava transacional para manter o catálogo completo. Edição de estoque não escreve metadados. `catalog-fields.tsx` e `catalog-options-dialog.tsx` cuidam dos seletores e da manutenção de opções. Requer a oitava migration; ainda sem publicação. O restante deste documento registra a refatoração anterior.

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
