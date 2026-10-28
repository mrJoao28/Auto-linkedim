# Operação e desenvolvimento

## Arquitetura

O aplicativo usa Python 3.11+, servidor HTTP de loopback e SQLite. O frontend usa HTML, CSS e JavaScript sem framework, CDN, fonte externa ou etapa de build. A única dependência Python externa é PyJWT com suporte criptográfico, necessária para validar o login ChatGPT.

| Caminho | Responsabilidade |
| --- | --- |
| `app.py` | Rotas locais, validação, CSRF, configuração e inicialização. |
| `carreira/scoring.py` | Requisitos, normalização, pontuação e seleção. |
| `carreira/storage.py` | SQLite, snapshots, arquivos e backup transacional. |
| `carreira/resume.py` | Documento HTML A4 e impressão em PDF. |
| `carreira/chatgpt.py` | OAuth oficial, identidade, modelos e inferência pelo plano. |
| `carreira/integrations.py` | OAuth GitHub/LinkedIn, importação e publicação. |
| `carreira/scheduler.py` | Fila local e proteção contra duplicação de publicação. |
| `web/` | Interface e interações. |
| `tests/` | Testes locais sem postagem ou inferência real. |

## Persistência

- `data/carreira.sqlite3`: perfil, vagas, currículos, PDFs originais e posts.
- `data/chatgpt-host.json`: ID opaco desta instalação.
- `data/chatgpt-session.json`: credencial ChatGPT, quando conectada.
- `data/settings.json`: provedor de IA escolhido.
- `.env`: Client IDs, Client Secrets opcionais e modelo Ollama.
- `backups/`: cópias de segurança anteriores às restaurações pela interface.

Esses caminhos são ignorados pelo Git. Os dados de carreira não são criptografados em repouso pelo aplicativo. A proteção depende da sua conta no computador e da proteção do disco/pasta. O aplicativo é pessoal e não é um serviço de múltiplos usuários.

GitHub e LinkedIn mantêm tokens somente na memória do processo. A credencial ChatGPT é persistida para permitir renovação conforme o contrato oficial; nunca é devolvida ao frontend nem exportada no backup.

## Backup

Use Configurações → Exportar backup para um JSON com os dados de carreira e PDFs. O limite de restauração pela interface é 100 MB. A restauração cria antes uma cópia do estado atual, aplica os dados em transação e suspende os agendamentos restaurados para revisão.

Para um arquivo maior, encerre o aplicativo e copie `data/carreira.sqlite3` para um local privado. Para restaurar essa cópia, encerre o aplicativo, preserve o banco atual e coloque a cópia no mesmo caminho. Não substitua um banco enquanto o processo está escrevendo.

Não publique backups em repositórios públicos: contêm currículo e histórico de candidaturas. Para transferir apenas os dados de carreira para outro computador, use o JSON ou banco, e reconecte as contas na instalação de destino.

## Segurança da aplicação local

- Por padrão, escuta somente em `127.0.0.1`.
- Valida Host e origem das mutações; usa token anti-CSRF e não libera CORS.
- Retorna dados com `Cache-Control: no-store`, `nosniff`, política de referrer e bloqueio de framing.
- Escapa texto pessoal no HTML do currículo e nos templates do frontend.
- Estado OAuth de uso único e cookie de vínculo ao navegador; Client Secrets ficam no backend.
- Erros de serviços externos são reduzidos a mensagens sem tokens, e callbacks OAuth não são registrados em logs.
- A publicação é reivindicada em transação antes da chamada externa. Resultado incerto exige revisão manual antes de nova tentativa.

Não exponha a porta diretamente à internet. O modo de prévia gerenciada é separado e bloqueia a conexão ChatGPT; ele existe para QA, não como configuração de hospedagem pública.

## Porta alternativa

```powershell
.\.venv\Scripts\python.exe app.py --port 8766
```

Use `http://127.0.0.1:8766` e ajuste os callbacks dos aplicativos GitHub/LinkedIn para a mesma porta antes de conectar. O login ChatGPT mantém o mesmo caminho de callback e usa a porta do processo.

## Testes

No Windows:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

No macOS/Linux:

```bash
.venv/bin/python -m unittest discover -s tests -v
```

Os testes usam bancos temporários e serviços simulados. Verificam efeitos importantes: cálculo ponderado, correspondências indevidas, bloqueio de dados não confirmados, snapshots imutáveis, rollback de restauração, arquivos originais, CSRF/Host, assinatura JWT/nonce/audience, escopo do plano, renovação de tokens e conclusão de streams antes de aceitar texto.

A validação de navegador usou dados fictícios para cadastrar perfil, evidência, vaga, análise, versões do currículo e rascunho. Esses dados não fazem parte do repositório. Login real, inferência pelo Plus e publicação real exigem suas contas/configurações locais e não foram executados durante essa validação.

## Atualizar

Encerre o aplicativo, faça backup e então execute:

```powershell
git pull origin main
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```

As tabelas são criadas se não existirem, sem apagar dados existentes.
