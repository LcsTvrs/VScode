# Escopo e guia de continuidade — Gestão Uniformes

Atualizado em 24/10/2026. Refatoração e solicitação por Setor publicadas em produção na revisão funcional `011c067`, após aprovação do Preview pelo usuário. Sete migrations aplicadas, incluindo `20261024000000_add_uniform_sector`. Estoque e registros vinculados reiniciados por autorização, com backup restaurado; lojas, contas e colaboradores preservados. Evidências em [PRODUCAO.md](./PRODUCAO.md). As seções históricas registram o estado na data indicada; confirme revisão e deployment ativo antes de operar.

## 1. Objetivo e estado atual

Aplicação web para gestão de uniformes da Leroy Merlin: lojas, contas administrativas, estoque por variação, movimentações, solicitações de colaboradores, aprovação ou recusa e exportações CSV. Interface em português brasileiro.

- Em 24/10/2026, o [PR #1](https://github.com/LcsTvrs/VScode/pull/1) foi integrado à main. Revisão `011c067` Ready no domínio principal, com 11 verificações HTTP aprovadas e variáveis de produção preservadas. Na limpeza pontual havia uma loja, três contas e dois colaboradores, todos preservados; catálogo, imagens, saldos, movimentos e pedidos antigos foram zerados. Não repetir a limpeza após o início da operação.
- Repositório público: https://github.com/LcsTvrs/VScode; ramo de publicação: main.
- Endereço estável de produção: https://estoqueuniformes.vercel.app. URLs com hash de deployment são versões imutáveis e podem ficar desatualizadas.
- Hospedagem: Vercel, projeto estoque_uniformes na equipe oktus2; push em main dispara deployment de produção. A revisão funcional 79fd6eb ficou Ready em 18/10/2026.
- Último estado do banco informado pelo usuário antes dessas alterações: uma loja (código 0012) e uma conta MASTER_ADMIN criada sobre dados preexistentes. Isso não é inventário atual; confirme pela interface antes de tomar decisões.
- Em 21/10/2026, a migration de `User.name` foi registrada formalmente e a coluna `UniformVariant.gender` foi criada em produção. As quatro migrations estão aplicadas; schema conferido sem diferenças. Backup e restauração foram validados antes da aplicação, preservando os dados existentes.
- Em 22/10/2026, `20261021000000_add_uniform_images` foi aplicada em produção. O banco local recebeu também as pendências de nome do usuário e classificação. Ambos estão com cinco migrations concluídas e schema sem diferenças, após backups novos restaurados e ensaios nas cópias. Dados das oito tabelas de negócio preservados. Há uma divergência histórica de checksum da migration multi-loja apenas no banco local; schema antigo conferido e registro preservado, conforme PRODUCAO.md.
- Em 23/10/2026, `20261023000000_password_change_deadline` foi aplicada em produção após backup restaurado e ensaio em PostgreSQL isolado. Produção ficou com seis migrations concluídas, schema compatível e dados das nove tabelas preservados. A revisão `8c7b584` ficou Ready no domínio principal; o usuário confirmou que a troca de senha funcionou na rede afetada após a correção da resposta JSON. Evidências e histórico em [PRODUCAO.md](./PRODUCAO.md).

### O que está implementado

- Preview Neon na branch Git `preview/validacao`: integração nativa existente, prefixo `DIRECT`, ação Neon obrigatória antes do deployment. `scripts/vercel-build.ts` normaliza somente as conexões de Preview para validar/compilar; `src/lib/prisma.ts` usa o mesmo destino em runtime. `PREVIEW_PRODUCTION_ENDPOINT_SHA256` impede reutilizar o endpoint de produção, inclusive na forma com pooler. Sem fallback às URLs manuais. A chave de sessão de Preview foi isolada. Produção mantém suas variáveis e o código publicado em `main`.
- Continuidade da auditoria em 23/10/2026: Next.js e eslint-config-next fixados em `15.5.28`; helper `src/lib/api-response.ts` trata HTTP 429, HTML/texto de proxy e JSON inválido. Formulários preservam dados; pedido com resultado incerto orienta consultar a loja antes de repetir, sem reenvio automático. Falha ao recarregar catálogo é tratada e catálogo inicial indisponível impede avançar.
- Auditoria de início de operação: [AUDITORIA-2026-10-22.md](./AUDITORIA-2026-10-22.md), com achados, correções, evidências de testes e pendências. Login só redireciona para a própria origem; senha nova usa mínimo 12 caracteres/máximo 72 bytes e troca condicionada à versão da conta; autenticação não executa DDL. JSON limitado a 256 KiB, gravações recusam origem externa e APIs administrativas bloqueiam operações no servidor enquanto houver troca de senha pendente.
- Edição direta do estoque exige `updatedAt` da tela e retorna 409 se outro operador/aprovação alterou o registro. Entradas e cadastros respeitam saldo máximo de 1.000.000; campos vazios ou longos são recusados sem truncar SKU. Pedidos públicos novos usam UUID completo. Nenhuma dessas correções exige migration nova.
- Seletor de loja com uma única seta funcional e nome completo, com quebra de linha em desktop/celular.
- Atribuição de imagens aos uniformes existentes pelo `MASTER_ADMIN`, com prévia, replicação opcional por SKU exato entre lojas e exibição no estoque e catálogo público. Requer a migration de imagens antes da publicação.
- Histórico com filtro por dia de criação no horário de Brasília (`America/Sao_Paulo`), contagem dos registros exibidos e opção de limpar. O filtro começa vazio e é limpo ao trocar de loja ou acessar o histórico pelo botão “Ver todas”. A exportação continua abrangendo o histórico completo da loja.
- Na visão geral, “Solicitações pendentes” exibe até quatro pedidos `PENDENTE`, em ordem decrescente de criação, independentemente do dia e do filtro do histórico. Pedidos aprovados/recusados não ocupam essas posições; as métricas continuam considerando todas as pendências.
- O filtro por data é aplicado na interface sobre os dados autorizados de `GET /api/dashboard`; não altera a API, o escopo por loja nem reduz o volume transferido. Paginação no servidor permanece uma evolução possível para históricos maiores. Não há nova migration.
- Login individual de administradores, papéis MASTER_ADMIN e STORE_ADMIN, sessão por cookie, troca obrigatória da senha temporária.
- Painel por loja com visão geral, estoque, solicitações e seleção de loja pelo administrador geral. Sem seleção, o MASTER_ADMIN vê a lista de lojas; a seleção também aparece na URL como parâmetro storeId.
- Cadastro, edição e exclusão de lojas e usuários pelo MASTER_ADMIN; reset administrativo de senha. Usuários têm login e nome de exibição separados.
- Catálogo público e solicitação em /solicitar com seleção de loja quando há mais de uma.
- Cadastro de variações de uniformes, saldo inicial, entradas, ajustes, edição de saldo e mínimo, aprovação/recusa de pedidos e exportações CSV.
- Entrada de estoque via Excel `.xlsx`, com prévia por loja, conferência de cada item, soma transacional e proteção contra repetição da mesma confirmação.

## 2. Mapa do repositório

`src/features/` agrupa autenticação, usuários, lojas, painel, estoque e solicitações. Páginas em `app` são entradas; componentes/hooks e operações de servidor ficam nas funcionalidades. Autorização centralizada mantém revalidação no banco. Consulte [ARQUITETURA.md](./ARQUITETURA.md) e [REFATORACAO.md](./REFATORACAO.md).


| Local | Responsabilidade |
| --- | --- |
| [package.json](../package.json) | Scripts e dependências. |
| [vercel.json](../vercel.json) | Framework, instalação, build com validações e saída para Vercel. |
| [scripts/check-deploy-env.ts](../scripts/check-deploy-env.ts) | Confere variáveis sem exibir valores nem conectar ao banco. |
| [prisma/schema.prisma](../prisma/schema.prisma) | Modelos, relações, enums e índices do PostgreSQL. |
| [prisma/migrations/](../prisma/migrations/) | Migrações versionadas; revisar antes de aplicar. |
| [src/app/page.tsx](../src/app/page.tsx) | Entrada do painel; composição em src/features/dashboard. |
| [src/features/inventory/components/import-dialog.tsx](../src/features/inventory/components/import-dialog.tsx) | Upload e conferência do Excel no estoque. |
| [src/features/inventory/server/import.ts](../src/features/inventory/server/import.ts) | Prévia de saldo, confirmação transacional e recibos de importação. |
| [public/modelo-entrada-estoque.xlsx](../public/modelo-entrada-estoque.xlsx) | Modelo de planilha com SKUs de exemplo para substituir. |
| [src/app/admin/](../src/app/admin/) | Login, usuários, lojas e troca de senha. |
| [src/app/solicitar/page.tsx](../src/app/solicitar/page.tsx) | Fluxo público do colaborador. |
| [src/app/api/](../src/app/api/) | Rotas HTTP e regras de negócio. |
| [src/lib/](../src/lib/) | Infraestrutura compartilhada: Prisma, ambiente, HTTP, JSON e CSV. |
| [src/middleware.ts](../src/middleware.ts) | Filtro inicial de páginas e APIs protegidas. |
| [src/app/globals.css](../src/app/globals.css) | Estilos próprios; usa Tailwind v4 via [postcss.config.mjs](../postcss.config.mjs). |
| [public/leroy-merlin.svg](../public/leroy-merlin.svg) | Logo usada no painel e nas páginas públicas. |
| [scripts/](../scripts/) | Inspeção do admin e procedimentos pontuais de senha/provisionamento. |
| [docs/PRODUCAO.md](./PRODUCAO.md) | Checklist operacional de produção. |

O arquivo [.github/copilot-instructions.md](../.github/copilot-instructions.md) contém orientações curtas para agentes, mas este documento e o código atual prevalecem se houver divergência.

## 3. Stack, ambiente e comandos

- Next.js 15 App Router, React 19, TypeScript, Node.js 24.x, fixado para alinhar execução local e Vercel.
- Prisma 6 com PostgreSQL; bcryptjs para hashes de senha; jose para JWT.
- Tailwind CSS 4, PostCSS e CSS próprio. O plugin em [postcss.config.mjs](../postcss.config.mjs) é indispensável para o estilo das páginas administrativas.
- [next.config.ts](../next.config.ts) define cabeçalhos de segurança; [src/app/layout.tsx](../src/app/layout.tsx) importa o CSS global.

Comandos a partir da raiz do repositório:

    npm ci --include=dev
    npm run db:generate
    npm run db:deploy
    npm run dev
    npm run lint
    npm test
    npm run build
    npm run verify
    npm run vercel-build
    npm run test:smoke

Use npm run db:deploy somente no banco pretendido e após verificar o estado de migração. npm run db:push é útil apenas em banco de desenvolvimento descartável. npm run db:seed apaga os dados de negócio e cria dados demonstrativos; nunca o execute em produção. `npm test` usa node:test com tsx, sem conectar ao banco; build, lint e testes com banco simulado não substituem testes funcionais e de concorrência em staging.

`npm run verify` encadeia geração/validação do Prisma, lint, testes e build. `npm run vercel-build` acrescenta `check:deploy-env`, validando URLs PostgreSQL e chave de sessão; senha de provisionamento é opcional, mas precisa ser válida se definida. O verificador local lê arquivos `.env*` na precedência de produção do Next.js e preserva variáveis do processo; na Vercel usa somente variáveis da plataforma. Não exibe valores nem comprova conectividade com banco. O `vercel.json` configura a instalação reproduzível e esse build; Root Directory e segredos continuam sendo configurações do projeto na plataforma. Migrations não fazem parte do build.

### Variáveis de ambiente — nomes, sem valores

| Variável | Uso |
| --- | --- |
| DATABASE_URL | Conexão PostgreSQL de execução, normalmente com pooler. |
| DIRECT_URL | Conexão direta usada por Prisma Migrate. |
| ADMIN_SESSION_SECRET | Assinatura JWT; no mínimo 32 bytes. |
| ADMIN_PASSWORD | Usada apenas pelo provisionamento inicial ou pelos scripts administrativos de senha, não como senha dinâmica do login. |
| ALLOW_DESTRUCTIVE_SEED | Consentimento explícito apenas para seed em banco local descartável. Produção, Vercel e conexões remotas são sempre recusadas. |

Use [.env.example](../.env.example) apenas como modelo. [.gitignore](../.gitignore) exclui .env, .env.local, .vercel e arquivos de chave. A Vercel marca os segredos de produção como não exportáveis; vercel env run -e production não os disponibilizou localmente, portanto não presuma que scripts locais alcançam o banco de produção. Nunca copie valores reais para documentação, commit ou saída de ferramenta.

## 4. Perfis, sessão e acesso

### MASTER_ADMIN

- Sem vínculo obrigatório a uma loja; pode ver a lista de todas, escolher uma no painel e operar nela.
- Administra todas as lojas e contas em /admin/lojas e /admin/usuarios.
- Pode exportar dados de uma loja passando storeId à API ou de todas sem esse parâmetro. Os dois botões CSV do painel enviam a loja exibida, evitando exportação global involuntária.

### STORE_ADMIN

- Precisa estar associado a uma loja; o storeId é retirado da sessão, não do corpo ou da URL fornecidos pelo navegador.
- Gerencia estoque e solicitações da própria loja. Não acessa o CRUD de lojas/usuários.

### Sessão e nomes

- [src/features/auth/session.ts](../src/features/auth/session.ts) assina um JWT HS256 de até 8 horas em cookie HTTP-only, Secure em produção e SameSite=Strict. Inclui ID, login, papel, loja, sinal e prazo de troca obrigatória e updatedAt do usuário.
- [src/features/auth/server/session.ts](../src/features/auth/server/session.ts) consulta o usuário a cada chamada autenticada e rejeita sessão obsoleta quando login, papel, loja, estado de senha ou updatedAt mudam. O nome de exibição vem do banco; em contas antigas sem nome, aparece o login.
- [src/middleware.ts](../src/middleware.ts) redireciona páginas sem sessão e retorna 401 nas APIs. Sessões com `mustChangePassword` são direcionadas imediatamente a `/admin/trocar-senha`, com APIs administrativas bloqueadas, permitindo autenticação/troca e logout. Cada API revalida usuário, pendência de troca, papel e escopo no servidor. Datas antigas em `passwordChangeDeadline` não concedem acesso, mesmo futuras; a coluna e o campo do JWT são mantidos por compatibilidade, sem nova migration.
- O nome da conta master antiga pode ser preenchido em /admin/usuarios → Editar. Uma edição da própria conta renova o cookie; editar outra conta invalida a sessão antiga desse usuário pelo updatedAt.
- O login compara a senha com o hash bcrypt armazenado em User; mudar ADMIN_PASSWORD na Vercel não muda automaticamente a senha de uma conta já criada.

## 5. Fluxos do produto e regras de negócio

### Provisionamento e contas

- Exibição da senha temporária na criação/reset: janela modal na página de usuários, com login, senha selecionável e botão de cópia. Falha do clipboard mantém a janela aberta, seleciona a senha e orienta cópia manual. O segredo fica apenas no estado da página enquanto a janela está aberta, sem persistência em storage ou URL; fechar remove esse estado. Reset da própria conta só redireciona após fechar. Cursor de mão aplicado globalmente aos controles de ação disponíveis; campos de texto preservam cursor de edição.

- Banco realmente vazio: POST /api/setup cria uma loja inicial e a primeira conta MASTER_ADMIN com hash de ADMIN_PASSWORD. O endpoint é público, mas recusa nova execução quando já há usuários e recusa provisionamento se há dados de negócio.
- Banco com dados e nenhum usuário: [scripts/inspect-admin-state.ts](../scripts/inspect-admin-state.ts) inspeciona; [scripts/bootstrap-admin-existing.ts](../scripts/bootstrap-admin-existing.ts) cria a conta master sem apagar dados e exige ADMIN_PASSWORD. Não repetir após existir qualquer conta.
- [scripts/set-master-password.ts](../scripts/set-master-password.ts) redefine a senha da conta admin MASTER_ADMIN existente, exigindo ADMIN_PASSWORD no ambiente. Verifique a conexão antes de executar; o script não mostra a senha.
- O MASTER_ADMIN cria novos usuários com login, nome, papel e, para STORE_ADMIN, loja. A API gera senha temporária de 10 caracteres, mostra apenas na resposta e guarda só o hash. No próximo login, o usuário deve trocá-la por uma senha de pelo menos 12 caracteres e no máximo 72 bytes antes de acessar o painel. A página de troca envia `POST /api/auth/login` com `acao: "trocar-senha"` e `novaSenha`. Criação/reset gravam `mustChangePassword: true` e `passwordChangeDeadline: null`; novo reset revoga sessões anteriores. Contas já pendentes também ficam bloqueadas imediatamente, independentemente do prazo legado. No reset da própria conta master, a janela copiável permanece até ser fechada e então direciona à troca obrigatória.
- A troca permite repetir tentativas sem consumir a senha temporária em erros de validação ou falhas antes da gravação. Se a troca foi salva, mas a resposta se perdeu, reenviar a mesma nova senha recupera a sessão sem outra alteração. Novo reset revoga a tentativa anterior. A sessão mantém validade de 8 horas; ao expirar, basta entrar novamente com a senha vigente, sem novo reset. Login, nova senha e confirmação têm botão para mostrar/ocultar o valor; respostas HTML de falha recebem orientação legível.
- A troca usa o mesmo método POST, URL, headers JSON, cookies e cache do login. O sucesso retorna `{"ok":true,"mustChangePassword":false}`, igual ao login com senha definitiva. O corpo anterior `{"ok":true}` tem SHA-256 `4062edaf750fb8074e7e83e0c9028c94e32468a8b6f1614774328ef045150f93`, exatamente a assinatura reportada no bloqueio externo; mudar somente URL/método mantinha o conteúdo bloqueado. O usuário confirmou a resolução após a alteração da resposta. O logout também deixou esse corpo genérico e retorna `{ok:true,authenticated:false}`, mantendo a expiração do cookie. As entradas antigas permanecem compatíveis.
- O CRUD impede que o administrador exclua sua própria conta ou altere seu próprio papel.

### Lojas e estoque

- Setor obrigatório no novo cadastro, com sugestões dos setores da loja; editável junto do estoque com controle de versão/transação. A alteração de setor invalida a versão anterior do saldo/prévia Excel, sem movimentação quando a quantidade não muda. Busca e exportação CSV do estoque incluem Setor. Use nomes consistentes para agrupar as peças.

- Loja tem código técnico único e nome de exibição. O cadastro gera código; a edição permite alterá-lo. Ambos exigem cidade (2 a 100 caracteres) e uma das 27 UFs brasileiras, validadas também na API. Valores legados “A definir”/“NA” não são alterados automaticamente; corrigir pela edição da loja.
- Variações são específicas da loja; SKU é único dentro de cada loja. Estoque guarda saldo e mínimo por loja e variação.
- Cadastro com saldo positivo gera StockMovement do tipo ENTRADA. Ajustes e edição de saldo geram movimentações para auditoria.
- Na API de movimentação, ENTRADA soma, SAIDA subtrai e AJUSTE define saldo absoluto; o histórico registra o delta com sinal. Quantidade de entrada deve ser inteira entre 0 e 1.000.000. Saldo negativo é recusado. A gravação compara o saldo lido para detectar operações simultâneas e retorna 409 em conflito, revertendo a transação e seu movimento.
- Aprovação de solicitação PENDENTE muda status, baixa saldo e grava SAIDA na mesma transação; se faltar saldo, tudo é revertido. Recusa apenas muda o status.
- Pedidos administrativos e públicos descontam as reservas PENDENTE ao validar disponibilidade, usando a mesma função em `src/features/inventory/server/stock-rules.ts` e transação Serializable. Ambos aceitam até 20 linhas; após agregação, o colaborador pode solicitar até 3 peças por variação e o administrador até 20. Limites e agregação estão em `src/features/requests/items.ts`. Pedido administrativo usa código com UUID; conflito de serialização ou indisponibilidade retorna 409 e exige atualização antes de tentar novamente.

### Edição administrativa de solicitações

O histórico e o resumo recente destacam o colaborador (nome e LDAP) e os itens solicitados. Cada item ocupa uma única linha no histórico: tamanho antes do nome, classificação, cor e SKU; quantidade somente no indicador à direita. O total redundante do rodapé foi removido, mantendo data e ações. Em telas estreitas, a descrição permite rolagem horizontal por toque ou teclado e a quantidade permanece visível à direita. Catálogo público, seleção e edição administrativa também apresentam tamanho antes do nome. O código deixa de ser exibido nesses painéis e no diálogo de edição; permanece na API, CSV e comprovante público. `GET /api/dashboard` retorna `requests[].items` com esses metadados. O componente `src/features/requests/components/history-card.tsx` organiza a apresentação em desktop/celular. Ajuste visual de 21/10/2026, sem nova migration.

- Em Solicitações, o lápis abre os detalhes atuais de um pedido PENDENTE. O administrador pode trocar, adicionar e remover itens, além de alterar quantidades. Deve restar pelo menos um item e todos precisam ter quantidade inteira positiva. Pode ultrapassar 3 unidades, até o teto administrativo de 20 por variação, incluindo linhas repetidas.
- `STORE_ADMIN` consulta e edita somente pedidos de sua loja. `MASTER_ADMIN` pode editar pedidos das lojas sob sua administração. A loja é derivada do pedido no servidor; `storeId` enviado no corpo não transfere pedidos nem itens.
- A edição preserva colaborador, código, observações e status. Substitui os itens em transação Serializable, validando o saldo disponível após descontar as reservas dos outros pedidos; a reserva antiga do próprio pedido é excluída dessa conta. Não baixa saldo nem cria movimento. A aprovação posterior usa os itens corrigidos.
- O GET fornece `updatedAt`, obrigatório no PUT de edição e no PATCH de aprovação/recusa. Uma versão diferente, edição simultânea, alteração de estoque ou processamento concorrente impede sobrescrita e retorna 409. A interface pede nova conferência; a aprovação/recusa também compara a versão exibida no painel. Abas abertas antes da atualização devem ser recarregadas.
- Pedidos APROVADA/RECUSADA não são editáveis. Pedidos antigos acima de 3 não são alterados automaticamente. O limite de 3 é por variação/SKU em cada solicitação; não representa cota acumulada por colaborador ou período.
- Implementação: `src/features/requests/components/edit-dialog.tsx`, `src/app/api/requests/[id]/route.ts` e `src/features/requests/items.ts`. Não há nova tabela nem migration.

### Classificação dos uniformes

- `UniformVariant.gender` é opcional no banco: `MASCULINO`, `FEMININO` ou `NULL`. O usuário definiu que itens existentes devem permanecer como “Não informado” até classificação manual.
- Novo cadastro exige Masculino ou Feminino no formulário e em `POST /api/variants`. Em **Estoque → Editar**, é possível classificar o item ou deixá-lo como “Não informado”. `PATCH /api/inventory` aceita `gender` com um dos dois valores ou `null`; campo omitido mantém o valor atual.
- Edição de classificação, saldo e mínimo ocorre na mesma transação, restrita à loja. Compara saldo, mínimo e versão antes de gravar. Atualiza `StockLevel.updatedAt` mesmo sem mudança de quantidade, invalidando prévias Excel antigas; só gera movimento quando a quantidade muda.
- A classificação aparece no estoque, catálogo público, seleção e edição de pedidos, histórico, prévia Excel e CSVs. Não filtra uniformes por colaborador. As telas consultam a classificação atual do uniforme, inclusive em solicitações antigas, sem snapshot histórico dos metadados.
- A migração aditiva precisa anteceder o deploy do código (seção 8). Implementação compartilhada em `src/features/inventory/gender.ts` e `src/features/inventory/components/gender-field.tsx`.

### Imagens dos uniformes

- Acesso exclusivo do `MASTER_ADMIN` em **Estoque → Imagem**, somente para itens existentes. O `STORE_ADMIN` visualiza fotos, mas não pode consultar a prévia de outras lojas nem gravar imagens. A API valida sessão, papel e troca de senha pendente no servidor; o cadastro de novo uniforme não aceita atribuição de imagem.
- `GET /api/variants/[id]/image` informa imagem atual, lojas com o mesmo SKU e versão da seleção. `POST` multipart recebe arquivo opcional, `replicate` e `version`. Sem arquivo, só permite replicar a imagem já existente. Replicação compara o SKU exatamente e alcança apenas itens cadastrados no momento da confirmação, substituindo as fotos anteriores após aviso e conferência das lojas. SKUs diferentes e novos cadastros futuros não são alterados.
- O upload tem limite de 2 MB e o corpo multipart é limitado também durante leitura. JPG/PNG/WebP são decodificados por `sharp`, com limite de 16 megapixels; arquivos inválidos, SVG, animações e MIME divergente são rejeitados. Orientação é corrigida, metadados removidos e foto regravada como WebP de até 1000×1000 e 512 KiB.
- `UniformImage` armazena os bytes compactados; `UniformVariant.imageId` opcional referencia a foto. Itens replicados compartilham um arquivo. Substituição remove fotos anteriores apenas quando não houver mais uniformes vinculados. A transação `Serializable` compara a versão conferida, impedindo sobrescrita silenciosa em conflito. Estoques, reservas, solicitações e movimentos não são alterados.
- `GET /api/uniform-images/[id]` é público, serve apenas WebP vinculado a uniforme e usa cache imutável; novas fotos ganham novos IDs. O dashboard e o catálogo retornam somente `imageId`, sem incluir os bytes nos JSONs. Foto ausente ou falha de carregamento preserva o ícone e o fluxo de pedido. As imagens são públicas, assim como o catálogo.
- Armazenamento usa o PostgreSQL já configurado, sem disco efêmero da Vercel e sem novas credenciais. Backups do banco incluem as fotos; acompanhar crescimento e tráfego. Para acervos maiores, considerar armazenamento de objetos. Migration aditiva `20261021000000_add_uniform_images`: tabela, FK opcional, índices e limite de tamanho no banco; aplicar antes do deploy. Itens legados permanecem com `NULL`.
- Implementação: `src/features/inventory/server/image.ts`, `src/features/inventory/components/image-dialog.tsx`, `src/features/inventory/components/uniform-photo.tsx` e as duas rotas acima. O seletor reutilizável está em `src/features/stores/components/store-selector.tsx`: texto com quebra de linha e select nativo transparente sobre toda a área, mantendo teclado e uma só seta visível.

### Importação de estoque por Excel

- Acesso em Estoque → Importar Excel, sempre na loja exibida. `STORE_ADMIN` só opera sua loja; tentativas de enviar outra loja retornam 403. `MASTER_ADMIN` precisa selecionar a loja.
- `.xlsx` com uma única aba, cabeçalhos `SKU` e `Quantidade` na primeira linha, até 200 linhas de dados, 32 colunas e 2 MB. Colunas adicionais são ignoradas. A leitura limita a expansão ZIP a 8 MB/100 entradas e rejeita XML com entidades, referências de células fora dos limites e fórmulas. Arquivos `.xls`, protegidos por senha ou inválidos são recusados.
- SKU é normalizado com espaços externos removidos e letras maiúsculas. SKUs numéricos inteiros são aceitos, mas devem ser formatados como texto no Excel quando contiverem zeros à esquerda. Quantidade deve ser um inteiro positivo; a soma por SKU e o saldo final têm teto de 1.000.000. Linhas totalmente vazias são ignoradas.
- Linhas repetidas do mesmo SKU são somadas e exibidas como um item, com indicação das linhas de origem. SKU desconhecido na loja, item sem saldo e estouro do limite bloqueiam o lote inteiro. Não cria variações nem altera estoque mínimo.
- Prévia mostra SKU, nome, categoria/tipo, tamanho, cor, quantidade atual, quantidade da planilha e saldo após a soma. Não movimenta estoque. Cada item precisa de conferência individual; todos os IDs conferidos são exigidos também na confirmação da API.
- O servidor assina um JWT de prévia com usuário, versão da conta, loja, UUID da importação, quantidades e versão de cada saldo. Usa `ADMIN_SESSION_SECRET` com audiência distinta da sessão e validade de 15 minutos. O arquivo não é persistido nem enviado a serviços externos.
- A confirmação usa somente os valores assinados e transação `Serializable`. Cada atualização compara ID, loja, variação, SKU, quantidade e `updatedAt` do estoque. Qualquer divergência retorna 409 e reverte o lote completo; o operador deve gerar nova prévia e reconferir.
- Cada item gera uma `StockMovement` ENTRADA com UUID da importação e login do operador na observação. IDs determinísticos `inventory-import:<UUID>:<variantId>` funcionam como recibo persistente contra reenvio da mesma confirmação, sem tabela/migration nova. Prévia expirada pode consultar recibo existente durante a sessão; não pode iniciar entrada.
- Reimportar o arquivo em uma nova prévia cria uma nova operação. Após erro de rede, a interface mantém a mesma confirmação para recuperar o resultado sem somar de novo. Se a janela for fechada sem confirmação, verificar o saldo antes de iniciar outra importação.

### Solicitação pública

- /solicitar dispensa login. Com mais de uma loja, o usuário escolhe a unidade; a URL /solicitar?loja=CODIGO pode fixar o contexto.
- Identificação: LDAP obrigatório com exatamente 8 dígitos de 0 a 9, armazenado como texto para preservar zeros iniciais. Nome obrigatório, apenas letras Unicode (incluindo acentos) e espaços, sem limite mínimo ou máximo de comprimento além de não vazio. Números, pontuação, símbolos, tabulações e quebras de linha são recusados. Espaços externos/repetidos e acentos decompostos são normalizados antes de salvar. Formulário e API compartilham a validação em `src/features/requests/identity.ts`; a API retorna 400 antes de consultar o banco quando a identificação é inválida.
- Catálogo em seletores dependentes: Setor → Uniforme (nome/categoria/cor) → Classificação → Tamanho. Só entram variações cujo saldo menos reservas PENDENTE seja positivo. O GET público não envia saldo, quantidade disponível, mínimo nem reservas; responde sem cache. A seleção de um nível limpa os níveis seguintes, preservando os itens já adicionados ao resumo. Fotografias aparecem após escolher uma variação.
- O POST revalida a disponibilidade em transação Serializable, cria ou atualiza Employee por loja+LDAP e registra a solicitação como PENDENTE. Conflitos não reenviam automaticamente; o catálogo é atualizado, a seleção é preservada e itens que ficaram indisponíveis precisam ser removidos para continuar.
- LDAP e nome são informados pelo próprio visitante; não há integração com diretório corporativo nem prova de identidade. Não trate esse campo como autenticação.
- O POST público aceita até 20 linhas e até 3 peças por variação após agregação. O formulário limita a escolha a 3, sem usar o saldo como limite visível; o servidor recusa quantidades acima da disponibilidade sem divulgar o saldo. A API rejeita quantidades maiores mesmo se divididas em linhas repetidas.

### Evolução planejada: cadastro de colaboradores

Consultar uma base de colaboradores pelo LDAP para preencher os dados da pessoa e determinar quais uniformes ela pode solicitar. Ainda não implementado: atualmente o nome é informado pelo visitante e o catálogo depende da loja e do estoque. O modelo Employee já guarda LDAP como texto, com unicidade por loja+LDAP. Antes dessa evolução, definir fonte e manutenção do cadastro, vínculo com loja, regras de elegibilidade de uniformes e tratamento de LDAP não encontrado. A consulta de um cadastro não comprova, por si só, a identidade de quem informa o LDAP.

As novas validações se aplicam ao autoatendimento; cadastros legados não foram convertidos e não houve migração de dados.

## 6. Modelo de dados

Modelos e relações completos em [prisma/schema.prisma](../prisma/schema.prisma):

| Modelo | Papel |
| --- | --- |
| Store | Unidade; código único, nome, cidade, UF. |
| User | Conta administrativa; login único, nome opcional para legado, hash, papel, loja opcional e troca obrigatória; passwordChangeDeadline permanece por compatibilidade, sem conceder carência. |
| Employee | Colaborador identificado por loja+LDAP ou e-mail opcionais. |
| UniformVariant | Uniforme por loja, setor obrigatório (até 80 caracteres; padrão de migração Geral), SKU, categoria, cor, tamanho e gender opcional (enum UniformGender: MASCULINO/FEMININO); SKU único por loja. Legado NULL aparece como “Não informado”. |
| StockLevel | Saldo e mínimo por loja+variação. |
| StockMovement | Histórico de entrada, saída ou ajuste por loja+variação. |
| UniformRequest | Pedido por loja+colaborador com estado PENDENTE, APROVADA ou RECUSADA. |
| RequestItem | Variação e quantidade de cada pedido. |

Relações compostas com storeId evitam misturar colaborador, variação, estoque e pedido de lojas diferentes. Preserve esses vínculos e o isolamento por loja em mudanças de schema ou API. As categorias são CAMISETA, CALCA, JAQUETA, COLETE e OUTRO.

## 7. Rotas e contratos principais

| Método e rota | Acesso | Efeito ou resposta |
| --- | --- | --- |
| GET / | Admin | Painel; MASTER_ADMIN sem storeId vê lista de lojas; com storeId vê uma loja. |
| GET /admin/login | Público | Formulário de login. |
| GET /admin/lojas | MASTER_ADMIN | CRUD de lojas. |
| GET /admin/usuarios | MASTER_ADMIN | CRUD de usuários e reset de senha. |
| GET /admin/trocar-senha | Admin com troca pendente | Troca obrigatória. |
| GET /solicitar | Público | Autoatendimento. |
| POST /api/setup | Público, somente banco vazio | Provisionamento inicial. |
| POST /api/auth/login | Público para login; sessão exigida para troca | Usado pelos dois formulários. Com `login`/`senha`, autentica e informa `mustChangePassword`; se pendente, o cliente abre a troca obrigatória. Com `acao: "trocar-senha"` e `novaSenha`, valida sessão, troca hash, limpa pendência/prazo legado e renova cookie, inclusive em recuperação de resposta perdida. O sucesso da troca retorna `{ok:true,mustChangePassword:false}`, igual ao login definitivo. |
| PATCH /api/auth/login | Sessão autenticada com troca pendente | Compatibilidade com a revisão anterior; usa a mesma lógica e resposta da troca por POST. |
| PATCH /api/auth/change-password | Sessão autenticada com troca pendente | Compatibilidade com clientes anteriores; o formulário atual usa a URL de login. |
| POST /api/auth/change-password | Admin com troca pendente | Compatibilidade com clientes anteriores; usa a mesma lógica de troca e recuperação. |
| POST /api/auth/logout | Admin | Remove cookie. |
| GET /api/dashboard | Admin | storeId para MASTER_ADMIN; sem ele retorna lista de lojas. STORE_ADMIN usa sua loja. |
| GET, POST /api/stores | MASTER_ADMIN | Lista ou cria lojas. |
| PUT, DELETE /api/stores/[id] | MASTER_ADMIN | Edita ou exclui loja; exclusão é recusada se houver vínculos. |
| GET, POST /api/users | MASTER_ADMIN | Lista ou cria contas. |
| PUT, DELETE /api/users/[id] | MASTER_ADMIN | Edita ou exclui conta, com proteção da própria conta. |
| POST /api/users/[id]/reset | MASTER_ADMIN | Gera senha temporária e exige troca. |
| POST /api/variants | Admin no escopo de loja | Cria uniforme e saldo inicial. |
| POST, PATCH /api/inventory | Admin no escopo de loja | Movimentação ou edição de saldo e mínimo. |
| POST /api/inventory/import/preview | Admin no escopo de loja | Multipart `file` + `storeId`; lê `.xlsx`, devolve itens, erros e token quando todo o lote é válido. |
| POST /api/inventory/import | Admin no escopo de loja | JSON `token` + `reviewedVariantIds`; confirma todas as entradas ou retorna recibo de lote já registrado. |
| POST /api/requests | Admin no escopo de loja | Cria solicitação administrativa. |
| GET /api/requests/[id] | Admin no escopo de loja | Detalhes atuais, itens e versão `updatedAt`. |
| PUT /api/requests/[id] | Admin no escopo de loja | Substitui `items` de pedido pendente; exige `updatedAt` lido no GET. |
| PATCH /api/requests/[id] | Admin no escopo de loja | Aprova ou recusa com `action` e `updatedAt` da versão exibida. |
| GET, POST /api/requests/public | Público | Catálogo/seleção de loja ou novo pedido público. |
| GET /api/exports/inventory | Admin | CSV de estoque; MASTER_ADMIN sem storeId exporta todas as lojas. |
| GET /api/exports/requests | Admin | CSV detalhado por item; mesma regra de loja. |

Os caminhos exatos, payloads, validações e códigos HTTP ficam nos arquivos de [src/app/api/](../src/app/api/). Não derive autorização da interface: confirme cada regra na rota.

## 8. Banco, migrações e deploy

1. [20261013000000_init](../prisma/migrations/20261013000000_init/migration.sql): schema inicial. Bancos criados antes dela podem exigir baseline, somente após conferir a estrutura real.
2. [20261014185052_add_multi_store](../prisma/migrations/20261014185052_add_multi_store/migration.sql): separa dados por loja; o backfill legado só admite no máximo uma loja e aborta em caso ambíguo.
3. [20261018230000_add_user_name](../prisma/migrations/20261018230000_add_user_name/migration.sql): coluna opcional User.name. Registrada formalmente em produção em 21/10/2026 após backup e ensaio em cópia restaurada, e no banco local em 22/10/2026. A rotina antiga de DDL em autenticação foi removida na auditoria; inicializar novos bancos pelas migrations.

4. [20261020000000_add_uniform_gender](../prisma/migrations/20261020000000_add_uniform_gender/migration.sql): cria enum `UniformGender` e coluna nullable `UniformVariant.gender`. Itens existentes permanecem `NULL` (“Não informado”) até classificação manual. A migration precisa ser aplicada antes de publicar o código dependente; não existe DDL em runtime para esse campo. Aplicada em produção em 21/10/2026, com dados preservados e schema conferido sem diferenças.

5. [20261021000000_add_uniform_images](../prisma/migrations/20261021000000_add_uniform_images/migration.sql): imagens compactadas e vínculo opcional no uniforme. Aplicada nos bancos local e de produção em 22/10/2026, após backup restaurado e ensaio.

Procedimento para mudanças futuras: estudar estado real e histórico de migrations, fazer backup restaurável, ensaiar em staging, criar/revisar SQL, aplicar migration e só então publicar código dependente de novas colunas. Não use seed nem db:push em produção. Consulte [PRODUCAO.md](./PRODUCAO.md).

## 9. Verificações e limitações

Verificado na revisão 79fd6eb: npm run build e npm run lint passaram; deployment Vercel Ready; logo estática respondeu HTTP 200; tentativa de login inválida em produção respondeu 401 esperado. Não foi feito teste autenticado completo de todos os fluxos em produção por esta sessão.

Correções locais de 19/10/2026: saída de estoque, detecção de atualização concorrente, filtro de CSV, localização de lojas e reserva de pedidos administrativos. A suíte em `tests/` cobre regras, escopo de loja e APIs com cliente Prisma simulado, incluindo respostas 409 para conflitos; não comprova concorrência real no PostgreSQL. Nenhum push, deploy ou alteração no banco de produção foi feito.

Validação da importação Excel em 19/10/2026: `npm run vercel-build` passou com Prisma, lint, 26 testes e build; `npm run test:smoke` passou com 11 verificações HTTP. `npm run test:ui` passou com 8 testes de navegador em desktop/celular, usando respostas de API simuladas; capturas foram inspecionadas. As duas rotas de importação declaram duração máxima de 30 segundos na Vercel. Como `DATABASE_URL` e `DIRECT_URL` estavam ausentes localmente, o build usou URLs fictícias somente no processo. Nenhum banco real foi acessado; configurar as conexões do ambiente de destino continua necessário. Os testes incluem leitura de `.xlsx`, conferência integral, isolamento, conflito com reversão simulada e reenvio sem duplicação, além das regras anteriores. Não substituem validação autenticada e de concorrência em staging.

Validação das solicitações em 20/10/2026: `npm run verify` passou com Prisma, lint, 35 testes e build, usando URLs fictícias de banco no processo. Passaram 14 verificações HTTP e 16 casos de navegador em desktop/celular (8 de importação e 8 de solicitações). A nova cobertura inclui limite público de 3 com duplicatas, ajuste administrativo acima de 3, substituição de itens, reservas de outros pedidos, isolamento, reversão simulada, conflito de versão e aprovação dos itens corrigidos. As capturas de desktop/celular foram inspecionadas. Sem acesso a banco real, migration, push ou deploy nesta atualização.

Node 24.x e comandos de instalação/build estão versionados. Overrides transitivos corrigem PostCSS do Next.js e deepmerge-ts do Prisma sem trocar as versões principais desses frameworks. A auditoria direta final não reporta vulnerabilidades com `--omit=dev`; a auditoria completa mantém 5 alertas altos na cadeia de lint decorrentes de `braces`, ainda sem correção publicada. Consulte versões, justificativa e limitações em [PRODUCAO.md](./PRODUCAO.md).

Validação da classificação e do histórico concluída em 21/10/2026: `npm run verify` passou (Prisma, lint, 40 testes e build); `npm run test:smoke` passou com 14 verificações HTTP e `npm run test:ui -- --max-failures=1` com 18 testes em desktop/celular. Capturas de cadastro e histórico foram inspecionadas. Cobertura inclui classificação obrigatória no cadastro, legado nulo, edição sem alterar saldo, conflito, escopo de loja, catálogo, CSV e histórico estruturado. Esses testes usaram Prisma/APIs simulados e conexões fictícias. Posteriormente, na preparação da publicação em 21/10/2026, backup/restauração e migração foram validados em PostgreSQL real. As duas migrations pendentes foram aplicadas em produção; as oito tabelas de negócio permaneceram preservadas. Veja PRODUCAO.md.

Pendências importantes:

1. Cinco migrations concluídas nos bancos local/produção; manter backup/ensaio antes de novas migrações. Correções da auditoria publicadas em `9fd32de`; recarregar abas administrativas antigas.
2. Integração PostgreSQL isolada validou autenticação/troca/reset, CRUD, permissões, pedidos/aprovação concorrente, estoque, Excel/reenvio e exportações em 22/10/2026. Permanecem testes de carga e do lote máximo de 200 linhas sob a latência real do banco (transação com timeout de 20 segundos).
3. WAF configurado: uma regra combina POST de login, pedido público e setup, com 30 envios/60 segundos por IP, por região, e resposta 429. O catálogo GET permanece acessível. Monitorar redes corporativas com IP compartilhado e ajustar conforme uso. Confirmar backup automático/monitoramento e adequar o plano Hobby ao uso empresarial. Preview ainda não possui `DATABASE_URL`: configurar uma base isolada antes de usá-lo para testes de escrita. Integração corporativa/MFA continua pendente de definição.
4. Seed endurecido na auditoria: senha configurada, troca obrigatória e execução somente em banco local descartável com flag explícita. Nunca usar em produção.

## 10. Instruções para continuidade

- Leia este documento, [README.md](../README.md), [PRODUCAO.md](./PRODUCAO.md), [schema.prisma](../prisma/schema.prisma) e as rotas envolvidas antes de alterar uma regra.
- Confirme a revisão Git, o deployment ativo e o estado do banco; relatos anteriores podem estar desatualizados.
- Mantenha login e nome separados: login autentica, nome aparece na interface. Mantenha código e nome de loja separados: código identifica a unidade, nome é mostrado ao usuário.
- Nunca imprima nem publique senhas, hashes, cookies ou URLs de banco. A ausência de segredos no Git não significa que eles estejam disponíveis em ambiente local.
- Preserve as transações que mantêm saldo e pedido consistentes. Valide alterações com lint, build e testes de comportamento pertinentes.
- Atualize este arquivo e [PRODUCAO.md](./PRODUCAO.md) sempre que mudar schema, permissões, rotas, ambiente ou processo de release.
