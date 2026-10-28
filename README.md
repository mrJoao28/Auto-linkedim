# Auto-linkedim

Aplicativo pessoal para preparar currículos por vaga, acompanhar candidaturas e organizar publicações no LinkedIn. Interface dark, dados locais em SQLite e pontuação calculada por algoritmo, sem pagar por análise.

## O que está implementado

- Perfil com formação, experiências, projetos, habilidades, idiomas e links.
- Importação de repositórios públicos do GitHub, com ou sem login. Os projetos importados ficam pendentes de confirmação.
- Importação manual do texto do LinkedIn. O login padrão do LinkedIn **não fornece o histórico profissional completo**.
- Cadastro da descrição original de cada vaga e sugestões de requisitos por regras.
- Edição de requisitos, pesos e condições eliminatórias.
- Pontuação explicável com a evidência usada em cada requisito.
- Geração determinística de currículos com seleção de experiências relevantes.
- Currículos imutáveis por versão, nova versão com resumo/seleção editáveis e exportação pelo diálogo de impressão em PDF.
- Arquivamento do PDF original de currículos já enviados, vinculado à vaga.
- Registro do currículo enviado, situação da candidatura, datas e anotações.
- Rascunhos de posts por modelo de texto, ChatGPT autorizado ou Ollama local.
- Sugestão de resumo profissional por IA, sujeita à revisão antes de criar uma nova versão.
- Login oficial do ChatGPT para uso do plano elegível em aplicativo local de código aberto, com PKCE, validação de ID token, renovação de credenciais e escolha dos modelos da conta.
- OAuth do GitHub e LinkedIn, publicação oficial de posts de texto e agendamento local.
- Backup/restauração do perfil e histórico, incluindo PDFs originais. Tokens não são exportados.
- Testes de algoritmo, API local, arquivos, snapshots, OAuth, streams e agendamento.

## Começar no Windows

Instale [Python 3.11 ou superior](https://www.python.org/downloads/) e [Git](https://git-scm.com/downloads). No PowerShell:

```powershell
git clone https://github.com/mrJoao28/Auto-linkedim.git
cd Auto-linkedim
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```

Abra **http://127.0.0.1:8765**. Mantenha esse terminal aberto enquanto usa o aplicativo. Não precisa ativar o ambiente virtual, instalar Node.js, configurar Docker ou contratar banco de dados.

Se `py` não existir, use `python` no comando de criação do ambiente. Para encerrar, pressione `Ctrl+C`. Nas próximas vezes:

```powershell
cd caminho\para\Auto-linkedim
.\.venv\Scripts\python.exe app.py
```

## macOS / Linux

```bash
git clone https://github.com/mrJoao28/Auto-linkedim.git
cd Auto-linkedim
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python app.py
```

Abra **http://127.0.0.1:8765**. Em algumas distribuições Linux é necessário instalar o pacote `python3-venv` pelo gerenciador da distribuição.

## Primeiro uso

1. Em **Meu perfil**, preencha seus dados e clique em **Salvar perfil**.
2. Adicione evidências: projetos, empregos, cursos, formação e idiomas. Descreva sua participação e confirme apenas fatos reais.
3. Em **Configurações**, importe seu GitHub público pelo nome de usuário. Revise cada projeto, acrescente habilidades utilizadas e confirme.
4. Adicione uma vaga com a descrição completa. Use **Identificar sugestões**, revise todos os requisitos e acrescente os que faltarem.
5. Em **Salvar e analisar**, confira a nota, as evidências e os eliminatórios pendentes.
6. Gere o currículo. Em **Currículos**, abra **PDF**, revise o documento e escolha **Imprimir / salvar em PDF**.
7. Se precisar ajustar o resumo ou as evidências, escolha **Nova versão**. O documento anterior não será alterado.
8. Após se candidatar por fora do aplicativo, registre o envio da versão correspondente.
9. Para documentos enviados anteriormente, use **Arquivar PDF** e selecione a vaga. Limite de 5 MB por arquivo.

## Usar o plano ChatGPT Plus

1. Execute o aplicativo no seu próprio computador e acesse o endereço `127.0.0.1` acima.
2. Abra **Configurações → Seu plano ChatGPT → Continue with ChatGPT**.
3. Faça login na OpenAI e autorize o uso do plano para **Auto-linkedim**.
4. De volta ao aplicativo, clique em **Carregar modelos**, escolha um disponível e clique em **Selecionar modelo**.
5. Em **Como gerar os textos**, selecione **ChatGPT — usa meu plano autorizado** e salve.

Essa integração usa o fluxo oficial de [uso do plano em aplicativos OSS locais](https://developers.openai.com/siwc/token-sharing-open-source). Não cria API key e não configura cobrança por uma API key separada. O uso consome os limites existentes da assinatura e depende de elegibilidade, disponibilidade e modelos retornados pela conta. A integração está implementada e testada com respostas simuladas; o login e a inferência reais precisam ser confirmados na sua conta.

Se a OpenAI recusar o uso do plano ou o limite acabar, o aplicativo mostra o erro. **Não muda silenciosamente para uma API paga.** Você pode selecionar o modo sem IA ou configurar o Ollama.

## LinkedIn e GitHub por login

O funcionamento básico não exige credenciais. Para conectar as contas, crie seus aplicativos de desenvolvedor, copie `.env.example` para `.env` e preencha as credenciais **somente no computador local**.

O passo a passo, os callbacks e as permissões estão em [docs/INTEGRACOES.md](docs/INTEGRACOES.md).

A publicação exige os produtos/permissões do LinkedIn correspondentes e a autorização da sua conta. O aplicativo não cria esses acessos por você e não promete que o LinkedIn aprovará sua configuração. O suporte implementado é para **posts de texto no perfil pessoal**, não páginas empresariais, imagens, vídeos, comentários automáticos ou métricas de engajamento.

## O que é gratuito

| Recurso | Como funciona |
| --- | --- |
| Pontuação | Algoritmo local, sem IA e sem custo por análise. |
| Geração básica do currículo | Seleção e organização local de fatos confirmados. |
| Histórico e PDFs | SQLite no computador. |
| Rascunho sem IA | Modelo de texto determinístico. |
| ChatGPT | Usa o plano que você autorizou, sujeito aos limites da assinatura. |
| Ollama | Modelo no computador; sem cobrança de API, com consumo dos recursos locais. |
| Publicar no LinkedIn | Chamada à API oficial após configurar o aplicativo e autorizar. Sem serviço de agendamento contratado pelo projeto. |

## Como a nota funciona

```text
nota = 100 × soma(peso × atendimento) / soma(pesos)

1,0 = habilidade/requisito explicitamente confirmado por você
0,5 = menção no conteúdo de uma evidência confirmada
0,0 = sem evidência ou informação ainda não confirmada
```

Sem requisitos, a nota fica indefinida. Repetir palavras não aumenta a nota. Requisitos equivalentes são deduplicados. Anos de experiência, nível de idioma e frases complexas exigem revisão explícita.

A nota é uma aproximação definida pelo aplicativo. **Não é a nota interna de um ATS nem uma probabilidade de contratação.** A seleção automática usa uma heurística de cobertura e não garante um ótimo matemático global. Veja [docs/ALGORITMO.md](docs/ALGORITMO.md).

## Agendamento e dados

O agendador verifica a fila a cada 10 segundos. Para publicar, o processo Python precisa estar rodando e o LinkedIn precisa estar conectado. O computador pode ficar com o navegador fechado, mas não com o processo encerrado, desligado ou suspenso.

Se um post atrasar até uma hora, ele pode ser retomado após reconectar. Depois de uma hora, volta para rascunho. Resultados incertos ficam em **Verifique no LinkedIn** e nunca são repetidos automaticamente.

Ao restaurar um backup, agendamentos voltam para rascunho para você revisar. O JSON de restauração tem limite de 100 MB; para acervos maiores, copie o banco com o processo encerrado, conforme [docs/OPERACAO.md](docs/OPERACAO.md).

## Desenvolvimento e verificação

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

```bash
.venv/bin/python -m unittest discover -s tests -v
```

Se tiver Node.js, também pode verificar a sintaxe do frontend com `node --check web/app.js`. Node não é necessário para usar o aplicativo.

O `npm run dev` e `scripts/preview.py` são adaptadores da prévia de desenvolvimento gerenciada; para uso local, execute `app.py`.

Estrutura, persistência, procedimentos de backup e limitações de segurança estão em [docs/OPERACAO.md](docs/OPERACAO.md). Instruções adicionais do login ChatGPT estão em [docs/CHATGPT.md](docs/CHATGPT.md).

Licença [MIT](LICENSE).
