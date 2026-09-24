# Implantação no Railway

O projeto usa três serviços no mesmo ambiente: `Postgres`, backend Laravel e frontend estático. O worker de notificações é um quarto serviço, sem domínio público. O `docker-compose.yml` permanece voltado ao desenvolvimento local.

## Frontend

- Fonte: o mesmo repositório, branch `master`, Root Directory `/frontend`.
- Builder: Dockerfile, caminho `/frontend/Dockerfile`.
- Domínio público: apontar para a porta interna `5173`.
- Healthcheck Path: `/`.
- Variável opcional para alterar o destino do proxy: `BACKEND_URL=https://DOMINIO-PUBLICO-DO-BACKEND`, sem barra final. O valor padrão é o domínio atual, confirmado pelo health check: `https://v-lab-desafio-tecnico-production.up.railway.app`.

O Dockerfile gera `dist` com Node 20 e serve o resultado com Caddy. O Caddy encaminha `/api/*` e `/sanctum/*` ao backend sem remover o caminho; as demais rotas servem o aplicativo React, inclusive após atualizar uma URL interna. O navegador usa a origem do frontend para API e cookies. `VITE_API_URL` continua restrita ao proxy do Vite usado pelo Compose local.

Se o domínio público do backend mudar, atualize `BACKEND_URL` no serviço frontend e faça novo deploy.

## Backend

- Root Directory `/backend`, Dockerfile `/backend/Dockerfile`, porta interna `8000`.
- Healthcheck Path `/api/v1/health`; o resultado esperado é `{"status":"ok","db":"ok"}`.
- A imagem de produção instala só as dependências de runtime (`composer install --no-dev`); o build arg `INSTALAR_DEPENDENCIAS_DEV` fica no padrão `false`. Com `APP_ENV=production` o entrypoint não cria o banco de testes `vlab_test` e não altera o banco da aplicação além das migrations.
- Mantenha `APP_KEY` estável e secreta, `APP_ENV=production`, `APP_DEBUG=false`, `APP_SEED=false`, `PORT=8000` e as referências `DB_*` do serviço Postgres.
- Defina `APP_URL=https://DOMINIO-PUBLICO-DO-BACKEND` e `FRONTEND_URL=https://DOMINIO-PUBLICO-DO-FRONTEND`.
- Defina `SANCTUM_STATEFUL_DOMAINS=DOMINIO-PUBLICO-DO-FRONTEND` **sem** `https://` e sem barra final. Não configure `SESSION_DOMAIN`, para que os cookies sejam vinculados à origem apresentada ao navegador. Use `SESSION_SECURE_COOKIE=true` com HTTPS.
- As rotas autenticadas usam a sessão web do Laravel, inclusive após o login. Se a lista aparecer por um instante e a tela voltar ao login, confirme que a sessão e os cookies persistem entre `/auth/login` e `/fila` e confira os códigos HTTP no navegador; não compartilhe cookies ou senhas.

No ambiente atual, o domínio frontend exibido no Railway é `beneficial-curiosity-production-b56d.up.railway.app`. Atualize as variáveis se algum domínio mudar. A alteração de variáveis exige novo deploy do serviço afetado.

## Verificação após publicar

1. Confirme `GET /api/v1/health` no backend e o carregamento da página de login no domínio frontend.
2. Abra `/api/v1/health` **no domínio frontend**; deve retornar o mesmo JSON do backend, provando o proxy.
3. Confira `/sanctum/csrf-cookie`, login, atualização da página em uma rota interna, logout e uma ação autenticada. Verifique que o navegador recebe cookies do domínio frontend.
4. Com `APP_SEED=false`, crie uma conta administrativa no serviço backend. No Railway, abra o terminal SSH do backend e execute `php artisan operadores:criar`. Informe usuário (mínimo de 3 caracteres), e-mail opcional e uma senha não vazia nos prompts interativos. A senha não aparece no terminal. O comando recusa usuário ou e-mail já cadastrado e não altera contas existentes. Entre no frontend com o usuário e a senha. O e-mail opcional ainda não habilita recuperação de senha, pois esse fluxo não está implementado. Não coloque credenciais em Variables, comandos, GitHub ou capturas de tela.
5. Veja os logs de deploy de cada serviço se algum passo falhar. O healthcheck de frontend em `/` prova que os arquivos estão sendo servidos; não substitui o healthcheck do banco nem o teste de login.

O worker de notificações precisa ser implantado como serviço separado usando a imagem do backend e a mesma conexão com o banco. A ausência dele não deve desfazer transições já gravadas, mas deixa os jobs pendentes; consulte `docs/architecture.md` para operação e retry.

## Carga fictícia de 500 solicitações

O comando `php artisan solicitacoes:popular-demonstracao` insere uma carga única de 500 solicitações no PostgreSQL conectado ao backend. Cada uma recebe `id` numérico e protocolo textual com oito dígitos aleatórios e únicos. Os nomes e descrições são marcados como `[DEMO]`/`[DEMO-500]`; os CPFs são gerados com dígito verificador deliberadamente inválido. A carga distribui categorias, prioridades, estados, fila, agenda, histórico e faltas. A inserção é transacional e uma segunda execução não duplica a carga.

Para executar no Railway sem SSH, defina **somente no serviço backend** `APP_DEMO_500=true` depois que o commit com o comando estiver implantado. O próximo deploy executará a carga após as migrations. Confirme nos logs a mensagem de 500 solicitações inseridas e remova `APP_DEMO_500` em seguida; a remoção provoca outro deploy, mas não apaga os registros. A geração normal de novos protocolos continua seguindo `SOL-ano-sequência` conforme a especificação do sistema; o formato numérico de oito dígitos vale apenas para esta carga fictícia.
