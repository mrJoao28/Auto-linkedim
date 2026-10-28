# Usar o ChatGPT Plus no Auto-linkedim

O projeto implementa **Sign in with ChatGPT para aplicativos OSS locais**. A autorização é iniciada no computador onde o Auto-linkedim está rodando. Não reutiliza a sessão desta conversa, não importa cookies e não lê credenciais de outros aplicativos.

## Conectar

1. Instale as dependências de `requirements.txt` e execute `app.py`.
2. Use `http://127.0.0.1:8765`, não um domínio público da prévia.
3. Abra Configurações e clique em **Continue with ChatGPT**.
4. Na OpenAI, escolha a conta/workspace e autorize o uso do plano. Na primeira vez, o agente terá o nome sugerido Auto-linkedim.
5. Após retornar, carregue os modelos da conta e selecione um.
6. Salve ChatGPT como provedor de geração.

O uso é elegível conforme as condições da OpenAI e consome seus limites existentes. Conectar um aplicativo não cria uma franquia extra. O projeto não muda para cobrança por API key se o plano ficar indisponível.

## O que é enviado

Para criar um post, são enviados título, descrição, habilidades e link da evidência escolhida. Para sugerir um resumo, são enviados o cargo, requisitos e as evidências incluídas na versão do currículo. Não é enviado o banco inteiro, nem o histórico completo de candidaturas.

As respostas são rascunhos. Confira fatos, métricas, autoria, tempo de experiência e nível de domínio antes de salvar ou publicar. A pontuação não depende do modelo e não é alterada pela geração de um texto.

## Implementação

- Registro dinâmico com `dynamic_agent_client`, nome real do aplicativo e identificador persistente do host.
- Código de autorização com PKCE S256, state de uso único, nonce e cookie de vínculo ao navegador.
- Callback em loopback; troca com o client ID emitido, nunca com o identificador de entrada do registro.
- Validação criptográfica do ID token com PyJWT e JWKS publicado pela OpenAI; valida issuer, audience, expiração, nonce e subject.
- Verificação do escopo específico de uso do plano antes de qualquer inferência.
- Catálogo de modelos consultado com a própria credencial autorizada.
- Uso da Responses API pública com `store:false`, `stream:true` e contexto em array.
- Resposta aceita somente depois de `response.completed`; falhas tardias e streams interrompidos descartam o texto parcial.
- Tokens de acesso/renovação guardados somente no backend local, em arquivo fora do Git e dos backups de carreira. Escrita atômica, modo `0600` em sistemas Unix; no Windows, a proteção também depende das permissões da sua conta/pasta.
- Refresh token rotacionado junto com os outros campos. Se falhar, reconecte.

O aplicativo mantém uma conta ChatGPT ativa por vez. Desconectar remove a credencial local; para revogar na OpenAI, use a seção de conexões/uso das configurações do ChatGPT. Não inclui gerenciador de múltiplos workspaces simultâneos.

## Se não funcionar

- **Dependência ausente:** execute a instalação de `requirements.txt` usando o mesmo Python/ambiente usado para iniciar o aplicativo.
- **Callback não abre:** o processo precisa continuar rodando no mesmo computador e porta do início do login. Inicie uma nova conexão.
- **Conta ou plano sem autorização:** confirme que autorizou o uso do plano, além da identidade. A elegibilidade é definida pela OpenAI.
- **Nenhum modelo:** clique em Carregar modelos; o catálogo é específico da conta.
- **Limite atingido:** confira Uso nas configurações do ChatGPT; aguarde a renovação do limite ou escolha o modo sem IA/Ollama.
- **Credencial expirada:** tente novamente; o aplicativo renova quando permitido. Se continuar falhando, desconecte e conecte.
- **Troca de conta:** desconecte antes de iniciar o login com outra conta.

Validação nesta entrega: testes locais com respostas simuladas e assinaturas criptográficas geradas nos testes. O login real e a geração pelo seu Plus não foram executados na sua conta durante o desenvolvimento. Não há promessa de disponibilidade irrestrita.

## Referências oficiais

- [Visão geral](https://developers.openai.com/siwc/token-sharing-open-source)
- [Registro e login](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)
- [Modelos e inferência](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference)
- [Limitações](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)
- [Usar seu plano em outros aplicativos](https://learn.chatgpt.com/docs/sign-in-with-chatgpt)
