# Revisão para início de operação — 22/10/2026

## Parecer

Os fluxos principais passaram nas verificações descritas abaixo. Foram corrigidos problemas de autenticação, integridade de estoque e validação de entrada. **As correções desta auditoria estão locais, ainda sem commit/push/deploy.** Não exigem nova migration.

Antes da liberação, publicar estas correções e recarregar as abas administrativas. Para divulgação ampla do link público, falta configurar ou comprovar limitação distribuída de tentativas no login e nos pedidos. A API administrativa da Vercel retornou HTTP 403 nesta sessão; firewall, logs, variáveis remotas e deployment exato não puderam ser conferidos por esse acesso.

O uso interno controlado exige conferência do colaborador antes da aprovação: o LDAP é autodeclarado, não autentica a pessoa. A revisão não é teste de carga nem teste de invasão independente.

## Problemas corrigidos no código local

| Prioridade | Problema identificado | Correção e evidência |
| --- | --- | --- |
| Alta | Edição de estoque comparava a versão lida durante a gravação, mas não a versão aberta na tela. Um formulário antigo podia restaurar saldo já baixado. | Dashboard entrega `updatedAt`; PATCH exige a versão exibida. Exemplo: tela aberta com 10, aprovação baixa para 5, envio da tela antiga retorna 409. Testado com PostgreSQL real. |
| Alta | Troca obrigatória de senha podia sobrescrever um reset ocorrido enquanto o bcrypt calculava o hash. | Atualização condicionada à versão e ao estado da conta; conflito retorna 409. Sessão antiga é revogada após sucesso. Testes de regressão. |
| Alta | Seed aceitava banco remoto quando executado fora de `NODE_ENV=production`, com possibilidade de apagar dados; usava senha demonstrativa fixa. | Bloqueia ambientes Vercel/produção e conexões remotas, exige flag explícita mesmo localmente e senha configurada válida. Não foi executado seed em nenhum banco. |
| Média | Parâmetro `next` do login aceitava caminhos com barra invertida que o navegador interpreta como outro domínio. | Redirecionamento restrito à mesma origem e rejeição de controles/barra invertida. Testes com formatos maliciosos. |
| Média | Novas senhas aceitavam até 128 caracteres, embora bcrypt processe somente os primeiros 72 bytes. | Política compartilhada de mínimo 12 caracteres e máximo 72 bytes em troca, provisionamento, scripts e seed. Login preserva compatibilidade com hashes existentes; não houve redefinição de senhas reais. [Limite documentado pelo bcrypt](https://github.com/dcodeIO/bcrypt.js#security-considerations). |
| Média | Autenticação executava `ALTER TABLE` no primeiro acesso de cada instância. | Removida a criação de `User.name` em runtime, pois a migration já está aplicada nos ambientes conferidos. Teste impede DDL durante autenticação. |
| Média | Entrada comum podia elevar saldo acima de 1.000.000; cadastro aceitava campos vazios/espaços e truncava SKU longo silenciosamente. | Limite do saldo final e dos valores iniciais; rejeição de campos vazios ou longos, sem truncamento silencioso. |
| Média | APIs JSON não limitavam o corpo efetivamente lido; gravações dependiam somente de SameSite para proteção de origem. | JSON limitado a 256 KiB durante leitura e exigência de `application/json`; middleware rejeita origem externa/nula e `Sec-Fetch-Site: cross-site` em gravações. Uploads mantêm seus limites próprios. |
| Média | Algumas APIs dependiam apenas do middleware para bloquear contas com troca obrigatória pendente. | Bloqueio repetido no servidor em estoque, cadastro, dashboard, exportações e administração. |
| Baixa | Conta inexistente não executava bcrypt; falhas de banco no login saíam sem resposta controlada. | Comparação com hash fictício para usuário ausente e resposta 503 genérica sem detalhes internos. Isso não substitui rate limit. |
| Baixa | Código público de solicitação usava só seis caracteres do UUID. | Passou a usar UUID completo, como o pedido administrativo. Códigos antigos preservados. |

## Validações executadas

| Verificação | Resultado e alcance |
| --- | --- |
| `npm run verify` | Prisma, schema, lint, 60 testes e build Next.js aprovados. Conexões fictícias no processo. |
| `npm run test:ui -- --max-failures=1` | 28 testes em desktop/celular aprovados; respostas de API simuladas. Estoque, Excel, edição/aprovação, filtro de datas, imagens e seletor de lojas. |
| `npm run test:smoke` | 17 verificações HTTP aprovadas contra servidor Next local, com banco inacessível. Inclui APIs sem sessão, upload de imagem sem sessão e rejeição de origem externa/nula. |
| Integração PostgreSQL 18 | Base nova isolada com dados sintéticos. Provisionamento bloqueado após primeiro uso; login; troca/reset/revogação de sessão; criação de lojas/usuários/uniformes; isolamento por loja; pedido público; edição; aprovação simultânea; estoque; conflito de formulário antigo; planilha `.xlsx`; confirmação repetida sem duplicar estoque; CSV restrito à loja. |
| Dependências de produção | `npm audit --omit=dev --json`: zero vulnerabilidades reportadas na consulta de 22/10/2026. |
| Ferramentas de desenvolvimento | `npm audit --json`: cinco alertas altos propagados pela mesma dependência `braces`, usada na cadeia de lint. Não há versão corrigida indicada no [aviso oficial](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Não foi aplicado o downgrade de Next/eslint sugerido pelo comando automático. |
| Segredos versionados | Nenhum arquivo de ambiente real versionado ou padrão conhecido de conexão Neon/chave privada/token GitHub encontrado na varredura dos arquivos rastreados atuais. A busca foi por padrões; não equivale à análise de todo o histórico Git ou de todos os tipos de segredo. |

O ensaio de banco executou as APIs e regras com Prisma real; os testes de navegador verificaram a interface separadamente. Não foram usados pedidos reais de produção para testar gravações.

## Produção: observações somente de leitura

- Login e solicitação pública responderam HTTP 200. Dashboard, usuários, lojas, duas exportações e gestão de imagem recusaram acesso sem sessão com HTTP 401.
- Cabeçalhos presentes: HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` e política de referenciador restrita.
- Catálogo da loja consultada respondeu HTTP 200 e inclui `imageId`; a funcionalidade de imagens já está exposta em produção. O ramo remoto `main` estava no commit `5357a66360ae7aef48b0df1d4ca5bc79a3d8602c`. O SHA exato associado ao deployment não foi confirmado pela API da Vercel (403).
- As cinco migrations estão concluídas. Foram encontradas uma loja, três contas administrativas, sendo duas `MASTER_ADMIN` e uma de loja. Convém confirmar que os dois acessos gerais são intencionais; nenhum perfil foi alterado.
- Zero contas de loja sem vínculo, hashes fora do formato bcrypt, saldos/mínimos fora dos limites, uniformes com campos obrigatórios vazios, itens de pedido com quantidade não positiva, pedidos sem itens ou reservas superiores ao saldo.
- Os backups manuais de local/produção foram restaurados e ensaiados na operação de migração de 22/10/2026; os registros ficam em `.vercel/`, fora do Git. A política automática de retenção/recuperação do provedor não foi confirmada.
- Nenhum dado ou credencial de produção foi alterado nesta auditoria.

## Pendências e mitigação operacional

| Prioridade | Pendência | Providência |
| --- | --- | --- |
| Alta, antes da liberação | Correções desta revisão ainda locais | Publicar, verificar conclusão do deployment e recarregar abas. O PATCH de estoque agora exige `updatedAt`; abas antigas serão recusadas até atualização. |
| Alta, antes de divulgar amplamente | Sem rate limit distribuído no código; WAF remoto não confirmado | Configurar limites para `/api/auth/login`, `/api/requests/public` e proteção de tráfego abusivo. Não foi introduzido um contador em memória que perderia eficácia entre instâncias serverless. Revalidar após reconectar a Vercel. |
| Alta para integridade de identidade | LDAP e nome públicos autodeclarados; reenvio com o mesmo LDAP pode atualizar o nome do cadastro | Conferir identidade antes de aprovar. Autenticação corporativa/cadastro oficial de colaboradores permanece evolução necessária para identificação confiável. |
| Média | Pedido público e movimentação comum não possuem recibo persistente de reenvio | Em falha de conexão após envio, conferir o histórico antes de repetir. Aprovação e importação Excel já possuem proteção contra repetição verificada. |
| Média | Backup automático, retenção, alertas e logs da plataforma não verificados | Confirmar política de recuperação e monitoramento de falhas, incluindo responsável por atendimento no início da operação. |
| Média | Histórico do dashboard sem paginação no servidor | Monitorar crescimento/latência; o filtro por dia reduz a lista exibida, mas ainda carrega o histórico inteiro. Não foi realizado teste de carga. |
| Média nas ferramentas | Alerta `braces` sem correção publicada | Não executar lint/build de contribuições não confiáveis; acompanhar correção. Não afeta as dependências de execução listadas no audit de produção. |
| Baixa | Divergência histórica de checksum da migration multi-loja apenas local | Schema foi conferido sem diferenças antes das migrations anteriores; manter registro e evitar reset automático. |

## Publicação das correções

Não há alteração de schema nesta auditoria. Os cinco migrations existentes são pré-requisito, pois a criação automática de coluna foi removida. Após publicar: confirmar login, troca obrigatória, estoque, pedido público, aprovação e exportação com contas de teste do ambiente adequado; conferir a política de origem no domínio real. Não usar produção para testes de escrita destrutivos.

Evidências operacionais locais: `.vercel/launch-audit-readonly-result.json`, `.vercel/launch-integration-result.json` e capturas em `test-results/`. Esses arquivos são ignorados pelo Git; não contêm credenciais no relatório publicado.
