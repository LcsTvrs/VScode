# Escopo atual — Gestão de Uniformes

Revisão de 30–31/10/2026. Este documento descreve o código atual. Releases e decisões anteriores foram preservadas em [HISTORICO-ESCOPO-ATE-2026-10-28.md](HISTORICO-ESCOPO-ATE-2026-10-28.md). Resultados desta revisão: [RELATORIO-MELHORIAS.md](RELATORIO-MELHORIAS.md).

## Perfis e fluxos

| Perfil | Acesso e fluxo |
| --- | --- |
| MASTER_ADMIN | Começa em Todas as lojas; filtro comum à visão geral, estoque e solicitações. Administra lojas/contas e catálogo global. Operações de uma linha mantêm a loja da própria linha; criação de pedidos, movimentação e importação no consolidado exigem loja explícita. |
| STORE_ADMIN | Painel, pedidos, movimentação, importação e edição de saldo/mínimo somente da própria unidade. APIs ignoram tentativa de ampliar loja pela URL/corpo. Sem manutenção do catálogo global, fotos, lotes administrativos, lojas ou usuários. |
| Colaborador | Autoatendimento sem login em `/solicitar`: loja, LDAP e nome; escolha por setor → uniforme → classificação → tamanho; revisão do pedido e comprovante. LDAP é autodeclarado, sem consulta ao diretório corporativo. |

Login individual com bcrypt e sessão JWT HTTP-only, SameSite=Strict, validade de oito horas. APIs revalidam a conta e sua versão no banco. Senha temporária exige troca antes de painel/APIs, sem carência; `passwordChangeDeadline` permanece apenas por compatibilidade. Criação/reset mostra a senha uma única vez em janela copiável. Reset próprio só redireciona após fechar essa janela. Não permitir exclusão da própria conta ou alteração do próprio perfil.

Login e troca preservam `POST /api/auth/login` e o corpo `{"ok":true,"mustChangePassword":false}`, que resolveu bloqueio externo por assinatura de resposta. Não substituir pelo corpo genérico antigo. `ADMIN_PASSWORD` serve ao provisionamento, não substitui a senha bcrypt de usuários existentes.

## Catálogo, estoque e histórico

- Catálogo compartilhado por SKU; variantes locais mantêm IDs e vínculos históricos. Master Admin mantém nome, SKU, setor, categoria, classificação e tamanho. A troca de SKU no Cadastro global vale para todas as lojas e preserva saldos, mínimos, fotos, pedidos e movimentações; o novo SKU não pode pertencer a outro cadastro, inclusive arquivado. Cor histórica permanece consultável, mas não integra o novo cadastro. Opções de setor/categoria podem ser criadas/renomeadas; exclusão exige ausência de vínculos.
- Criação de item ou loja completa os pares loja/SKU com saldo zero e mínimo inicial 5. Saldo/mínimo posteriores são independentes. Metadados e fotos são comuns, inclusive para lojas futuras.
- Saldo menor **ou igual** ao mínimo entra no indicador **No mínimo ou abaixo**. A regra não mudou.
- Estoque mostra todos os registros, inclusive zerados, sem paginação. Busca por setor/nome/SKU/tamanho/classificação e categoria são locais. Contagem exibida/total e alcance da seleção são explícitos. Seleção permanece entre filtros; união acima de 200 é recusada sem seleção parcial. Mais de 200 registros no filtro exige refinar ou selecionar individualmente.
- Estoque em massa, exclusivo do Master, permite preservar saldo, definir saldo final, adicionar/retirar peças e/ou mudar mínimo. Prévia integral, até 200 registros de lojas distintas, transação única e revalidação de vínculos, versões, reservas e limites.
- Entrada soma, saída subtrai, ajuste define o saldo absoluto. Movimento grava o delta assinado. Saldo negativo, saldo final acima de 1.000.000 ou redução abaixo do reservado são recusados.
- Exclusão do cadastro exige saldo zero em todas as lojas. Arquiva `UniformCatalog.deletedAt`, remove saldos zerados e preserva variantes, pedidos e movimentos. Não aparece nos fluxos ativos nem em novas lojas. Recadastro do SKU reativa os vínculos com saldo zero. Nomes históricos acompanham o cadastro; snapshot imutável ainda não existe.
- Fotos: JPG/PNG/WebP, até 2 MB e 16 megapixels, sem animação, compactadas no servidor e armazenadas no PostgreSQL. Foto individual ou dos SKUs selecionados em até 200 registros; versões e destinos conferidos antes da gravação.

## Solicitações e consultas

- Pedido PENDENTE reserva peças sem baixar saldo. Aprovação baixa saldo e registra saídas na mesma transação; recusa libera reserva. Edição do pendente recalcula reserva e exige versão atual. Processado não pode ser editado.
- Até 20 linhas; repetição do mesmo item é agregada. Limite público de três peças por item/pedido, administrativo de 20, respeitando disponibilidade. LDAP tem exatamente oito dígitos, preservando zeros; nome aceita letras, acentos e espaços. O catálogo público mostra disponibilidade, sem quantity/minimum/reservas no contrato.
- Setor `Todos`, sem distinção de caixa/espaços externos, identifica peças comuns. Elas aparecem junto às peças do setor selecionado; setor sem peça própria disponível ainda pode oferecer peças comuns.
- Painel compacto carrega todos os saldos, indicadores integrais e até quatro pendências recentes. Histórico é consultado ao abrir Solicitações; colaboradores ao abrir pedido administrativo para uma loja. O endpoint sem `compact=1` preserva compatibilidade com o contrato anterior.
- Histórico no servidor: nome/LDAP, situação, dia/período inclusivo no horário de Brasília, loja autorizada, páginas de 25 e ordenação estável. Mostra total do escopo, encontrados, página real e quantidade exibida. Data inicial sem final consulta um único dia; somente data final inclui todo o histórico até esse dia. Sem datas não limita o período.
- CSV de estoque e **Exportar histórico completo** preservam o escopo completo da loja/todas as lojas. Não aplicam filtros locais, filtros de pesquisa nem a página do histórico.

## Importação e recuperação

Excel com uma aba, até 200 linhas de dados e 2 MB; colunas SKU e Quantidade, até 32 colunas no arquivo. Quantidades inteiras positivas e sem fórmulas. SKUs repetidos agregados; SKU desconhecido ou inválido bloqueia o lote. Nenhuma linha excedente é ignorada silenciosamente. Cada registro exige conferência antes de confirmar. Prévia expira após 15 minutos ou exige nova conferência quando estoque muda. A confirmação soma todo o lote e grava movimentos em uma transação; recibo permite **Verificar confirmação** sem duplicação.

Formulários preservam campos após erro. Durante envio, controles de edição/cancelamento ficam bloqueados e travas síncronas impedem duplo envio na mesma tela. Diálogos de operação, lote, catálogo, imagem e edição têm ciclo de Tab/Shift+Tab, retorno do foco e confirmação de descarte pelo Escape. Fechar/Cancelar explícitos continuam disponíveis quando o envio termina. A importação mantém seu diálogo nativo e recuperação específica por recibo.

Falha de atualização exibe erro e tentativa novamente, sem recomendar seed ou carga inicial. Os dados anteriores da mesma loja podem permanecer visíveis, com ações bloqueadas após falha. Falha incerta de movimento/criação de pedido exige conferir estoque/histórico antes de iniciar outra operação; não há idempotência geral no servidor.

## Operação técnica

Node 24.x, Next 15.5.28, React 19, Prisma 6, PostgreSQL 14+. Variáveis: `DATABASE_URL`, `DIRECT_URL`, `ADMIN_SESSION_SECRET`; `ADMIN_PASSWORD` para provisionamento excepcional. Segredos e artefatos locais permanecem ignorados. `admin:inspect` é diagnóstico; `admin:bootstrap-existing` só cria o primeiro Master quando há dados e nenhuma conta; `admin:set-password` altera a conta Master existente. Exigem conferência do destino. Seed é destrutivo, restrito a banco local descartável e flag explícita.

`npm run verify`, smoke, UI e integração isolada são as verificações previstas. A revisão não adiciona dependência, migration, variável ou escrita em dados reais. Publicação e autorização permanente: [PRODUCAO.md](PRODUCAO.md).

## Evoluções recomendadas, ainda não implementadas

- Medir planos/latência com volumes representativos antes de paginar estoque ou colaboradores; preservar totais, exportação e seleção entre páginas.
- Idempotência durável de movimentos/criação administrativa; a trava de interface não cobre aba nova ou resposta perdida.
- Integração LDAP/SSO e MFA dependem do provedor e regras corporativas; não presumir que identificação pública atual autentica a pessoa.
- Validar leitor de tela, Safari/Firefox e dispositivos reais; os testes atuais usam Chromium desktop/celular emulado.
- Revisar retenção de backups, monitoramento e WAF no provedor. Evidências históricas não substituem conferência atual.
