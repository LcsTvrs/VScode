# Escopo e guia de continuidade — Gestão Uniformes

Atualizado em 18/10/2026. Este documento descreve o código do ramo principal e o estado de produção verificado nessa data. É o ponto de partida para qualquer pessoa ou IA que continue o projeto. Não contém credenciais; confirme a revisão Git, os dados operacionais da Vercel e o banco antes de agir.

## 1. Objetivo e estado atual

Aplicação web para gestão de uniformes da Leroy Merlin: lojas, contas administrativas, estoque por variação, movimentações, solicitações de colaboradores, aprovação ou recusa e exportações CSV. Interface em português brasileiro.

- Repositório público: https://github.com/LcsTvrs/VScode; ramo de publicação: main.
- Endereço estável de produção: https://estoqueuniformes.vercel.app. URLs com hash de deployment são versões imutáveis e podem ficar desatualizadas.
- Hospedagem: Vercel, projeto estoque_uniformes na equipe oktus2; push em main dispara deployment de produção. A revisão funcional 79fd6eb ficou Ready em 18/10/2026.
- Último estado do banco informado pelo usuário antes dessas alterações: uma loja (código 0012) e uma conta MASTER_ADMIN criada sobre dados preexistentes. Isso não é inventário atual; confirme pela interface antes de tomar decisões.
- A coluna de nome do usuário foi acrescentada no banco de produção pelo primeiro acesso após o deployment. A migração Prisma correspondente ainda precisa ter seu status formal conferido, pois a conexão direta não está disponível localmente.

### O que está implementado

- Login individual de administradores, papéis MASTER_ADMIN e STORE_ADMIN, sessão por cookie, troca obrigatória da senha temporária.
- Painel por loja com visão geral, estoque, solicitações e seleção de loja pelo administrador geral. Sem seleção, o MASTER_ADMIN vê a lista de lojas; a seleção também aparece na URL como parâmetro storeId.
- Cadastro, edição e exclusão de lojas e usuários pelo MASTER_ADMIN; reset administrativo de senha. Usuários têm login e nome de exibição separados.
- Catálogo público e solicitação em /solicitar com seleção de loja quando há mais de uma.
- Cadastro de variações de uniformes, saldo inicial, entradas, ajustes, edição de saldo e mínimo, aprovação/recusa de pedidos e exportações CSV.

## 2. Mapa do repositório

| Local | Responsabilidade |
| --- | --- |
| [package.json](../package.json) | Scripts e dependências. |
| [prisma/schema.prisma](../prisma/schema.prisma) | Modelos, relações, enums e índices do PostgreSQL. |
| [prisma/migrations/](../prisma/migrations/) | Migrações versionadas; revisar antes de aplicar. |
| [src/app/page.tsx](../src/app/page.tsx) | Painel principal do administrador. |
| [src/app/admin/](../src/app/admin/) | Login, usuários, lojas e troca de senha. |
| [src/app/solicitar/page.tsx](../src/app/solicitar/page.tsx) | Fluxo público do colaborador. |
| [src/app/api/](../src/app/api/) | Rotas HTTP e regras de negócio. |
| [src/lib/](../src/lib/) | Prisma, sessão, autenticação, CSV e senha temporária. |
| [src/middleware.ts](../src/middleware.ts) | Filtro inicial de páginas e APIs protegidas. |
| [src/app/globals.css](../src/app/globals.css) | Estilos próprios; usa Tailwind v4 via [postcss.config.mjs](../postcss.config.mjs). |
| [public/leroy-merlin.svg](../public/leroy-merlin.svg) | Logo usada no painel e nas páginas públicas. |
| [scripts/](../scripts/) | Inspeção do admin e procedimentos pontuais de senha/provisionamento. |
| [docs/PRODUCAO.md](./PRODUCAO.md) | Checklist operacional de produção. |

O arquivo [.github/copilot-instructions.md](../.github/copilot-instructions.md) contém orientações curtas para agentes, mas este documento e o código atual prevalecem se houver divergência.

## 3. Stack, ambiente e comandos

- Next.js 15 App Router, React 19, TypeScript, Node.js >= 20.19.
- Prisma 6 com PostgreSQL; bcryptjs para hashes de senha; jose para JWT.
- Tailwind CSS 4, PostCSS e CSS próprio. O plugin em [postcss.config.mjs](../postcss.config.mjs) é indispensável para o estilo das páginas administrativas.
- [next.config.ts](../next.config.ts) define cabeçalhos de segurança; [src/app/layout.tsx](../src/app/layout.tsx) importa o CSS global.

Comandos a partir da raiz do repositório:

    npm ci
    npm run db:generate
    npm run db:deploy
    npm run dev
    npm run lint
    npm run build

Use npm run db:deploy somente no banco pretendido e após verificar o estado de migração. npm run db:push é útil apenas em banco de desenvolvimento descartável. npm run db:seed apaga os dados de negócio e cria dados demonstrativos; nunca o execute em produção. Não há script de testes automatizados no [package.json](../package.json); build e lint não substituem teste funcional.

### Variáveis de ambiente — nomes, sem valores

| Variável | Uso |
| --- | --- |
| DATABASE_URL | Conexão PostgreSQL de execução, normalmente com pooler. |
| DIRECT_URL | Conexão direta usada por Prisma Migrate. |
| ADMIN_SESSION_SECRET | Assinatura JWT; no mínimo 32 bytes. |
| ADMIN_PASSWORD | Usada apenas pelo provisionamento inicial ou pelos scripts administrativos de senha, não como senha dinâmica do login. |
| ALLOW_DESTRUCTIVE_SEED | Trava adicional do seed em produção; não configurar para uso normal. |

Use [.env.example](../.env.example) apenas como modelo. [.gitignore](../.gitignore) exclui .env, .env.local, .vercel e arquivos de chave. A Vercel marca os segredos de produção como não exportáveis; vercel env run -e production não os disponibilizou localmente, portanto não presuma que scripts locais alcançam o banco de produção. Nunca copie valores reais para documentação, commit ou saída de ferramenta.

## 4. Perfis, sessão e acesso

### MASTER_ADMIN

- Sem vínculo obrigatório a uma loja; pode ver a lista de todas, escolher uma no painel e operar nela.
- Administra todas as lojas e contas em /admin/lojas e /admin/usuarios.
- Pode exportar dados de uma loja passando storeId à API ou de todas sem esse parâmetro. A interface do painel atualmente chama as exportações sem storeId, mesmo quando uma loja está selecionada; isso é uma pendência de UX.

### STORE_ADMIN

- Precisa estar associado a uma loja; o storeId é retirado da sessão, não do corpo ou da URL fornecidos pelo navegador.
- Gerencia estoque e solicitações da própria loja. Não acessa o CRUD de lojas/usuários.

### Sessão e nomes

- [src/lib/admin-session.ts](../src/lib/admin-session.ts) assina um JWT HS256 de até 8 horas em cookie HTTP-only, Secure em produção e SameSite=Strict. Inclui ID, login, papel, loja, sinal de troca obrigatória e updatedAt do usuário.
- [src/lib/admin-auth.ts](../src/lib/admin-auth.ts) consulta o usuário a cada chamada autenticada e rejeita sessão obsoleta quando login, papel, loja, estado de senha ou updatedAt mudam. O nome de exibição vem do banco; em contas antigas sem nome, aparece o login.
- [src/middleware.ts](../src/middleware.ts) redireciona páginas sem sessão e retorna 401 nas APIs. Durante troca obrigatória, bloqueia painel e operações, permitindo somente troca e logout. Cada API também deve validar o papel e o escopo no servidor.
- O nome da conta master antiga pode ser preenchido em /admin/usuarios → Editar. Uma edição da própria conta renova o cookie; editar outra conta invalida a sessão antiga desse usuário pelo updatedAt.
- O login compara a senha com o hash bcrypt armazenado em User; mudar ADMIN_PASSWORD na Vercel não muda automaticamente a senha de uma conta já criada.

## 5. Fluxos do produto e regras de negócio

### Provisionamento e contas

- Banco realmente vazio: POST /api/setup cria uma loja inicial e a primeira conta MASTER_ADMIN com hash de ADMIN_PASSWORD. O endpoint é público, mas recusa nova execução quando já há usuários e recusa provisionamento se há dados de negócio.
- Banco com dados e nenhum usuário: [scripts/inspect-admin-state.ts](../scripts/inspect-admin-state.ts) inspeciona; [scripts/bootstrap-admin-existing.ts](../scripts/bootstrap-admin-existing.ts) cria a conta master sem apagar dados e exige ADMIN_PASSWORD. Não repetir após existir qualquer conta.
- [scripts/set-master-password.ts](../scripts/set-master-password.ts) redefine a senha da conta admin MASTER_ADMIN existente, exigindo ADMIN_PASSWORD no ambiente. Verifique a conexão antes de executar; o script não mostra a senha.
- O MASTER_ADMIN cria novos usuários com login, nome, papel e, para STORE_ADMIN, loja. A API gera senha temporária de 10 caracteres, mostra apenas na resposta e guarda só o hash. O usuário deve trocá-la por uma senha de 12 a 128 caracteres no primeiro login. Reset exige nova troca.
- O CRUD impede que o administrador exclua sua própria conta ou altere seu próprio papel.

### Lojas e estoque

- Loja tem código técnico único e nome de exibição. O formulário de criação pede só nome: a API gera código e inicializa cidade como “A definir” e UF como “NA”. A interface atual edita nome e código, mas não cidade/UF.
- Variações são específicas da loja; SKU é único dentro de cada loja. Estoque guarda saldo e mínimo por loja e variação.
- Cadastro com saldo positivo gera StockMovement do tipo ENTRADA. Ajustes e edição de saldo geram movimentações para auditoria.
- Aprovação de solicitação PENDENTE muda status, baixa saldo e grava SAIDA na mesma transação; se faltar saldo, tudo é revertido. Recusa apenas muda o status.

### Solicitação pública

- /solicitar dispensa login. Com mais de uma loja, o usuário escolhe a unidade; a URL /solicitar?loja=CODIGO pode fixar o contexto.
- O catálogo mostra saldo menos quantidades de pedidos PENDENTE. O POST valida novamente a disponibilidade em transação serializável, cria ou atualiza Employee por loja+LDAP e registra a solicitação como PENDENTE.
- LDAP e nome são informados pelo próprio visitante; não há integração com diretório corporativo nem prova de identidade. Não trate esse campo como autenticação.
- O POST público aceita até 20 linhas e até 20 peças por variação após agregação; confira o código antes de alterar esses limites.

## 6. Modelo de dados

Modelos e relações completos em [prisma/schema.prisma](../prisma/schema.prisma):

| Modelo | Papel |
| --- | --- |
| Store | Unidade; código único, nome, cidade, UF. |
| User | Conta administrativa; login único, nome opcional para legado, hash, papel, loja opcional, troca obrigatória. |
| Employee | Colaborador identificado por loja+LDAP ou e-mail opcionais. |
| UniformVariant | Uniforme por loja, SKU, categoria, cor e tamanho; SKU único por loja. |
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
| POST /api/auth/login | Público | Valida login/senha e define cookie. |
| POST /api/auth/change-password | Admin com troca pendente | Troca hash e renova cookie. |
| POST /api/auth/logout | Admin | Remove cookie. |
| GET /api/dashboard | Admin | storeId para MASTER_ADMIN; sem ele retorna lista de lojas. STORE_ADMIN usa sua loja. |
| GET, POST /api/stores | MASTER_ADMIN | Lista ou cria lojas. |
| PUT, DELETE /api/stores/[id] | MASTER_ADMIN | Edita ou exclui loja; exclusão é recusada se houver vínculos. |
| GET, POST /api/users | MASTER_ADMIN | Lista ou cria contas. |
| PUT, DELETE /api/users/[id] | MASTER_ADMIN | Edita ou exclui conta, com proteção da própria conta. |
| POST /api/users/[id]/reset | MASTER_ADMIN | Gera senha temporária e exige troca. |
| POST /api/variants | Admin no escopo de loja | Cria uniforme e saldo inicial. |
| POST, PATCH /api/inventory | Admin no escopo de loja | Movimentação ou edição de saldo e mínimo. |
| POST /api/requests | Admin no escopo de loja | Cria solicitação administrativa. |
| PATCH /api/requests/[id] | Admin no escopo de loja | Aprova ou recusa. |
| GET, POST /api/requests/public | Público | Catálogo/seleção de loja ou novo pedido público. |
| GET /api/exports/inventory | Admin | CSV de estoque; MASTER_ADMIN sem storeId exporta todas as lojas. |
| GET /api/exports/requests | Admin | CSV detalhado por item; mesma regra de loja. |

Os caminhos exatos, payloads, validações e códigos HTTP ficam nos arquivos de [src/app/api/](../src/app/api/). Não derive autorização da interface: confirme cada regra na rota.

## 8. Banco, migrações e deploy

1. [20261013000000_init](../prisma/migrations/20261013000000_init/migration.sql): schema inicial. Bancos criados antes dela podem exigir baseline, somente após conferir a estrutura real.
2. [20261014185052_add_multi_store](../prisma/migrations/20261014185052_add_multi_store/migration.sql): separa dados por loja; o backfill legado só admite no máximo uma loja e aborta em caso ambíguo.
3. [20261018230000_add_user_name](../prisma/migrations/20261018230000_add_user_name/migration.sql): coluna opcional User.name. Em produção, [src/lib/ensure-user-name-column.ts](../src/lib/ensure-user-name-column.ts) executa ALTER TABLE IF NOT EXISTS no primeiro acesso que chega ao banco, porque os segredos não foram exportáveis localmente. O acesso à rota de login de produção retornou 401 esperado para credenciais inválidas após essa atualização, indicando que a consulta com a nova coluna funcionou. Ainda é preciso consultar prisma migrate status e registrar formalmente a migration com db:deploy quando houver conexão direta.

Procedimento para mudanças futuras: estudar estado real e histórico de migrations, fazer backup restaurável, ensaiar em staging, criar/revisar SQL, aplicar migration e só então publicar código dependente de novas colunas. Não use seed nem db:push em produção. Consulte [PRODUCAO.md](./PRODUCAO.md).

## 9. Verificações e limitações

Verificado na revisão 79fd6eb: npm run build e npm run lint passaram; deployment Vercel Ready; logo estática respondeu HTTP 200; tentativa de login inválida em produção respondeu 401 esperado. Não foi feito teste autenticado completo de todos os fluxos em produção por esta sessão.

Pendências importantes, por ordem sugerida:

1. Revisar POST /api/inventory: a API aceita o enum SAIDA no POST, mas a lógica atual soma quantidade positiva quando type=SAIDA; a interface não oferece essa opção. Corrigir antes de expor outros clientes da API e cobrir entrada, saída e ajuste com teste de regra de negócio.
2. Ligar os botões de exportação do painel ao storeId selecionado para que o MASTER_ADMIN não baixe todas as lojas por engano.
3. Permitir cidade/UF reais no cadastro e edição das lojas; hoje novas lojas recebem valores provisórios.
4. Confirmar status das migrations no banco de produção, sobretudo a coluna de nome criada em runtime, e registrar a migration pendente sem executar seed.
5. Adicionar testes de autorização entre duas lojas, concorrência em solicitação/aprovação, saldo negativo, troca de senha, CRUD e exportações. O projeto ainda não tem suíte automatizada.
6. Implementar rate limit distribuído/WAF para login e pedido público, revisar dependências com npm audit e considerar MFA e autenticação real do LDAP conforme necessidade do negócio.
7. Melhorar o cadastro de solicitação administrativa: ele não faz a mesma reserva de estoque do endpoint público; a falta de saldo só é barrada na aprovação. Decidir a regra desejada antes de mudar.
8. Rever a senha fixa do seed demonstrativo se outras pessoas forem usar ambientes de teste. Ela não é credencial de produção, mas está no histórico público do Git.

## 10. Instruções para continuidade

- Leia este documento, [README.md](../README.md), [PRODUCAO.md](./PRODUCAO.md), [schema.prisma](../prisma/schema.prisma) e as rotas envolvidas antes de alterar uma regra.
- Confirme a revisão Git, o deployment ativo e o estado do banco; relatos anteriores podem estar desatualizados.
- Mantenha login e nome separados: login autentica, nome aparece na interface. Mantenha código e nome de loja separados: código identifica a unidade, nome é mostrado ao usuário.
- Nunca imprima nem publique senhas, hashes, cookies ou URLs de banco. A ausência de segredos no Git não significa que eles estejam disponíveis em ambiente local.
- Preserve as transações que mantêm saldo e pedido consistentes. Valide alterações com lint, build e testes de comportamento pertinentes.
- Atualize este arquivo e [PRODUCAO.md](./PRODUCAO.md) sempre que mudar schema, permissões, rotas, ambiente ou processo de release.
