# Relatório de revisão técnica e funcional — Gestão de Uniformes

Implementação e validação: 30–31/10/2026; encerramento documental: 02/11/2026, horário de Brasília. Base: `main`, commit `6e3d7abf276407b56af98b0089998010dba3f40f`, conferido com a `main` remota antes das alterações. A configuração preexistente `.vscode/settings.json` foi preservada e não integra a entrega.

## Resultado e escopo

Revisados instruções do repositório, README, arquitetura, escopo, produção, módulos de autenticação, dashboard, catálogo, estoque, solicitações, importação/lotes, lojas/usuários e respectivas suítes. Implementadas melhorias de consulta, comunicação de estados, teclado/foco, prevenção de duplicação, seleção em massa e documentação. Não houve reformulação visual ampla, dependência nova, mudança de regra de negócio ou schema.

### Problemas confirmados e prioridade

| Prioridade | Evidência na versão-base | Mudança implementada e benefício |
| --- | --- | --- |
| Alta | `dashboard-page.tsx` mostrava “sincronizados” incondicionalmente, mesmo com falha; banner recomendava executar carga inicial. | Estado real de carregamento/falha/sucesso, mensagem de recuperação sem operação destrutiva e botão de nova tentativa. Dados antigos da mesma loja são preservados, com ações bloqueadas após falha. |
| Alta | `action-dialog.tsx` usava `div/section`, fechava ao clicar fora e permitia Fechar/Cancelar durante envio. Não continha navegação de foco. | Componente de diálogo nativo reutilizável, foco inicial, ciclo de Tab/Shift+Tab, retorno ao acionador, fundo inerte e Escape com confirmação de descarte após mudanças. Salvamento bloqueia fechamento e edição. |
| Alta | `use-dashboard-actions.ts`, cadastros de usuários/lojas e algumas janelas dependiam apenas de estado React, ou não tinham trava síncrona. Erros de ações usavam notificação de sucesso. | Travas por referência contra chamadas simultâneas, campos desabilitados durante envio, erro persistente na janela ou alerta com aparência própria. Movimento/pedido com resultado incerto bloqueia reenvio e orienta conferir o resultado. |
| Média | `GET /api/dashboard` buscava histórico e colaboradores completos para abrir a visão geral. | Interface usa contrato compacto: mantém estoque integral e indicadores; devolve até quatro pendências, histórico sob demanda e colaboradores por loja ao abrir pedido. Redução mensurada do JSON apenas no cenário sintético descrito abaixo. |
| Média | Histórico tinha apenas filtro local por dia; todos os pedidos eram renderizados/carregados. | Consulta no servidor com situação, nome/LDAP, dia/período de Brasília e páginas de 25. Totais do escopo e encontrados explícitos; CSV completo preservado. |
| Média | `inventory-panel.tsx` fazia `.slice(0, 200)` ao unir seleção anterior e novo filtro, podendo selecionar só parte sem explicar. | União acima do limite é recusada integralmente, preservando a seleção anterior e orientando a refiná-la. Mais de 200 registros no filtro recebe orientação explícita. |
| Média | Indicador “Abaixo do mínimo” usava `quantity <= minimum`. | Rótulo **No mínimo ou abaixo**; regra e valor do indicador preservados. |
| Média | Token de texto secundário `#78817a` tinha contraste calculado 4,02:1 sobre branco e 3,71:1 sobre o fundo `#f5f6f2`. | Token `#626e65`: 5,33:1 e 4,91:1 nesses fundos. Foco visível também em links; preferência de movimento reduzido respeitada. Isso não representa auditoria completa de acessibilidade. |
| Média | README/documentos misturavam funcionamento atual com releases antigas, regras superadas de exclusão e aprovações já concluídas. | Documentos atuais reescritos; conteúdo anterior preservado em arquivos históricos identificados. |

### Funcionalidades já existentes, preservadas

Não foram apresentadas como novas correções: isolamento de STORE_ADMIN nas APIs; visão consolidada do Master; catálogo compartilhado com estoque independente; transações Serializable, reservas, versões e rollback; limite público de três peças e administrativo de 20; importação integral com conferência e recibo idempotente; histórico preservado na exclusão de catálogo; catálogo público sem saldos internos; autenticação individual, troca imediata de senha temporária e corpo de resposta compatível com filtro externo.

As verificações de autorização/concorrência não identificaram uma nova vulnerabilidade confirmada nesses fluxos. A identificação pública por LDAP continua autodeclarada, conforme escopo existente; integração corporativa permanece recomendação, não funcionalidade entregue.

## Implementação e arquivos principais

| Área | Arquivos | Comportamento entregue |
| --- | --- | --- |
| Leitura do painel | `src/app/api/dashboard/route.ts`, `features/dashboard/hooks/use-dashboard.ts`, `types.ts` | `compact=1`, projeções menores nas relações, quatro pendências e contagem integral, sem colaboradores iniciais. Contrato anterior sem parâmetro preservado. Respostas antigas não substituem novo escopo. |
| Histórico | `src/app/api/requests/route.ts`, `features/requests/server/history.ts`, `components/history-panel.tsx` | Filtros validados, ordenação por data/ID, contagens e página em snapshot RepeatableRead, limites de dias de Brasília inclusive horário de verão histórico. Requisições antigas canceladas, estados de erro/vazio distintos e navegação explícita. |
| Colaboradores | `src/app/api/employees/route.ts`, `features/dashboard/components/action-dialog.tsx` | Consulta somente após abrir solicitação para uma loja; escopo da sessão prevalece. Nenhum corte silencioso no seletor. |
| Operações e feedback | `features/dashboard/hooks/use-dashboard-actions.ts`, `components/dashboard-page.tsx`, `overview-panel.tsx` | Travas síncronas, proteção de resultado incerto, mensagens persistentes, indicador corretamente nomeado e horário de Brasília no cabeçalho. |
| Janelas | `src/components/operation-dialog.tsx` e diálogos de ação, lote, opções, exclusão, escolha de loja, imagem e edição de pedido | Reuso da modalidade nativa e comportamento de teclado. Botões explícitos de Fechar/Cancelar continuam intencionais; Escape após alteração pede confirmação. Importação mantém sua implementação nativa e recibo de recuperação. |
| Seleção | `features/inventory/components/inventory-panel.tsx` | Sem truncamento na união entre filtros; busca com nome acessível. Estoque, total, CSV e seleção dos registros zerados preservados. |
| Contas e lojas | Hooks/componentes de `features/users` e `features/stores` | Bloqueio de submissões concorrentes e mudanças no formulário durante envio; ações de tabela desabilitadas durante operação; datas exibidas em Brasília. |
| Estilos | `src/app/styles/base.css`, `forms.css` | Contraste do token secundário, foco em links, mensagens de erro, disposição responsiva dos filtros e movimento reduzido. |
| Regressões | `tests/request-history-api.test.ts`, `tests/browser/review-improvements.spec.ts`, `admin-errors.spec.ts`, `tests/integration/business-flows.test.ts`, `scripts/smoke-test.mjs` | Cobertura das consultas e defeitos corrigidos, inclusive escopo adulterado, limites temporais, última página, CSV integral, foco, campos preservados e duplo envio. |
| Documentação | `README.md`, `docs/ARQUITETURA.md`, `ESCOPO.md`, `PRODUCAO.md`, `HISTORICO-*.md` | Separação entre regras atuais, procedimentos de publicação e registros históricos, sem apagar a memória operacional. |

## Preservação de dados e regras

- Estoque permanece completo, inclusive zerados, sem paginação nesta revisão. Não se introduziu `take` nos saldos. Indicadores não dependem da página do histórico.
- Histórico retorna `total`, `filteredTotal`, `page`, `pages`, `pageSize` e registros. Páginas de 25 não são um limite oculto; última página e acesso aos 61 pedidos sintéticos foram verificados. Página além do fim é ajustada e informada.
- CSV continua completo para o escopo autorizado, independentemente de filtros ou páginas da tela. Integração verificou os 61 códigos adicionais no CSV da loja, sem dados da outra unidade.
- Consulta compacta e consulta integral retornaram métricas e variantes idênticas no banco sintético. STORE_ADMIN enviando `storeId` de outra unidade permaneceu restrito à própria loja, inclusive em histórico e colaboradores.
- Nenhuma transação de escrita foi dividida ou substituída. Reservas, aprovação, recusa, importação, versões, limites e preservação de histórico continuam no servidor.
- Nenhum dado real foi usado para testes. Não houve reset, seed, limpeza de dados reais, alteração de credenciais ou nova migration. `.env*` não foi editado. O cluster de teste foi criado em `.local/review-postgres`, porta local 5558, banco `uniformes_refactor_test`; a suíte remove somente suas fixtures.

## Testes e evidências

Ambiente: Windows, Node `v24.21.0`, PostgreSQL 18 isolado e Chromium com viewports 1280×900 e 390×844. APIs dos testes de interface são simuladas; integração executa handlers com Prisma/PostgreSQL real e contas sintéticas. Datas de pedidos incluem fronteira UTC/Brasília; teste de navegador original usa fuso UTC para detectar dependência indevida do dispositivo.

| Comando/verificação | Resultado registrado |
| --- | --- |
| `npx tsc --noEmit` | Aprovado após ajustar a inferência do include Prisma. |
| `npm run verify` | Aprovado no código final: Prisma generate/validate, lint, **100 testes aprovados** e build. Há somente aviso de depreciação futura de `package.json#prisma`. |
| `npm run test:ui -- --max-failures=3` | **104 cenários aprovados** no build final, em desktop/celular, incluindo resposta inválida após movimentação. |
| `npm run test:integration` | **21 resultados aprovados** (grupo + 20 cenários), incluindo a nova consulta. URLs limitadas ao banco local sintético e `ALLOW_LOCAL_INTEGRATION=1`. |
| `npm run test:smoke` | **21 verificações HTTP aprovadas** no build final, incluindo bloqueio das duas novas consultas. Banco real inacessível. |
| `npm run check:deploy-env` | Formato/presença válidos; não verifica credenciais ou conectividade e não imprime valores. |
| `npm audit --omit=dev --json --fetch-timeout=15000 --fetch-retries=0` | **Zero alertas** na consulta desta execução. |
| `npm audit --json --fetch-timeout=15000 --fetch-retries=0` | **Zero alertas**, incluindo ferramentas, na consulta desta execução; não é garantia de ausência de vulnerabilidades. |
| `git diff --check` | Sem erros nas verificações realizadas. |
| CI remota da implementação | Jobs `application` e `postgres` aprovados: [execução 41209629469](https://github.com/LcsTvrs/VScode/actions/runs/41209629469), incluindo verify, smoke, UI e integração em Linux/PostgreSQL descartável. |
| `node .local/review-http.cjs` | **12 verificações públicas de produção aprovadas**, estilos novos presentes e catálogo público sem saldos internos. Somente GET; nenhuma operação gravou dados. |

Tentativas iniciais de testes/build, Playwright e engine Prisma foram bloqueadas pelo Windows/sandbox com `spawn EPERM`; as mesmas operações foram repetidas com a permissão de execução necessária. Não se contornou a restrição usando dados de produção. A primeira rodada de UI parou com três seletores de teste ambíguos; foram corrigidos. A seguinte detectou duas falhas reais de ciclo de Tab (desktop/celular), corrigidas antes da rodada completa de 102 aprovados. Um teste novo de API esperava 403 para sessão STORE_ADMIN sem loja, mas a autenticação existente corretamente a rejeita com 401; a expectativa foi corrigida sem enfraquecer a autenticação.

Logs locais ignorados: `.local/review-verify.log`, `review-ui.log`, `review-integration.log`, `review-smoke.log`, `review-migrations.log`, `review-deploy-env.log` e relatórios de audit. `test-results/` contém screenshots e diagnósticos do Playwright.

### Medidas com alcance limitado

No cenário de integração com **61 pedidos sintéticos adicionais** ao fluxo já exercitado, o mesmo painel de loja retornou **37.815 bytes** no contrato integral e **2.729 bytes** no compacto (JSON serializado), com métricas/variantes iguais. A medição está no log da integração. Não foi medido tempo de resposta, uso de CPU/memória nem tráfego comprimido de produção; não se afirma ganho de latência.

A redução de leitura do histórico é limitada por consulta a quatro pendências por loja no painel e 25 pedidos na página. Contagens ainda percorrem o escopo consultado; busca textual pode exigir avaliação de índices com volume real. Estoque integral continua sendo o principal ponto futuro de crescimento.

### Capturas

Capturas finais, exclusivamente sintéticas, versionadas:

- [Histórico — desktop](imagens/revisao-2026-10-31/historico-desktop.png)
- [Histórico — celular](imagens/revisao-2026-10-31/historico-mobile.png)
- [Movimentação com erro — desktop](imagens/revisao-2026-10-31/movimentacao-erro-desktop.png)
- [Movimentação com erro — celular](imagens/revisao-2026-10-31/movimentacao-erro-mobile.png)

As capturas foram inspecionadas; filtros e ações permanecem acessíveis sem transbordamento horizontal da página. Testes também cobrem catálogo público, estoque, importação, lojas e usuários nos dois tamanhos.

## Recomendações e limites — não implementados ou não validados

| Prioridade | Pendência | Motivo/próximo passo |
| --- | --- | --- |
| Média | Paginação de estoque e busca de colaboradores no servidor | Manter seleção entre páginas, totais e exportação exige desenho próprio. Estoque integral foi preservado para evitar regressão e cortes silenciosos; medir volume/planos antes de evoluir. |
| Média | Idempotência durável de movimento/pedido administrativo | Trava de interface não cobre abas novas ou envio fora da UI. Requer contrato e armazenamento de recibo; não adicionados sem necessidade nesta revisão. |
| Média | Carga máxima/latência de produção | Integração cobre atomicidade, concorrência e processamento de páginas, mas não mede lote de 200 sob carga de produção. Ensaiar carga sintética representativa em staging. |
| Média | Leitores de tela, Safari/Firefox e celular físico | Chromium emulado e teclado foram verificados; não há teste manual com tecnologias assistivas ou aparelhos reais. Não declarar conformidade completa de acessibilidade. |
| Média | Identidade corporativa, MFA, backups, monitoramento e WAF | Exigem acesso/decisão de infraestrutura; não alterados nem revalidados nesta revisão. Identificação LDAP continua autodeclarada. |
| Baixa | Depreciação de configuração Prisma | Aviso referente à futura versão 7; versão 6 e lockfile preservados. Planejar migração de configuração junto de atualização testada. |
| Baixa | Metadados históricos imutáveis | Histórico acompanha nomes/classificação do catálogo, comportamento existente. Snapshot demandaria decisão funcional e possivelmente schema novo. |

Não foram usados usuários reais para testar operações autenticadas em produção. Verificações públicas pós-publicação, quando registradas abaixo, não equivalem a teste funcional autenticado nem auditoria de infraestrutura.

## Banco, configuração e publicação

Sem migration nova, alteração de schema, dependência ou variável. As nove migrations existentes apenas inicializaram o cluster sintético novo. O código anterior `6e3d7ab` permanece compatível com o schema para rollback; recarregar abas após mudança de versão. Não desfazer registros operacionais ao reverter código.

Publicação concluída pela autorização permanente de 28/10/2026 e pelo fluxo de [PRODUCAO.md](PRODUCAO.md). Revisão funcional **`5be4add5adcb1819a36443730657f8167cfd3147`**, enviada à `main`. A integração GitHub/Vercel registrou o deployment Production **`7459803659`** com `success` / “Deployment has completed”, associado exatamente a esse SHA. Deployment Vercel: **`dpl_ESQJ4oHnoQApUARFTwwfXR68xtvW`**. Confirmação pública às **11:22 de 31/10/2026, Brasília**: [domínio principal](https://estoqueuniformes.vercel.app), 12 checks HTTP aprovados, CSS novo servido e ausência de saldos internos no catálogo público.

A [CI da implementação](https://github.com/LcsTvrs/VScode/actions/runs/41209629469) aprovou os jobs `application` e `postgres`: build/verificações, UI e regras críticas no PostgreSQL descartável remoto. Evidência pública do deployment: [status no GitHub](https://api.github.com/repos/LcsTvrs/VScode/deployments/7459803659/statuses). Evidências locais somente de resultados em `.vercel/review-http-checks.json`; nenhuma credencial ou dado do catálogo foi gravado nesse arquivo.

**Limitação operacional:** a API privada da Vercel respondeu 403 `Not authorized` com a credencial local, inclusive fora da sandbox. Metadados privados e logs internos desse provedor não puderam ser consultados. O sucesso da publicação foi confirmado pelo deployment/status associado ao SHA e pelo domínio principal; os passos detalhados de build foram confirmados pela CI GitHub. Não se declara inspeção de logs privados da Vercel nem nova auditoria do banco/WAF/backups de produção.

A documentação e as capturas são entregues em commit separado, sem alteração adicional do código validado. Recarregue as abas administrativas para receber os novos fluxos. A configuração local preexistente `.vscode/settings.json` permanece fora dos commits.
