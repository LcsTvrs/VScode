# Operação e publicação em produção

## Publicado: todas as lojas, exclusão e edição em massa — 26/10/2026

Após a preparação para revisão, o usuário autorizou a publicação. A branch `feature/visao-global-e-edicao-em-massa` já estava no GitHub e foi integrada por avanço direto à `main`. Revisão funcional `a3e6af8d0e5acf99492baafe751bf312580def89`, deployment `dpl_6QwRfGypLqXmugdCofahjvi853kY` Ready e ativo em [produção](https://estoqueuniformes.vercel.app). **Não requer migration**; schema e oito migrations permanecem iguais. Histórico e checksums conferidos por leitura, sem pendências. Nenhum seed, db:push, limpeza, redefinição de senha ou edição de estoque foi executado na publicação. Variáveis de produção preservadas e nenhuma manutenção de escrita foi necessária.

A release acrescenta dashboard consolidado para MasterAdmin, ações por loja da linha, edição transacional de até 200 saldos selecionados e exclusão de setores/categorias livres. STORE_ADMIN permanece limitado à sua unidade. Reservas são verificadas antes de reduzir saldos também na edição e movimentação individuais. O servidor retorna 409 e desfaz todo o lote se um saldo/versão/vínculo/reserva impedir a operação.

Para revisão: abrir `/` como MasterAdmin, conferir Todas as lojas, alternar os filtros nas três áreas e verificar código/nome das unidades. Conferir edição individual de uma linha de outra loja, seleção explícita e prévia de saldo final versus adição/retirada, mínimo preservado quando vazio, bloqueio por reserva e conflito integral. Testar cancelamento da exclusão, exclusão de opção livre e bloqueio de opção vinculada; essas ações não exigem seleção de loja. Conferir CSV global e individual e o isolamento de STORE_ADMIN. Testes de navegador usam APIs sintéticas; integração usa schema novo de PostgreSQL local e não equivale à verificação autenticada de produção ou teste de carga máxima.

Validação da candidata: Prisma/lint/TypeScript/build, 94 resultados de testes, 78 cenários de navegador desktop/celular, 19 verificações HTTP e 18 resultados de integração PostgreSQL aprovados. A revisão visual incluiu estoque consolidado e prévia de lote com apresentação por registro no celular. Nenhuma migration nova foi criada nem aplicada; somente as oito existentes inicializaram o schema sintético novo. Detalhes e limites em [REFATORACAO.md](./REFATORACAO.md).

Build remoto com 94 resultados aprovados. A [CI 40311021158](https://github.com/LcsTvrs/VScode/actions/runs/40311021158) aprovou os jobs application e postgres, incluindo verificações, smoke, navegador e integração em banco descartável. Dezessete verificações HTTP passaram no domínio principal: páginas, CSS, catálogo conectado sem exposição de saldos, APIs protegidas (incluindo exclusão e edição em massa), origem externa e pedido público inválido. Não foram usados usuários reais para testes autenticados nem criados pedidos ou movimentações de teste em produção. Evidências privadas ignoradas pelo Git em `.vercel/multistore-release-state.json` e `.vercel/multistore-http-checks.json`.

Recarregar abas administrativas antigas, pois o contrato de dashboard sem loja mudou de seleção obrigatória para dados consolidados. Como não há DDL, o rollback do código pode manter o schema; a versão anterior era `e462b67`, deployment `dpl_vNqaXgx2MZWtXzvwZimTfwsWfduv`. Alterações de estoque já confirmadas não são desfeitas por rollback de código e devem ser tratadas pelo histórico.

## Catálogo compartilhado publicado — 26/10/2026

Publicação autorizada pelo usuário e concluída em 26/10/2026. Revisão funcional `dcde66f62f16fc7c6e3a8df6244de9b708a94e42`, deployment `dpl_6FwbARcMv45Gj45CBxeUyHhTq4K4` Ready e ativo em [produção](https://estoqueuniformes.vercel.app). O build remoto aprovou os 82 resultados de testes. A oitava migration, `20261024120000_shared_uniform_catalog`, foi aplicada antes da promoção do deployment; não há migrations pendentes e o schema foi conferido sem diferenças. Não houve seed, db:push, redefinição de senhas ou reinício de estoque.

Backup completo atualizado em 26/10, restaurado em banco local separado e comparado por contagens e resumos dos registros das nove tabelas existentes. A migration foi ensaiada nessa cópia antes da execução em produção. A conferência anterior/posterior à migration confirmou preservação integral de uma loja, três contas, dois colaboradores, uma variante, um saldo, uma movimentação, um pedido e um item de pedido. A imagem estava vazia e permaneceu assim. Criado o cadastro canônico com um item, seis setores iniciais e cinco categorias; nenhuma divergência de metadados ou par loja/item ausente.

Os envios às APIs foram bloqueados temporariamente pelo firewall durante a migração e promoção, por cerca de 76 segundos. A regra temporária foi removida e a regra original de 30 envios/60 segundos permaneceu ativa. Variáveis de produção preservadas. Quinze verificações HTTP passaram no domínio principal, incluindo páginas, CSS, proteção das novas APIs e catálogo conectado sem exposição de saldos. As conferências publicadas não criaram pedidos nem movimentaram estoque. Fluxos autenticados completos foram validados no PostgreSQL isolado; contas reais não foram usadas para essas verificações de produção.

Backup e evidências privados em `.vercel/backups/` e `.vercel/catalog-release-state.json`, ignorados pelo Git. `.vercelignore` também exclui ambientes, backups, scripts locais e artefatos de teste dos uploads pela CLI. A preparação abaixo começou em 24/10 e foi concluída nesta publicação; procedimentos de versões anteriores são históricos.

Mudanças: somente MASTER_ADMIN cria/edita itens e mantém setores/categorias; gestores continuam movimentando e editando saldo e mínimo da própria loja. Cadastro e imagens são comuns a todas as lojas, inclusive às futuras. Novos pares loja/SKU recebem saldo zero e mínimo 5, ajustável por loja. O cadastro não aceita saldo inicial, mínimo ou cor. A cor histórica é preservada. Setores iniciais: Geral, Logística, Atendimento, Caixas, Administrativo e Comercial, acrescidos dos setores legados. As cinco categorias iniciais permanecem e novas opções podem ser adicionadas ou renomeadas pelo MasterAdmin.

A migration converte categoria de enum para texto, cria `UniformCatalog`, `UniformSector` e `UniformCategoryOption`, vincula variantes por SKU e completa somente os pares loja/SKU ausentes. Preserva IDs existentes, quantidades, mínimos, versões de saldo, contas, colaboradores, pedidos e movimentações. Interrompe a execução inteira se o mesmo SKU tiver nome, setor, categoria, classificação, tamanho ou imagem divergentes entre lojas. Cores históricas diferentes não impedem a migração. Setores legados que colidam por caixa também exigem revisão antes da criação do índice único. Não escolher automaticamente uma loja como origem; revisar os conflitos com o responsável pelo catálogo.

Procedimento usado nesta publicação: conferir o destino, obter backup completo restaurável, restaurar e ensaiar em ambiente isolado, revisar divergências por SKU e por setor, e abrir uma janela sem gravações administrativas. A migration e a promoção ocorreram na mesma janela, com conferência do schema. Recarregar abas administrativas antigas. A versão anterior não mantém o catálogo canônico e não deve escrever no schema novo. Builds continuam sem migrations automáticas.

Validação local: geração/validação Prisma, lint, TypeScript (incluindo testes), 82 resultados de testes e build aprovados; 64 casos de navegador desktop/celular e 19 verificações HTTP aprovados no build final; integração PostgreSQL real com 14 resultados (grupo + 13 cenários). Capturas do cadastro e da gestão de opções inspecionadas, com formulário móvel sem transbordamento. A integração usou schemas novos exclusivos no cluster sintético local 127.0.0.1:55439, sem migrar o schema anterior nem acessar produção. Ensaio adicional das oito migrations com registros legados comprovou preservação de saldo 17, mínimo 3, versão, variante, pedido, item, colaborador e movimentação; loja sem o item recebeu saldo zero. Outro ensaio confirmou bloqueio de SKU divergente com rollback completo, reaplicação após correção explícita e preservação de saldos/mínimos distintos e cores históricas. A comparação do schema migrado com o Prisma não encontrou diferenças. Evidências privadas em `.local/` e capturas em `test-results/`, ignoradas pelo Git. Esses ensaios usam dados sintéticos; o backup/restauração e a conferência do destino real continuam necessários antes da publicação.

Rollback: a conversão para categoria textual e a inclusão de categorias personalizadas impedem tratar o código anterior como rollback direto. Preparar uma correção compatível com o novo schema ou restaurar o backup em destino separado e avaliar registros posteriores à publicação antes de voltar a versão. Não apagar categorias, variantes replicadas ou estoques como procedimento automático de reversão.

Atualizado em 24/10/2026. As sete migrations estão aplicadas em produção. A revisão abaixo complementa a auditoria publicada em `9fd32de`. As seções de validações anteriores descrevem o estado na data de cada teste. Leia também [ESCOPO.md](./ESCOPO.md). Confirme o deployment ativo antes de executar qualquer procedimento.


## Release publicada: Setor e início da operação — 24/10/2026

O usuário aprovou o Preview da refatoração e autorizou publicação em produção e reinício do estoque. Esta release inclui a estrutura por funcionalidades e o fluxo público Setor → Uniforme → Classificação → Tamanho. O GET público retorna somente metadados das variações disponíveis, sem saldos ou reservas; o POST continua validando disponibilidade e reservas em transação Serializable. Fotografias e resumo das peças solicitadas permanecem disponíveis.

Migration aditiva 20261024000000_add_uniform_sector: coluna Setor obrigatória em UniformVariant, padrão Geral para compatibilidade de legado e índice por loja/setor/nome. O cadastro exige Setor não vazio de até 80 caracteres; edição respeita loja e versão do estoque. Nenhuma migration ou limpeza faz parte do build.

Backup completo em formato custom preparado em artefato local ignorado; restauração conferida por contagens e hashes das nove tabelas. Migração ensaiada na cópia, schema comparado sem diferenças e limpeza ensaiada. Preservação integral de Store, User e Employee; limpeza transacional de RequestItem, UniformRequest, StockMovement, StockLevel, UniformVariant e UniformImage. O reinício é pontual, autorizado pelo usuário, e não instala dados demonstrativos, não redefine senhas e não executa seed/db:push. Não repetir a limpeza após o início da operação.

Validação da candidata: verify (Prisma/lint/76 testes/build), 56 casos de navegador desktop/celular (incluindo 99 modelos, filtros dependentes e conflito), 19 verificações HTTP e 12 resultados de integração PostgreSQL. A cópia restaurada também validou a limpeza com preservação de uma loja, três contas e dois colaboradores. A migration de Setor já foi aplicada em produção, com schema sem diferenças e dados preservados. A [CI 40094855928](https://github.com/LcsTvrs/VScode/actions/runs/40094855928) aprovou application e postgres. O [PR #1](https://github.com/LcsTvrs/VScode/pull/1) foi integrado por avanço direto da main, sem sobrescrever commits.

Publicação confirmada: revisão funcional `011c067e545a94f12f7ff4380165955fdced33bf`, deployment `dpl_5bjxzn9ottmpLf1XbH8GJv6rkGL9` Ready em [produção](https://estoqueuniformes.vercel.app). Build com 76 testes aprovados; onze checks no domínio estável passaram: login, solicitação, CSS novo, logo, redirecionamentos, APIs protegidas, catálogo conectado e vazio, identificação inválida e origem externa. Variáveis de produção preservadas. `npm audit --omit=dev`: zero vulnerabilidades reportadas. A validação de negócio/autenticação completa foi feita no PostgreSQL isolado, não com contas reais em produção.

Limpeza concluída uma única vez em transação, após backup e ensaio. Foram removidos um uniforme, uma imagem, um saldo, cinco movimentações, cinco pedidos e cinco itens. Uma loja, três contas e dois colaboradores preservados por contagens e hashes dos registros; nenhuma senha redefinida. As seis tabelas operacionais estavam vazias na conferência após a operação. Backup completo e evidências privados também foram copiados para `.vercel/backups/` e `.vercel/sector-release-state.json` da pasta original, ignorados pelo Git. A pasta original foi atualizada por fast-forward da main e teve o Prisma Client regenerado; o banco local original não foi migrado automaticamente. O banco isolado de integração recebeu a sétima migration e passou nos testes.

Preview histórico: o catálogo da candidata detectou schema antigo no banco isolado do Preview. O acesso administrativo adicional ao Neon não estava disponível nesta sessão; nenhuma migration foi acrescentada ao build nem variável de produção copiada para Preview. O alias da refatoração foi restaurado para `3247a63`, versão anteriormente aprovada, mantendo o Preview funcional como referência histórica. Para testar Setor em Preview, aplicar a sétima migration no destino isolado e publicar uma nova candidata; confirmar o endpoint antes de conectar. O endereço de produção é o ambiente atual de operação.

Rollback: a coluna aditiva pode permanecer ao reverter o código para 4722fed. Voltar o código não restaura estoque/pedidos apagados; a restauração de dados exige o backup verificado e consideração dos registros criados após o início da operação. Não restaurar automaticamente nem reutilizar um deployment Preview em produção, pois as variáveis e bancos são diferentes.

## Refatoração em worktree separado — 24/10/2026, revisão local

A branch `refatoracao/estrutura` reorganiza o código em funcionalidades, centraliza autorização operacional, separa componentes/hooks e extrai operações transacionais. A pasta original e a main permanecem na referência `4722fed`. O usuário autorizou a publicação em Preview; a branch foi enviada e o [PR #1 em rascunho](https://github.com/LcsTvrs/VScode/pull/1) foi aberto. Não houve merge nem promoção a produção.

Validação local: Prisma/lint/build e 75 testes; 19 verificações HTTP; 52 casos de navegador desktop/celular; integração em PostgreSQL isolado com 11 resultados aprovados. A integração confirma concorrência, rollback, troca/revogação, escopo, Excel/reenvio, imagens e CSV com fixtures sintéticas. CI aprovada no GitHub para `b20b886`: [execução 40092664273](https://github.com/LcsTvrs/VScode/actions/runs/40092664273), com os jobs application e postgres aprovados. Preview Ready em [endereço da branch](https://estoqueuniformes-git-refatoracao-estrutura-oktus2.vercel.app); onze verificações HTTP aprovadas no deployment. Capturas comparadas e artefatos em `.local/`, ignorados.

Não há migration nova nem alteração de dados reais. As seis migrations existentes foram usadas somente para inicializar `uniformes_refactor_test` em um cluster novo restrito a 127.0.0.1:55439. Documentação de [arquitetura](./ARQUITETURA.md) e [execução/revisão](./REFATORACAO.md). A integração Neon foi conferida para Preview e o build aprovou a proteção contra reutilização do endpoint de produção. Proteção de acesso Vercel mantida; pode exigir conta autorizada antes do login da aplicação. Revisão, deployment e variáveis de produção foram conferidos sem alteração. Merge na main e produção dependem de aprovação após revisão.

## Troca obrigatória no próximo login — 24/10/2026, preparação local

Removida a carência de 48 horas. Criação e reset passam a exigir a troca da senha temporária antes do acesso ao painel. O login direciona a `/admin/trocar-senha` quando recebe `mustChangePassword: true`; middleware bloqueia páginas e APIs administrativas imediatamente, e cada handler mantém a validação no banco. Acesso direto às URLs não libera o painel. Isso inclui contas/sessões antigas com prazo futuro: basta estarem com troca pendente. Autenticação/troca e logout continuam disponíveis. Sem troca pendente, as contas mantêm o fluxo normal.

Preservada a correção confirmada do bloqueio por assinatura: login e troca usam `POST /api/auth/login`, e o sucesso da troca permanece `{"ok":true,"mustChangePassword":false}`, igual ao login definitivo. Não foi retomado o corpo genérico `{"ok":true}`. Validações de senha, revogação por versão e recuperação após perda da resposta foram mantidas. A confirmação na rede corporativa desta nova versão depende da publicação; os testes locais verificam o contrato e a assinatura da resposta.

A coluna `User.passwordChangeDeadline` e o campo do JWT permanecem por compatibilidade, mas não concedem acesso nem carência. Criação/reset gravam prazo nulo; a troca continua limpando o valor legado. Nenhuma migration ou correção em massa dos dados é necessária. A janela copiável da senha e os cursores foram preservados. No reset próprio, a janela permite copiar antes de direcionar à troca obrigatória. O aviso e o formulário opcional de troca no painel foram removidos.

Validação local aprovada: `npm run verify` com Prisma, lint, 72 testes e build; `npm run test:smoke` com 19 verificações HTTP; suíte completa `npm run test:ui -- --max-failures=1` com 48 testes desktop/celular. A cobertura verifica ambos os perfis, bloqueio imediato com prazo legado futuro, recusa direta nos handlers sem depender do middleware, troca/logout permitidos, criação/reset sem carência, reset próprio, confirmação de senha, nova tentativa após HTML e acesso liberado após salvar. O teste de assinatura confirma que a resposta não repete o corpo genérico bloqueado e é idêntica ao login definitivo. Prisma, APIs, sessão de layout e clipboard são simulados nos testes pertinentes, sem banco real; não comprovam a liberação no filtro corporativo. Sem alteração de banco real, push ou deploy. As seções de 23/10 abaixo registram o comportamento anterior.

## Continuidade da verificação — 23/10/2026

### Senha temporária copiável e cursor — preparação local

Criação e reset de usuários substituem o `window.alert` por uma janela modal com login, senha selecionável e botão **Copiar senha**. Se o clipboard falhar ou estiver indisponível, a senha é selecionada e a interface orienta cópia manual. A janela permanece aberta até fechamento explícito ou Escape; no reset da própria conta master, o redirecionamento aguarda esse fechamento. A senha fica somente no estado temporário da página, removido ao fechar, sem storage ou URL. Mantidos geração/hash no servidor, permissões e prazo de 48 horas. Controles clicáveis disponíveis passam a usar cursor de mão globalmente; campos de texto mantêm cursor de edição.

Validação local: `npm run verify` aprovado com Prisma, lint, 72 testes e build; 19 verificações HTTP e suíte completa de 46 testes de navegador em desktop/celular aprovadas. Cobertura nova inclui criação, reset, seleção da senha, cópia, fallback quando clipboard falha, fechamento/Escape, redirecionamento após reset próprio e cursores. O servidor de navegador carrega uma sessão sintética apenas para o layout administrativo; as APIs e o clipboard são simulados, e o banco real permanece inacessível. As capturas de desktop/celular ficam nos artefatos ignorados de `test-results/`. Não substitui confirmação no navegador corporativo após publicação. Sem nova migration, alteração de banco, push ou deploy nesta preparação.

### Assinatura do bloqueio identificada e resposta alinhada ao login

Publicada a revisão `8c7b584` em produção, com deployment Ready e domínio `estoqueuniformes.vercel.app` associado ao commit. As páginas públicas e as respostas JSON/proteções de sessão e origem foram verificadas após a publicação. O usuário confirmou nesta conversa que a troca funcionou na rede que apresentava o bloqueio, concluindo a confirmação funcional que estava pendente.

O hash SHA-256 informado pelo bloqueio externo, `4062edaf750fb8074e7e83e0c9028c94e32468a8b6f1614774328ef045150f93`, corresponde exatamente aos bytes UTF-8 de `{"ok":true}`, corpo retornado no sucesso da troca. O login bem-sucedido retorna também `mustChangePassword`, com assinatura diferente. Isso vincula o bloqueio reportado ao conteúdo da resposta e explica a persistência após mudar somente URL/método; o produto responsável pelo filtro não foi identificado.

O cliente passa a usar `POST /api/auth/login` para os dois fluxos, com os mesmos headers JSON, cookies e cache. O sucesso da troca retorna `{"ok":true,"mustChangePassword":false}`, idêntico ao login de uma conta com senha definitiva. A seleção da operação continua no campo `acao: "trocar-senha"`, e a troca mantém todas as verificações de sessão/usuário/versão, prazo de 48 horas e recuperação. Nenhuma senha é enviada na URL. O logout também usava o corpo genérico; agora informa `{ok:true,authenticated:false}` e continua expirando o cookie. As entradas PATCH anteriores ficam compatíveis e recebem a resposta corrigida. Não há nova migration nem mudança na configuração do filtro.

Validação: `npm run vercel-build` aprovado com 72 testes, Prisma, lint e build; 19 verificações HTTP e 10 testes de navegador aprovados. A regressão compara a assinatura da resposta e confirma corpo idêntico ao login definitivo. A integração com PostgreSQL real na cópia isolada confirmou POST, persistência da senha, recuperação com a sessão anterior e o mesmo corpo JSON na troca/recuperação/login. A confirmação na rede afetada foi concluída pelo usuário após a publicação.

### Troca PATCH na URL de login — bloqueio externo reportado

O usuário apresentou uma resposta no navegador informando bloqueio de transferência de `change-password` por assinatura em uma lista externa. Esse texto não corresponde às respostas JSON da aplicação; o componente que o gera e o critério exato (URL ou conteúdo) não foram identificados pela captura. O login funciona na mesma rede, segundo o relato.

O formulário agora envia `PATCH /api/auth/login` com `acao: "trocar-senha"` e `novaSenha`, usando a mesma URL do login habitual, sem chamar `/api/auth/change-password`. O handler continua exigindo sessão assinada, identidade, papel/loja e versão do usuário; preserva o prazo de 48 horas e a recuperação de resposta perdida. POST de login e rotas antigas continuam compatíveis. Não há migration nem alteração do firewall nesta revisão. A eficácia no navegador/rede afetados precisa ser confirmada pelo usuário após atualizar a página; um bloqueio por assinatura de conteúdo pode exigir revisão da classificação pela equipe responsável pelo filtro.

Validação: comando oficial `npm run vercel-build` aprovado com 71 testes, lint, Prisma e build; 19 verificações HTTP e 10 testes de navegador em desktop/celular aprovados. O navegador confirma que nenhuma chamada usa a URL anterior. Integração na cópia PostgreSQL isolada validou a troca pela nova entrada, tanto durante a janela quanto após o vencimento, incluindo recuperação e reset. Nenhuma conta real foi usada nos testes autenticados.

### Migration do prazo de senha aplicada — 23/10/2026

Publicação autorizada pelo usuário. Backup atualizado de produção gerado, restaurado em uma base PostgreSQL 18 local isolada e migration ensaiada. O ensaio preservou os dados das nove tabelas da aplicação e terminou sem diferença entre schema e banco. Integração com contas sintéticas nessa cópia validou login temporário, acesso antes do prazo, bloqueio após vencer, troca PATCH, recuperação após resposta perdida, revogação da sessão e reset com nova janela.

Aplicada em produção `20261023000000_password_change_deadline`: seis migrations concluídas, nenhuma pendente, coluna presente, schema compatível e dados das nove tabelas preservados. No momento da aplicação, não havia contas com troca pendente. Backup e evidências ficaram em `.vercel/`, ignorados pelo Git. A publicação do código segue por `main`; conferir o deployment Ready e o domínio principal após o push.

### Senha temporária com acesso ao painel por 48 horas — preparação local

Esta versão substitui o fluxo imediato descrito abaixo: a senha temporária permite o uso do painel por até 48 horas após criação/reset. Um aviso informa a data/hora limite em Brasília e abre o formulário "Alterar minha senha". A nova operação de troca usa exclusivamente `PATCH /api/auth/change-password`, com corpo JSON e cookie; não faz GET de verificação nem POST de troca. O login continua usando seu POST habitual e o painel sua consulta GET já existente. As entradas antigas de troca permanecem disponíveis para clientes anteriores.

O prazo fica em `User.passwordChangeDeadline`, também incluído no JWT. Login e edição de cadastro não estendem o prazo. A validação no banco protege as APIs mesmo se o prazo do cookie estiver desatualizado. Após vencer, painel/operações ficam bloqueados até a troca; o usuário ainda pode entrar com a senha temporária e alterá-la, sem outro reset. A validade da sessão continua sendo 8 horas, independente do prazo de 48 horas. A troca bem-sucedida limpa o prazo e renova a sessão.

**Antes de publicar, aplicar `20261023000000_password_change_deadline` no banco do ambiente de destino**, conforme o procedimento de migrations deste documento. A migration adiciona uma coluna nullable e concede 48 horas a contas já pendentes, contadas de sua aplicação, sem modificar hashes, estoques ou solicitações. Contas com senha definitiva ficam sem prazo. Não foi aplicada no banco remoto nesta preparação. O código novo consulta a coluna, portanto precisa da migration antes de entrar em produção. Sessões pendentes antigas podem exigir novo login para receber o prazo no cookie.

Validação local: Prisma, lint, 71 testes automatizados e build aprovados; 19 verificações HTTP e 10 testes de navegador em desktop/celular aprovados. Cobertura inclui limite exato de 48 horas, login sem prorrogação, edição sem reiniciar prazo, reset com nova janela, bloqueio no servidor, PATCH permitido após vencer, proteção de origem e nova tentativa após erro HTML preservando os campos. APIs usam banco simulado ou inacessível; a migration não foi aplicada em PostgreSQL nesta etapa. Não houve push/deploy.

### Troca de senha pelo endpoint de login — preparação local

Login e troca de senha passaram a usar o mesmo envio de JSON e cookies para `POST /api/auth/login`. A troca envia `acao: "trocar-senha"` e `novaSenha`; o servidor exige a sessão assinada e valida usuário, escopo e versão antes de alterar a senha. A rota anterior continua disponível para clientes já abertos, usando a mesma implementação. A recuperação de resposta perdida e as tentativas após falha continuam disponíveis.

Esta mudança atende ao relato de que a URL de troca não chega à aplicação, mas a causa do bloqueio não foi confirmada por logs remotos. Não há rewrites ou redirects no `vercel.json`. A nova chamada fica sujeita às mesmas regras de firewall do login, incluindo eventual resposta 429 com orientação para aguardar e tentar novamente. Não exige migration nem novas variáveis. Após publicar, conferir o commit Ready na Vercel e testar o fluxo de reset/troca pelo domínio de produção.

Validação local: `npm run verify` aprovado com Prisma, lint, 67 testes e build; 19 verificações HTTP e 4 testes de navegador de login/visibilidade da senha em desktop e celular aprovados. Os testes usam banco simulado ou inacessível. Incluem envio compartilhado, troca sem sessão recusada, origem externa bloqueada, conflito de reset e recuperação da troca pela URL de login. Esta preparação não realizou push nem deploy.

### Preview Neon — 23/10/2026

A inspeção da integração Vercel confirmou dois vínculos existentes: produção com prefixo `DATABASE` e Preview com prefixo `DIRECT`. O vínculo de Preview já exige a ação Neon antes de compilar e cria uma branch por deployment. A ausência de `DATABASE_URL` estática no painel não significava ausência da integração: as conexões dinâmicas usam `DIRECT_DATABASE_URL` e `DIRECT_DATABASE_URL_UNPOOLED`.

A branch Git `preview/validacao` acrescenta `scripts/vercel-build.ts`, que normaliza as URLs apenas no processo de build de Preview, e usa a mesma seleção de destino no Prisma em runtime. Não há fallback à conexão manual de produção. A trava `PREVIEW_PRODUCTION_ENDPOINT_SHA256`, configurada somente em Preview, compara o endpoint normalizado, com ou sem pooler, e interrompe o build/runtime se corresponder a produção. Também rejeita conexões ausentes ou destinos divergentes. Não foram adicionadas migrations ao build.

Foi gerada uma chave de sessão exclusiva em Preview e removida a variável manual `DIRECT_URL` desse ambiente; o wrapper deriva a conexão direta da branch criada pelo Neon. Metadados e valores cifrados das variáveis de produção foram comparados antes/depois e permaneceram iguais. Nenhum dado de produção foi alterado. A cópia Neon começa com os dados/schema do ramo de origem e permanece isolada; o Preview continua protegido pela autenticação da Vercel.

Validação local: `npm run vercel-build` passou com Prisma, lint, 63 testes e build. Três testes adicionais cobrem conexões de Preview, rejeição de produção/URLs inválidas e preservação do comportamento de produção/desenvolvimento. O endereço e o estado efetivo do deployment devem ser conferidos na Vercel antes do uso. [Funcionamento da integração nativa Neon](https://neon.com/docs/guides/vercel-managed-integration).

Para testes, publique commits na branch `preview/validacao`. Não promova o Preview para produção por engano. Para migrations futuras, confira a conexão isolada e siga backup/ensaio; nunca execute `db:seed` no banco remoto. Não use `vercel env pull` de Preview como comprovação das URLs de uma branch: os valores dinâmicos são injetados no deployment, conforme a documentação do Neon. Backups automáticos/retenção ainda precisam ser conferidos na administração do Neon.

- Produção `9fd32de` revalidada antes da atualização: Ready, domínio principal correto, rotas e proteção de origem aprovadas, banco sem inconsistências nas consultas de integridade, cinco migrations concluídas. WAF continua ativo; consulta dos logs 5xx da última hora sem registros. A CLI renovou a sessão Vercel automaticamente com `whoami`; não foi necessário novo login pelo navegador. Scripts REST devem renovar a sessão pela CLI antes de concluir que o usuário perdeu acesso.
- A consulta npm de hoje passou a reportar dois avisos de Next.js que incluem `15.5.27`: [Image Optimization](https://github.com/advisories/GHSA-2464-fhr4-w9xw) e [Server Actions](https://github.com/advisories/GHSA-p3m5-59mp-jv5r). O projeto já tinha `sharp` 0.35.5 e não utiliza Server Actions, mitigando as condições descritas; mesmo assim, Next.js e eslint-config-next foram atualizados para a versão corrigida `15.5.28`, com lockfile atualizado. Audit de produção após atualização: zero alertas. Permanecem cinco alertas na cadeia de lint de `braces`, sem versão corrigida publicada.
- Login e pedido público agora reconhecem HTTP 429 antes de tentar ler JSON e orientam aguardar um minuto. Respostas HTML/texto do proxy deixam de exibir erro de parsing. Dados/seleção são preservados. Falha de envio com resultado incerto orienta consultar a loja antes de repetir; não há repetição automática. Falha de catálogo impede continuar sem disponibilidade e a atualização após conflito trata falhas de rede.
- Nenhuma alteração de schema, estoque, usuários ou senhas. Testes de escrita continuam restritos a dados sintéticos/ambientes isolados. A configuração de firewall de 22/10 foi preservada.
- Validação da revisão: `npm run verify` aprovado (Prisma, lint, 60 testes e build), 34 testes de navegador em desktop/celular aprovados e 17 verificações HTTP locais aprovadas. Os seis novos casos de navegador cobrem erros externos e preservação dos formulários. O build emite aviso do caminho de compressão JWE de `jose` no Edge; a aplicação usa JWT assinado, e os testes de sessão/middleware passaram. Não foi adicionada dependência nova nem feita mudança de versão principal.
- A conta Vercel continua Hobby. Mudança para plano compatível com uso empresarial depende de contratação pelo responsável; nenhum plano pago foi ativado.
- Preview ainda não tem `DATABASE_URL`. Para concluir: conectar a conta Neon, identificar a base e a política real de restauração, preparar base/branch isolada preferencialmente apenas com schema e dados sintéticos, e cadastrar conexões como segredos **somente em Preview**. Usar chave de sessão exclusiva nesse ambiente. Aplicar migrations no destino isolado e validar antes de usar. A conexão direta PostgreSQL de produção não concede acesso administrativo à política de backups do Neon. Não copiar credenciais de produção para Preview.
- Até a conexão Neon ser confirmada, retenção automática e configuração de Preview permanecem pendentes. Backup manual restaurável já foi validado em 22/10; isso não comprova backup automático. Não apagar os backups locais existentes.


## Validação após publicação — 22/10/2026, 16h25 (Brasília)

- Usuário publicou `9fd32de9a36150d460b203e9484f2dabac957497`; `main` remoto e produção conferidos. Deployment `dpl_FbgV3mrmV2F4pP8cAjdJzukfG9zk` Ready, associado a https://estoqueuniformes.vercel.app. Logs do build confirmaram validação de ambiente, lint, compilação e 60 testes aprovados, zero falhas.
- Páginas públicas e catálogo responderam 200; APIs administrativas sem sessão, 401. Origem externa/nula, 403; entrada inválida do pedido, 400; origem válida chega à validação do login. Cinco migrations concluídas e nenhuma inconsistência nas consultas de integridade do relatório. Consulta de logs 5xx da última hora não retornou registros; não equivale a monitoramento permanente.
- Autorização Vercel restabelecida. Variáveis obrigatórias de produção presentes e sensíveis. Node 24.x e integração GitHub/main corretos. Preview não possui `DATABASE_URL`; usar banco isolado ao configurar, sem copiar a conexão de produção.
- Firewall inicialmente sem configuração personalizada. Regra **Limite de envios publicos** publicada: POST em `/api/auth/login`, `/api/requests/public` e `/api/setup` compartilham limite de 30 requisições por 60 segundos por IP, em janela fixa. Contadores são por região. Ao exceder, responde 429; catálogo e operações administrativas ficam fora dessa regra. Teste com credenciais vazias recebeu 30 respostas 401 e depois 429; GET do catálogo continuou 200. Nenhum registro foi criado.
- Acompanhar o limite em redes corporativas com IP compartilhado. Para alterar/desativar: Firewall → Configure → regra → Review Changes → Publish. Há somente uma regra de rate limit disponível no Hobby. [Documentação de rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting).
- **Plano:** equipe `oktus2` está em Hobby. A Vercel limita esse plano a uso pessoal não comercial; adequar a contratação ao uso empresarial antes da operação regular. Nenhuma contratação ou alteração de cobrança foi feita. [Condições do Hobby](https://vercel.com/docs/plans/hobby).
- Permanecem: confirmação de backup automático/retenção, identificação corporativa do colaborador, tratamento de reenvios comuns e paginação. Não houve teste autenticado completo com dados reais nesta validação; os ensaios de escrita foram feitos anteriormente em banco isolado. Recarregar abas administrativas após o deploy.

Evidências locais ignoradas pelo Git: `.vercel/release-date-result.json`, `.vercel/build-validation-summary.json`, `.vercel/launch-deployment-validation.json`, `.vercel/firewall-live-validation.json` e `.vercel/launch-audit-readonly-result.json`. Esta conferência atualizou documentação local e o firewall; não criou novo deploy nem alterou dados de negócio.

## Auditoria de início de operação — 22/10/2026

Relatório completo: [AUDITORIA-2026-10-22.md](./AUDITORIA-2026-10-22.md). Correções em autenticação, origem das gravações, limite de JSON, seed e integridade de estoque, agora publicadas. Sem nova migration. **Recarregar as abas**: a edição de estoque exige a versão exibida no formulário.

Validação: `npm run verify` (60 testes, lint, Prisma e build), 28 testes de navegador e 17 verificações HTTP aprovados. Integração com PostgreSQL real em base isolada cobriu login/troca/reset, permissões por loja, cadastro, solicitação/edição/aprovação concorrente, estoque, Excel/reenvio e exportação. Dependências de produção sem alertas no audit; cinco alertas permanecem na cadeia de lint.

Na leitura inicial, a revisão remota `main` era `5357a66` e a API da Vercel retornava 403. Após reautorização e publicação pelo usuário, a conferência foi concluída conforme a seção anterior. Nenhum dado de negócio de produção foi alterado nesta revisão.

Limitação de envios públicos configurada e verificada. Confirmar backups automáticos/retenção e monitoramento. LDAP permanece autodeclarado; conferir identidade antes de aprovar.

## Estado conhecido

- O projeto `estoque_uniformes` está na equipe `oktus2` da Vercel; o ramo `main` do repositório [LcsTvrs/VScode](https://github.com/LcsTvrs/VScode) publica em https://estoqueuniformes.vercel.app.
- A revisão funcional `79fd6eb` ficou Ready em 18/10/2026. Alterações posteriores no Git precisam de nova confirmação do deployment ativo.
- O usuário informou que a base já possuía dados de negócio, uma loja de código `0012` e uma conta `MASTER_ADMIN`. Esse retrato pode mudar; consulte a aplicação e o banco.
- Login individual, troca obrigatória de senha temporária, isolamento de `STORE_ADMIN`, seletor de loja do `MASTER_ADMIN` e CRUD de usuários e lojas estão implementados. Há testes automatizados locais de regras e APIs com banco simulado; não há validação corporativa do LDAP.
- Em 21/10/2026, `20261018230000_add_user_name` foi registrada formalmente e `20261020000000_add_uniform_gender` foi aplicada em produção. As quatro migrations estão aplicadas, e a comparação Prisma não encontrou diferença entre banco e schema versionado.

## Imagens e seletor de lojas — preparação local de 21/10/2026

- Seletor corrigido para mostrar uma seta funcional e o nome inteiro. Master Admin pode atribuir fotos a uniformes existentes em **Estoque → Imagem** e, opcionalmente, substituir a foto do mesmo SKU nas demais lojas após conferir a lista. Estoque e catálogo público exibem as fotos; gestores de loja não podem alterá-las.
- Nova dependência direta `sharp` 0.35.5 para decodificar e compactar JPG/PNG/WebP. Upload de até 2 MB, 16 megapixels, sem animação; armazenamento WebP até 1000×1000 e 512 KiB. A foto fica no PostgreSQL e é compartilhada na replicação; não há novas variáveis ou serviço de armazenamento. Os backups passarão a incluir as imagens, aumentando conforme o acervo.
- **Aplicar `20261021000000_add_uniform_images` antes de publicar:** cria `UniformImage`, vínculo nullable `UniformVariant.imageId`, índices e limite de bytes por imagem. Itens existentes ficam sem foto. As consultas do código novo exigem essa coluna. O build não aplica migrations.
- Antes da produção, conferir banco/histórico, gerar backup restaurável atualizado e ensaiar a migração sobre uma cópia desse backup. Depois aplicar somente a migration no banco de destino, publicar o código e conferir upload, exibição pública e bloqueio para `STORE_ADMIN`. Não usar seed nem importar o banco local.
- Ensaio local já executado em uma base PostgreSQL 18 separada, com três lojas/itens sintéticos: migração preservou os dados legados e saldos; comparação Prisma sem diferenças. Upload, replicação compartilhada, limpeza de fotos sem uso, leitura pública e duas gravações simultâneas foram exercitados com as APIs reais; uma gravação venceu e a outra recebeu 409. Saldos e movimentos foram preservados.
- `npm run verify` aprovado: Prisma, lint, 50 testes e build. `npm run test:ui -- --max-failures=1`: 28 testes em desktop/celular aprovados, incluindo seletor com nome inteiro/seta clicável, upload com prévia, cancelamento sem gravação, confirmação de replicação, ausência da ação para gestor de loja, foto no catálogo e fallback em erro. Capturas inspecionadas. Testes de navegador usam APIs simuladas; o ensaio PostgreSQL descrito acima foi separado.
- A implementação acima foi validada sem acessar produção em 21/10/2026. A migração foi aplicada em 22/10/2026 conforme o registro abaixo. A leitura pública durante a auditoria posterior já encontrou o campo de imagem no catálogo de produção.

## Migrações aplicadas — 22/10/2026

- Produção Neon: aplicada `20261021000000_add_uniform_images`. As quatro anteriores já estavam concluídas e com checksums conferidos. As cinco migrations agora constam aplicadas, sem pendências; schema Prisma sem diferenças. O uniforme existente foi preservado e permanece sem imagem.
- Banco local: aplicadas `20261018230000_add_user_name`, `20261020000000_add_uniform_gender` e `20261021000000_add_uniform_images`. As cinco migrations constam concluídas, sem pendências; schema Prisma sem diferenças.
- Backups completos novos dos dois bancos foram salvos em `.vercel/backups/`, ignorados pelo Git, com SHA-256 no registro operacional `.vercel/image-migration-release-state.json`. Cada backup foi restaurado em uma nova base local isolada; as migrations foram ensaiadas nessas cópias antes da aplicação nos destinos.
- Comparação de contagens e hashes das oito tabelas de negócio, desconsiderando somente as colunas novas, confirmou preservação dos dados antes/depois em ambos os ambientes. A tabela de imagens está vazia e a restrição de tamanho foi conferida. Nenhum seed, reset, `db:push` ou transferência de dados locais para produção foi executado.
- Particularidade local: o checksum registrado de `20261014185052_add_multi_store` difere do arquivo atual. Antes de prosseguir, o schema foi comparado ao modelo histórico do commit `246e98f`, sem diferenças. O registro antigo foi preservado; somente migrations aditivas pendentes foram executadas. Essa divergência continua sendo histórica e não deve motivar reset automático com `migrate dev`.
- Não houve push ou deploy nesta operação. O banco está preparado para publicar a funcionalidade de imagens; depois do deploy, conferir a interface e os acessos por perfil.

## Filtro de solicitações e visão geral — 21/10/2026

O histórico permite escolher o dia de criação no horário de Brasília, limpar a seleção e visualizar a contagem filtrada. A visão geral mostra até quatro solicitações pendentes, incluindo dias anteriores, sem aplicar esse filtro. Datas do histórico e do resumo usam o mesmo fuso, mesmo que o navegador esteja em outro horário. A exportação, identificada como “Exportar histórico completo”, continua incluindo todos os pedidos da loja.

Não exige migration, novas variáveis ou alteração dos dados existentes. A filtragem acontece no navegador; o dashboard continua carregando o histórico autorizado da loja. Publicação pelo ramo `main`, com confirmação do commit correspondente como Ready na Vercel e do domínio de produção após o push.

Validação: `npm run verify` aprovado (Prisma, lint, 41 testes e build). `npm run test:ui -- tests/browser/request-edit.spec.ts tests/browser/request-filters.spec.ts --max-failures=1`: 14 testes aprovados em desktop/celular, com APIs simuladas e banco real inacessível. Cobertura inclui virada de dia em Brasília mesmo com navegador em UTC, dia sem pedidos, limpeza, pendências antigas após pedidos já processados e independência entre filtro e visão geral; edição/aprovação e layout anterior continuam aprovados. Nenhum dado de produção foi acessado ou alterado.

## Migração de produção — 21/10/2026

- Código da funcionalidade preparado no commit `39add33`; a publicação em `main` deve ocorrer após esta migração.
- Backup completo em formato custom do PostgreSQL salvo localmente em `.vercel/backups/`, ignorado pelo Git. Restauração validada em uma base local isolada, sem sobrescrever o banco local de trabalho.
- As duas migrations pendentes foram ensaiadas nessa cópia. Leitura real com Prisma do catálogo e do histórico aprovada; alterações Masculino/Feminino verificadas em transação revertida na cópia.
- Migração aplicada depois em produção. Comparação das oito tabelas de negócio confirmou preservação dos dados; o uniforme existente permaneceu `NULL` (“Não informado”). A comparação de schema terminou com `No difference detected`.
- A conexão de produção está em `.env.production.local`, ignorado pelo Git. Backup e credenciais não são enviados ao GitHub. Nenhum seed, `db:push`, redefinição de senha ou importação do banco local para produção foi executado.

## Configuração de deploy versionada

Ajuste visual de 21/10/2026, posterior ao deploy `ebb9a58`: tamanho antes do nome no catálogo e nas solicitações; histórico com cada item em uma linha e quantidade somente à direita, sem total redundante no rodapé. Em telas estreitas, a descrição permite rolagem horizontal e mantém a quantidade visível. Não exige migration, novas variáveis ou alteração de dados. A publicação segue o fluxo de main para a Vercel, com conferência do deployment e do domínio público.

Validação desse ajuste: `npm run verify` aprovado (Prisma, lint, 40 testes e build) e 10 testes de solicitações no Chromium em desktop/celular aprovados com `npm run test:ui -- tests/browser/request-edit.spec.ts --max-failures=1`. Capturas do catálogo e histórico foram inspecionadas. Testes confirmam tamanho antes do nome, detalhes na mesma linha, quantidade dentro da tela à direita e ausência de “Total:” no rodapé. Conexões de banco fictícias e APIs simuladas; nenhum acesso ao banco de produção. O lint passa a ignorar `.vercel/`, que contém arquivos operacionais locais gerados.

O [vercel.json](../vercel.json) define os comandos do projeto. A versão principal do Node é fixada em `24.x` no `package.json`, conforme o [suporte da Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions). Os comandos seguem a [configuração oficial por arquivo](https://vercel.com/docs/project-configuration/vercel-json).

| Configuração | Valor |
| --- | --- |
| Root Directory | Raiz do repositório (`.`); conferir no painel da Vercel. |
| Framework | Next.js (`nextjs`). |
| Node.js | 24.x, também registrado em `.nvmrc` para desenvolvimento. |
| Install Command | `npm ci --include=dev`, usando o lockfile sem atualizar versões. |
| Build Command | `npm run vercel-build`. |
| Output Directory | `.next`. |

O build verifica configuração de ambiente, gera o Prisma Client, valida o schema, executa lint e testes e compila o Next.js. Qualquer falha interrompe o build. Não aplica migrations, não executa seed e não conecta ao banco para validar credenciais. `DATABASE_URL`, `DIRECT_URL` e `ADMIN_SESSION_SECRET` precisam estar presentes no ambiente de destino; `ADMIN_PASSWORD` só é necessária para provisionamento/recuperação e, se definida, precisa ter pelo menos 12 caracteres e no máximo 72 bytes. A chave de sessão exige pelo menos 32 bytes. URLs localhost são recusadas quando `VERCEL=1`.

Antes de publicar:

1. Execute `npm ci --include=dev` e `npm run vercel-build` com Node 24.x.
2. Inclua no commit os arquivos novos de `src/lib/`, `tests/`, `scripts/`, `.nvmrc` e `vercel.json`, além de todas as alterações relacionadas. Confira `git status` e `git diff --cached --check`. Nunca inclua arquivos `.env*` com valores reais.
3. Confira Root Directory, ramo `main` e variáveis do ambiente Production no painel. Se usar Preview, configure credenciais de staging nesse ambiente, separadas de produção.
4. Antes de publicar esta atualização, siga o procedimento de banco abaixo e aplique `20261020000000_add_uniform_gender` no destino. Verifique também as migrations anteriores pendentes.
5. Faça o commit/push quando pronto para publicar; a integração existente da `main` dispara produção. Após o status Ready, execute as verificações funcionais abaixo.

Esta revisão adiciona o enum `UniformGender` e a coluna opcional `UniformVariant.gender`. A migration `20261020000000_add_uniform_gender` deve ser aplicada **antes do deploy do código**, após backup, conferência de histórico e ensaio em staging. Sem a coluna, as consultas Prisma do novo código falham. O build e o runtime não aplicam essa alteração. A pendência histórica de `User.name` também exige conferência do estado real. As configurações remotas, WAF, backups e credenciais da Vercel não foram alterados por esta preparação local.

## Classificação dos uniformes e histórico — 20/10/2026

- Novo cadastro exige **Masculino** ou **Feminino** no formulário e na API. Uniformes já cadastrados permanecem como **Não informado** (`NULL`); podem ser classificados em **Estoque → Editar**, junto com saldo e mínimo.
- `POST /api/variants` exige `gender: "MASCULINO" | "FEMININO"`. `PATCH /api/inventory` aceita esses valores ou `null`; omitir o campo preserva a classificação. A edição de classificação e saldo usa a mesma transação e respeita a loja da sessão. Classificar sem mudar quantidade não gera movimento de estoque.
- A classificação aparece no estoque, catálogo público, solicitações, prévia de importação e nos dois CSVs. Excel continua recebendo somente SKU e quantidade. A edição atualiza a versão do saldo: prévias antigas de importação exigem nova conferência.
- O histórico destaca nome e LDAP, lista cada uniforme com classificação/tamanho/cor/SKU e quantidade, e mantém total, data, status e ações de pedidos pendentes. O código não é exibido no histórico, resumo recente ou janela de edição; permanece nas APIs, CSV e comprovante público.
- Nenhuma restrição de uniforme por perfil do colaborador foi criada. A classificação pertence ao uniforme, sem inferir dados do colaborador. Mudanças posteriores da classificação também aparecem ao consultar pedidos antigos; não há snapshot dos metadados do uniforme.
- Migração aditiva, sem preenchimento arbitrário de dados existentes. Não execute seed nem db:push. Após conferir `npx prisma migrate status`, ensaiar e fazer backup, execute `npm run db:deploy` no ambiente correto antes do deploy e confirme a coluna e os registros legados nulos. Uma reversão do código pode manter essa coluna opcional.

Em staging, cadastre os dois tipos, classifique um item legado sem alterar saldo, confirme o isolamento entre lojas, abra catálogo e histórico no celular e exporte os CSVs. Gere uma prévia Excel, altere a classificação do item em outra aba e confirme que a prévia antiga retorna conflito. Recarregue abas administrativas abertas antes do deploy, pois o cadastro novo passa a exigir `gender`.

## Importação de estoque por Excel

Nova funcionalidade local em **Estoque → Importar Excel**. Inclua no commit as rotas `src/app/api/inventory/import/`, os módulos `src/lib/inventory-import*`, o componente de conferência, o modelo `public/modelo-entrada-estoque.xlsx`, os testes e as dependências/lockfile atualizados. Usa `read-excel-file` para leitura e `fflate` para limitar/verificar o conteúdo ZIP. Não há nova variável de ambiente nem migration.

- Modelo: uma aba, colunas `SKU` e `Quantidade`, cabeçalhos na linha 1; `.xlsx` até 2 MB e 200 linhas de dados. Quantidades positivas inteiras, sem fórmulas, soma e saldo final por SKU até 1.000.000. SKU com zeros iniciais deve ser texto. Colunas extras são ignoradas, com limite de 32 colunas; arquivos com formatação em linhas excedentes devem ser simplificados.
- Prévia por loja com nome, tipo/categoria, tamanho/cor e saldo antes/quantidade da planilha/saldo após. Duplicatas são agrupadas e identificadas pelas linhas da planilha. Todos os itens exigem conferência; qualquer erro impede confirmar o lote.
- JWT de prévia válido por 15 minutos, vinculado à conta e à loja. A API confere novamente os saldos e suas versões. Conflito retorna 409, sem entrada parcial, e exige atualizar a prévia e conferir novamente.
- Entradas e movimentos são registrados na mesma transação `Serializable`, com timeout de 20 segundos. As duas rotas declaram `maxDuration = 30` para reservar tempo para autenticação e resposta na Vercel, conforme a [configuração de duração das funções](https://vercel.com/docs/functions/configuring-functions/duration). O UUID da prévia aparece nos IDs e observações de `StockMovement`. Preserve esses registros: são o recibo usado para impedir duplicação por reenvio da mesma confirmação.
- Em erro de conexão, repetir a confirmação na mesma janela recupera o resultado. Uma prévia expirada só pode recuperar um recibo já existente durante a sessão. Nova prévia, mesmo do mesmo arquivo, significa nova entrada; conferir saldos antes de reiniciar uma operação cujo resultado ficou incerto.
- Cancelar antes de confirmar não altera estoque. O upload não é armazenado em disco nem enviado a terceiros. Nenhum dado de produção foi usado nos testes locais.

Validação em staging: importe dois SKUs conhecidos e confira saldo/histórico; cancele uma prévia; teste SKU inexistente, quantidade inválida, duplicatas, tentativa de outra loja, reenvio da confirmação e alteração de saldo por outro operador entre prévia e confirmação. Teste também o lote máximo sob a latência real do PostgreSQL. Os testes automatizados usam Prisma simulado, portanto não comprovam concorrência real no banco.

## Atualização das solicitações — 20/10/2026

- Colaborador: até 3 unidades por variação/SKU em cada solicitação, conforme o saldo disponível. Formulário e API aplicam a mesma regra; duplicatas são somadas antes de conferir o limite. Não há cota acumulada por LDAP/período, nem conversão de pedidos existentes.
- Administrador: lápis em Solicitações permite trocar, adicionar, remover itens e alterar quantidades de pedidos pendentes. Conforme solicitado, o administrador pode ultrapassar 3; permanece o teto de 20 por item e 20 linhas. A edição mantém colaborador, código, observações e status.
- Salvar substitui os itens e recalcula a reserva em transação Serializable. Considera os outros pedidos pendentes, excluindo a reserva anterior do próprio pedido. Nenhuma saída é gerada até a aprovação.
- GET/PUT em `/api/requests/[id]` respeitam a loja da conta. PUT exige `items` e `updatedAt`. PATCH de aprovação/recusa passa a exigir `action` e `updatedAt`, também fornecido pelo dashboard. Recarregue abas administrativas antigas após o deploy. Pedido já processado ou versão desatualizada é recusado com 409; aprovação e edição não podem usar itens de versões diferentes.
- Não há nova variável, dependência ou migration. Testes locais usam Prisma simulado e URLs de banco fictícias somente no processo. Nenhum estoque real foi alterado.

Em staging, confira: colaborador selecionando 3 e tentando enviar 4 via POST; duplicatas cuja soma excede 3; administrador trocando item e informando 5; redução/remoção liberando a reserva; conflito com reservas de outro pedido; acesso por outra loja; duas edições simultâneas; edição concorrendo com aprovação. Confira se o histórico de saída reflete somente os itens finais aprovados.

Validação local desta atualização: `npm run verify` passou com geração/validação do Prisma, lint, 35 testes e build; `npm run test:smoke` passou com 14 verificações HTTP. No Chromium, passaram os 8 testes anteriores de importação e os 8 novos de solicitações em desktop/celular (estes reexecutados com `npm run test:ui -- tests/browser/request-edit.spec.ts` após corrigir os seletores dos testes). As capturas da edição foram inspecionadas. Os testes de navegador simulam APIs e os de servidor simulam Prisma; concorrência real no PostgreSQL continua sendo validação de staging. Não houve push ou deploy.

## Segredos e variáveis

| Variável | Finalidade |
| --- | --- |
| `DATABASE_URL` | Conexão de execução ao PostgreSQL, normalmente via pooler. |
| `DIRECT_URL` | Conexão direta para migrations. |
| `ADMIN_SESSION_SECRET` | Assinatura JWT, com pelo menos 32 bytes aleatórios. |
| `ADMIN_PASSWORD` | Provisionamento inicial e scripts pontuais de senha; não altera logins já criados por simples troca da variável. |

Configure os valores como segredos na Vercel. O projeto usa arquivos `.env`/ `.env.local` ignorados pelo Git apenas em desenvolvimento local. Não exponha valores, hashes, cookies ou URLs completas de banco em logs, documentação ou commits. No ambiente deste projeto, os segredos de produção não puderam ser exportados com `vercel env run -e production`; não presuma que comandos locais acessam o banco de produção.

O login verifica `User.passwordHash` com bcrypt. A sessão usa cookie HTTP-only, Secure em produção e SameSite=Strict; o servidor revalida o usuário e seu escopo. Alterar `ADMIN_PASSWORD` na Vercel, isoladamente, não redefine a senha de uma conta existente.

## Provisionamento e recuperação administrativa

**Banco totalmente vazio:** após conferir que não há usuários nem dados de negócio, `POST /api/setup` cria a loja inicial e a conta `admin` com papel `MASTER_ADMIN`, usando `ADMIN_PASSWORD` (pelo menos 12 caracteres e no máximo 72 bytes). O endpoint é público, mas bloqueia novas execuções quando o banco já tem usuários ou dados de negócio. Não o use na base existente.

**Banco com dados e sem usuários:** `npm run admin:inspect` consulta o estado sem alterar o banco. Depois de confirmar a conexão, `npm run admin:bootstrap-existing` cria uma única conta master preservando os dados. Ele recusa a operação se já houver usuário ou se o banco estiver vazio.

**Conta `admin` master já existente:** `npm run admin:set-password` grava novo hash a partir de `ADMIN_PASSWORD` no ambiente e encerra a exigência de troca dessa conta. Verifique `DATABASE_URL` e o ambiente antes de usar. A senha não é exibida pelo script. Para contas comuns, o `MASTER_ADMIN` usa o reset em Administração → Usuários.

O `npm run db:seed` apaga tabelas de negócio e cria dados e acesso demonstrativos. Use somente em banco local descartável. A trava `ALLOW_DESTRUCTIVE_SEED` não o torna procedimento de produção.

## Migrações e dados existentes

1. Faça backup consistente do PostgreSQL e teste a restauração.
2. Confira o estado real do schema e o histórico com `prisma migrate status` usando a conexão direta correta. Bancos anteriores à migration inicial podem exigir baseline após conferência detalhada; não aplique `migrate resolve` por suposição.
3. Ensaie as migrations em staging com cópia representativa da base. A migration `20261014185052_add_multi_store` só faz backfill automático de legado com no máximo uma loja e aborta se houver ambiguidade.
4. Verifique a coluna `User.name` e a migration `20261018230000_add_user_name`. A autenticação não cria mais colunas em runtime; ambientes novos precisam das migrations antes de iniciar a aplicação. Não repetir SQL manualmente.
5. Depois da migration, confira usuários, lojas, vínculos, variações, saldos, movimentos e solicitações. Prepare rollback da aplicação e restauração do banco para a janela de release.

Não use `db:push` nem `db:seed` em produção.

## Verificação de release

- Confirme que o deployment esperado está Ready e associado ao commit desejado, no domínio estável.
- Verifique login e logout, troca obrigatória após criação/reset de usuário e bloqueio de sessão antiga após edição ou desativação.
- Teste `STORE_ADMIN` em duas lojas, incluindo tentativa de passar `storeId` de outra loja nas APIs. Teste o `MASTER_ADMIN` escolhendo lojas distintas.
- Teste criação/edição/exclusão de lojas e usuários, reset de senha, estoque, solicitação pública, aprovação/recusa e CSV. A exclusão de loja com dados vinculados deve ser recusada.
- Confira `/solicitar?loja=CODIGO` para cada unidade. O LDAP/nome do autoatendimento são declarações do visitante, não identidade corporativa comprovada.
- Na identificação, confira LDAP de exatamente 8 dígitos, incluindo zeros iniciais, e nome com letras, acentos e espaços. O nome não tem limite de comprimento na validação da aplicação. Verifique a recusa de LDAP com letras/comprimento incorreto e nomes com números ou pontuação, tanto no formulário quanto por POST direto (400). Os registros anteriores não foram convertidos.
- Execute `npm run vercel-build` no código a publicar. Os testes usam banco simulado; faça testes funcionais em staging com PostgreSQL, incluindo operações simultâneas.
- Configure limites de tentativa/WAF para login e solicitação pública e monitore erros de autenticação e banco. Revise `npm audit` antes de atualizações de dependências.

## Correções locais de 19/10/2026

- `POST /api/inventory`: SAIDA subtrai o saldo e grava movimento negativo; ENTRADA soma e AJUSTE define o saldo final. Quantidade deve ser inteira entre 0 e 1.000.000. Saldo negativo é recusado com 409. A atualização compara o saldo lido e retorna 409 em conflito, sem gravar movimento na transação revertida.
- Os dois botões CSV enviam o `storeId` da loja exibida. A API mantém exportação global para MASTER_ADMIN sem filtro e força a loja da sessão para STORE_ADMIN.
- Cadastro e edição de lojas exigem cidade (2 a 100 caracteres) e UF brasileira válida. Lojas antigas com valores provisórios devem ser corrigidas pela interface; nenhum dado existente foi alterado automaticamente.
- Solicitações administrativas e públicas compartilham a verificação de saldo menos reservas PENDENTE, dentro de transação Serializable. Pedidos administrativos agregam linhas repetidas, limitam a 20 peças por variação e usam UUID no código. Indisponibilidade e conflitos de serialização retornam 409; o cliente deve atualizar os dados e tentar novamente.
- Testes automatizados cobrem sinais de movimentos, saldo insuficiente, conflito simulado de atualização, isolamento de loja, reservas, conflito de serialização simulado e localização. Não substituem testes de concorrência real no PostgreSQL nem validação visual dos formulários/CSV.
- Autoatendimento: formulário e API exigem LDAP numérico de 8 dígitos e nome apenas com letras, acentos e espaços, sem limite de comprimento. O LDAP continua sendo texto, preservando zeros iniciais. A integração com uma base de colaboradores e elegibilidade de uniformes está planejada no escopo, ainda não implementada.
- A suíte inclui testes de identificação, POST público com banco simulado e bloqueio de configuração de deploy inválida. Os resultados da preparação de release estão registrados abaixo.

## Pendências operacionais e de segurança

- Cinco migrations regularizadas em local/produção. A auditoria removeu o DDL de `User.name` durante autenticação; publicar a revisão e aplicar migrations normalmente em ambientes novos.
- WAF configurado e testado em 22/10/2026, conforme a validação após publicação. Confirmar monitoramento e política de backup automático no provedor.
- LDAP continua autodeclarado; integração corporativa e MFA exigem definição do provedor e regras de acesso.
- Revisar dependências com `npm audit` antes de cada release. O resultado final desta revisão está na seção de validação abaixo; ainda há avisos na cadeia de lint.
- Seed continua destrutivo, mas a auditoria removeu a senha fixa e passou a exigir conexão local, flag explícita e senha configurada. Produção/Vercel e banco remoto são bloqueados.
- Validar em staging saída/ajuste simultâneos, pedidos públicos e administrativos concorrentes, aprovação, CSV por loja e cadastro/edição de localização antes de publicar.

Nenhum deploy, push, migration ou acesso ao banco de produção foi executado nesta revisão.

## Validação da preparação de release — 19/10/2026

- Instalação limpa pelo lockfile realizada. Versão local: Node 24.21.0; requisito versionado: 24.x.
- `npm run vercel-build` passou: verificação de ambiente local, geração/validação do Prisma, lint, 13 testes e build Next.js.
- `npm run test:smoke` passou com 8 verificações HTTP em servidor local de produção: solicitação, login, CSS, logo, redirecionamento de acesso protegido, API sem sessão e dois pedidos com identificação inválida. O script substitui conexões por endereços fictícios; nenhum banco real é consultado.
- `npm audit --omit=dev`: zero vulnerabilidades reportadas. `npm audit` completo: 5 alertas altos relacionados à mesma cadeia `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`.
- O resultado anterior de zero alertas na árvore completa não se confirmou na consulta direta ao registro. Após instalação limpa, foram encontrados 10 alertas; as correções abaixo reduziram o total para 5.
- Overrides restritos e registrados no lockfile: PostCSS 8.5.31 para Next.js e deepmerge-ts 8.0.0 para `@prisma/config`. O segundo altera o tratamento de Maps e referências circulares; o projeto usa configuração simples, e a suíte valida seu carregamento pelo Prisma, além de geração e validação do schema. Revisar os overrides ao atualizar Next.js/Prisma. [Aviso deepmerge-ts](https://github.com/advisories/GHSA-ggr8-5vv4-36mx).
- O alerta restante de `braces` afeta padrões profundamente aninhados; não há versão corrigida publicada. Nesta árvore, ele é usado pelo lint durante desenvolvimento/build, com configuração do repositório, não pelas rotas da aplicação. Não é erro de compilação, mas permanece uma pendência de segurança das ferramentas; avaliar antes de executar builds de contribuições não confiáveis. Não foi aplicado o downgrade de `eslint-config-next` sugerido por `npm audit fix --force`. [Aviso braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

Limites: não houve teste de concorrência com PostgreSQL real nem verificação de credenciais, histórico de migrations, WAF ou backups no projeto remoto. A integração Vercel foi localizada, mas não está instalada/conectada nesta sessão. A chave de sessão ausente no ambiente local foi gerada em `.env.local`, ignorado pelo Git; a chave de produção não foi alterada.

## Validação da importação Excel — 19/10/2026

- `npm run vercel-build`: Prisma, lint, 26 testes de regras/APIs/leitura de arquivos e build aprovados. Foi corrigida também a tipagem de duas substituições do Prisma no teste público já existente.
- Nesta validação, `DATABASE_URL` e `DIRECT_URL` estavam ausentes no ambiente local. O build foi executado com URLs fictícias definidas somente no processo; não valida as credenciais reais. Configure as conexões no ambiente de destino antes de usar a aplicação.
- `npm run test:smoke`: 11 verificações HTTP, incluindo bloqueio sem sessão nas duas novas rotas e download do modelo `.xlsx`.
- `npm run test:ui`: 8 testes no Chromium, em desktop e celular, com APIs simuladas. Conferência individual, cancelamento, bloqueio de SKU inválido, conflito de saldo e recuperação após erro de rede passaram. Nomes acessíveis dos botões do menu foram corrigidos para telas pequenas. Capturas locais foram inspecionadas.
- Para repetir os testes de navegador após o build: `npx playwright install chromium` (uma vez) e `npm run test:ui`. Browser e resultados são locais; o build da Vercel não instala nem executa navegador.
- Auditoria de produção após incluir as bibliotecas de Excel: zero vulnerabilidades reportadas. A instalação mantém os 5 alertas de desenvolvimento documentados acima.
- Nenhum estoque real, configuração remota, migration, push ou deploy foi executado. O ensaio com PostgreSQL em staging, incluindo lote máximo e concorrência real, continua pendente.

## Validação da classificação e histórico — concluída em 21/10/2026

- `npm run verify`: geração/validação do Prisma, lint, 40 testes de regras/APIs e build aprovados, usando conexões fictícias somente no processo.
- `npm run test:smoke`: 14 verificações HTTP aprovadas com banco real inacessível.
- `npm run test:ui -- --max-failures=1`: 18 testes aprovados em desktop/celular. Cadastro exige classificação; edição permite classificar legado sem alterar quantidade; catálogo exibe Masculino/Feminino; histórico mostra colaborador e itens/quantidades; edição e aprovação continuam funcionando. Capturas de cadastro e histórico foram inspecionadas.
- Testes de servidor usam Prisma simulado e os de navegador simulam APIs. A migration foi preparada e revisada, mas não executada em PostgreSQL. Validar em staging e aplicar no destino antes do deploy, conforme os passos acima.
- Nenhuma alteração no banco real, push, deploy ou alteração de credenciais foi realizada nesta atualização.

Veja o contexto e a ordem sugerida de trabalho em [ESCOPO.md](./ESCOPO.md).
