# Arquitetura atual — 31/10/2026

## Organização

| Local | Responsabilidade |
| --- | --- |
| `src/app` | Páginas, layouts e handlers HTTP: autorização, validação e resposta. |
| `src/features/auth` | JWT, senha e revalidação da conta no servidor. |
| `src/features/dashboard` | Composição, indicadores, consultas e ações administrativas. |
| `src/features/inventory` | Catálogo, estoque, fotos, importação e lotes transacionais. |
| `src/features/requests` | Autoatendimento, histórico paginado, edição, reservas e processamento. |
| `src/features/users`, `stores` | Administração central, formulários e seleção de unidade. |
| `src/components/operation-dialog.tsx` | Modalidade nativa, foco inicial/retorno, Escape com confirmação de descarte e proteção durante envio. |
| `src/lib` | Prisma, ambiente, respostas HTTP, JSON limitado, CSV e redirecionamento seguro. |
| `src/app/styles` | CSS por área, identidade existente e responsividade. |

Componentes/hooks usam HTTP; o lint proíbe imports de Prisma e diretórios `server` nessas camadas. Middleware valida JWT sem importar banco. Handlers administrativos revalidam a conta, versão da sessão, perfil e troca pendente. STORE_ADMIN sempre deriva a loja da sessão.

## Leituras e estado de interface

`GET /api/dashboard?compact=1` é o contrato usado pela interface. Mantém todos os saldos (sem corte ou paginação), busca até quatro pendentes por loja e devolve os quatro mais recentes do escopo. Conta todos os pedidos pendentes separadamente e calcula os indicadores sobre todos os saldos. Colaboradores ficam ausentes dessa carga. Relações de pessoa/item e versão de catálogo usam projeções menores. Sem `compact=1`, o contrato integral anterior permanece disponível para compatibilidade.

`GET /api/requests` consulta histórico somente quando a área Solicitações está aberta. Parâmetros: `storeId`, `search` (nome/LDAP, até 120 caracteres), `status`, `start`, `end` e `page`. Retorna `requests`, `total`, `filteredTotal`, `page`, `pages` e `pageSize=25`. Datas civis são convertidas em limites UTC de Brasília, inclusive mudanças históricas de horário de verão; fim é exclusivo no dia seguinte. Ordenação estável por `createdAt desc, id desc`. Contagens e página usam transação `RepeatableRead`. Página além do fim é ajustada para a última disponível, informando a página real. Filtros inválidos retornam 400.

`GET /api/employees?storeId=...` busca colaboradores apenas quando uma solicitação administrativa é aberta para uma loja. Projeta identificação e contato necessários ao seletor, sem limite silencioso. O administrador de loja não consegue trocar o escopo pelo parâmetro.

`useDashboard` descarta respostas antigas e mantém os dados durante atualização da mesma loja. Falhas são explícitas; os dados preservados ficam sem ações até nova consulta bem-sucedida. Troca de loja limpa dados do escopo anterior. O histórico cancela consultas ultrapassadas, espera 250 ms entre mudanças de filtros e distingue carregamento, erro e resultado vazio. Não há reenvio automático de mutações.

Formulários usam travas síncronas por referência e estados visuais de envio. Erros de operação aparecem na janela; erros de processamento de pedido usam alerta persistente. Movimento/criação de pedido com resposta incerta bloqueia reenvio na janela e orienta conferir os dados. Isso reduz duplicação acidental na interface; **não equivale a idempotência geral no servidor**. Importação mantém seu recibo durável.

## Escritas e integridade

| Módulo `server` | Unidade atômica preservada |
| --- | --- |
| `inventory/operations.ts` | Saldo, versão, cobertura das reservas e movimento. |
| `inventory/bulk.ts` | Até 200 registros explícitos, versões e alterações integrais. |
| `inventory/catalog.ts` | Catálogo global e réplicas por loja; trava compartilhada com criação de loja/imagens. |
| `inventory/import.ts` | Conferência de todos os SKUs, soma e recibo idempotente. |
| `inventory/image-assignment.ts` | Versões, atribuição/replicação e limpeza de imagens sem referência. |
| `requests/create-request.ts` | Disponibilidade, colaborador público quando aplicável e reserva. |
| `requests/operations.ts` | Versão/status, substituição de itens ou aprovação com baixa e movimentos. |

As escritas críticas usam `Serializable`; não dividir uma transação em gravações independentes. Exclusão do catálogo preenche `deletedAt` e remove saldos zerados, mantendo variantes e vínculos históricos. Estoques não são campos do catálogo compartilhado. Histórico acompanha os metadados do cadastro; não há snapshot imutável de nomes antigos.

Login/troca mantêm sua autenticação especial e o corpo de sucesso corrigido para compatibilidade externa. `readApiResponse` trata HTML, JSON inválido, 429, conflitos e 204. A revisão não muda schema, regras de senha ou transações de escrita.

## Validação e limites

`npm run verify`, smoke, Playwright desktop/celular e integração PostgreSQL isolada. CI usa dados sintéticos e não publica automaticamente. Testes, evidências, medidas e limitações desta revisão estão em [RELATORIO-MELHORIAS.md](RELATORIO-MELHORIAS.md). Leituras ainda integrais de estoque, exportações e colaboradores por loja são candidatas a otimização após medir volume real e desenhar a seleção entre páginas.

A evolução anterior está em [HISTORICO-ARQUITETURA-ATE-2026-10-28.md](HISTORICO-ARQUITETURA-ATE-2026-10-28.md); regras de exclusão física e aprovações pendentes ali descritas pertencem às versões antigas.
