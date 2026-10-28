# Integrações locais

## Arquivo de configuração

No PowerShell, na pasta do projeto:

```powershell
Copy-Item .env.example .env
notepad .env
```

Preencha apenas as integrações desejadas. O aplicativo carrega `.env` ao iniciar; variáveis já definidas no terminal têm prioridade. Reinicie depois de alterar esse arquivo. Nunca envie o `.env` para o GitHub ou cole Client Secrets em conversas.

## GitHub

### Sem login

Em Configurações, escolha **Importar projetos públicos** e informe seu usuário. A API pública possui limites de requisições; se um limite for alcançado, tente depois ou conecte a conta.

Importa até 1.000 repositórios públicos, com paginação, ignorando forks. Guarda nome, descrição, link e sugestões de tecnologias. Não baixa ou analisa o código completo nem prova autoria/domínio técnico. Reimportar não duplica repositórios existentes e preserva sua revisão local; não sobrescreve automaticamente as descrições que você editou.

### Com login OAuth

1. Abra [GitHub → Developer settings → OAuth Apps](https://github.com/settings/developers).
2. Crie um aplicativo OAuth para seu uso pessoal.
3. Homepage URL: `http://127.0.0.1:8765`.
4. Authorization callback URL: `http://127.0.0.1:8765/oauth/github/callback`.
5. Coloque Client ID e Client Secret em `GITHUB_CLIENT_ID` e `GITHUB_CLIENT_SECRET`, no `.env`.
6. Reinicie o aplicativo e clique em **Conectar**, na linha GitHub.

Escopo solicitado: `read:user`. Não solicita `repo`, não escreve nos seus repositórios e não importa repositórios privados. A API usa os repositórios públicos do usuário autenticado.

Referências: [OAuth GitHub](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps), [escopos](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps).

## LinkedIn

1. Abra o [LinkedIn Developers](https://www.linkedin.com/developers/) e crie seu aplicativo. Preencha os requisitos que o portal solicitar; ele pode exigir associação/verificação de uma LinkedIn Page.
2. Na configuração de autenticação, cadastre exatamente `http://127.0.0.1:8765/oauth/linkedin/callback` como redirect URL.
3. Em Products, solicite/ative **Sign In with LinkedIn using OpenID Connect** e **Share on LinkedIn**. A disponibilidade depende do portal e das permissões concedidas ao aplicativo.
4. Coloque Client ID e Client Secret em `LINKEDIN_CLIENT_ID` e `LINKEDIN_CLIENT_SECRET`, no `.env`.
5. Reinicie o aplicativo. Em Configurações, conecte o LinkedIn e autorize o acesso.

Escopos solicitados: `openid profile email w_member_social`.

O aplicativo consulta `/v2/userinfo` para identificar a conta e usa a API oficial para publicar texto. Não usa senha do LinkedIn, cookies copiados, scraping ou automação de navegador.

### Publicar

1. Confirme um projeto ou experiência em Meu perfil.
2. Em Publicações, escolha **Novo rascunho**.
3. Escolha a evidência. A geração usa o provedor selecionado em Configurações.
4. Revise e salve o texto. Máximo de 3.000 caracteres.
5. Clique em **Publicar**, confira a prévia e marque a autorização.

O aplicativo grava o identificador e o link retornados. Testes automatizados não publicam nada na sua conta. Se ocorrer timeout ou resultado incerto, confira seu LinkedIn antes de recuperar o rascunho. O aplicativo não repete a publicação automaticamente.

### Agendar

Escolha **Agendar**, defina horário e confirme. Horários da interface seguem o fuso do navegador; o banco guarda UTC.

O processo Python deve permanecer ativo, com rede e LinkedIn conectado. Os tokens de GitHub/LinkedIn ficam na memória, portanto reiniciar exige reconectar. A fila permanece no SQLite. Se quiser evitar uma publicação pendente ao reconectar, cancele o agendamento antes de conectar.

### Importar experiências

O login padrão não dá acesso ao histórico profissional completo. Use **Importar texto**, cole o conteúdo do seu perfil e revise/divida os dados em evidências. Essa importação não extrai texto de PDFs automaticamente. Você pode copiar o texto de um PDF por fora do aplicativo e colá-lo.

Referências: [Share on LinkedIn](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin), [login OIDC](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2), [OAuth](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow).

## Ollama opcional

1. Instale pela [fonte oficial](https://ollama.com/download).
2. Escolha e baixe um modelo conforme a capacidade do seu computador, usando a documentação do Ollama. O aplicativo não baixa modelos automaticamente.
3. Confira o nome com `ollama list`.
4. Defina `OLLAMA_MODEL=nome-exato-do-modelo` no `.env`.
5. Mantenha o Ollama funcionando na porta padrão `11434`, reinicie o Auto-linkedim e selecione Ollama como provedor.

Somente o serviço local `http://127.0.0.1:11434` é usado para esse provedor. Se falhar, a interface apresenta o erro em vez de mudar de provedor silenciosamente.

Referência: [API Ollama](https://docs.ollama.com/api).
