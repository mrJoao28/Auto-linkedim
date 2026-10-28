# Pontuação e geração

## Objetivo

Produzir uma comparação reproduzível entre requisitos revisados e evidências do perfil, com critérios visíveis. Não treina modelo, não chama IA e não tenta reproduzir sistemas internos de recrutamento.

## Dados

Cada requisito possui descrição, peso positivo até 100 e indicação opcional de condição eliminatória. Cada evidência possui título, tipo, contexto, habilidades e confirmação do usuário.

A normalização remove diferenças de caixa, acentos e espaços. Um vocabulário pequeno reconhece equivalências, como JS/JavaScript e Postgres/PostgreSQL. As buscas respeitam limites: Java não corresponde a JavaScript, Git não corresponde a GitHub e C não corresponde a CSS ou C++.

Uma habilidade do GitHub não é confirmada automaticamente. O idioma predominante de um repositório é apenas uma sugestão. A confirmação é uma declaração sua, não uma certificação independente de competência.

## Cálculo

Para cada requisito, o aplicativo procura a melhor evidência confirmada:

- **1:** o requisito ou uma alternativa está explicitamente entre as habilidades confirmadas.
- **0,5:** aparece no texto de uma evidência confirmada, mas não como habilidade explicitamente cadastrada.
- **0:** nada encontrado, ou os dados ainda não foram confirmados.

Evidências diferentes não se somam acima de 1 para o mesmo requisito. Repetições de palavras não contam. Requisitos equivalentes são deduplicados, mantendo o maior peso e a indicação eliminatória.

```text
nota = 100 × Σ(peso × atendimento) / Σ(peso)
```

Exemplo: Python (peso 5) e SQL (peso 5) atendidos; Docker (peso 2) ausente. Nota: `100 × 10 / 12 = 83,3`.

Se não houver requisito, retorna `null`, apresentado como travessão. Eliminatórios sem atendimento integral aparecem separadamente, mesmo com uma média alta.

## Contexto e limitações

A extração da descrição gera sugestões de tecnologias conhecidas. Não entende integralmente linguagem natural. Requisitos fora do vocabulário precisam ser acrescentados manualmente. Frases com negação, quantidade, nível ou alternativas são preservadas para revisão.

Para um requisito como “3 anos de Python”, a habilidade Python isolada não atende integralmente. Só confirme a frase completa entre as habilidades/evidências se puder sustentá-la. O sistema não calcula anos por datas nem transforma experiência acadêmica em profissional.

Alternativas simples, como “Python ou Java”, aceitam qualquer uma das duas. Frases complexas devem ser editadas para representar a condição real. Pesos e eliminatórios são definidos por você; não há pesos universais de ATS.

## Seleção para o currículo

A seleção automática é gulosa: adiciona a evidência com maior ganho de cobertura dos requisitos ainda não atendidos, até seis itens com ganho. Formação confirmada é preservada separadamente. Se não houver correspondência, mantém até três experiências/projetos como contexto, sem conceder pontos por isso.

Essa heurística não prova o máximo global nem garante uma página exata. Ela prioriza cobertura sob um limite de itens; textos longos podem produzir mais de uma página. Use Nova versão para ajustar a seleção e o resumo, depois confira a impressão.

O aplicativo mostra duas notas: compatibilidade de todo o perfil e cobertura das evidências incluídas no documento. Formatação não aumenta a compatibilidade. A IA opcional só sugere texto; não atribui a nota.

## Histórico

Cada geração salva uma cópia do perfil, da vaga, dos requisitos, das evidências selecionadas, das notas e da versão do algoritmo. Alterações posteriores no perfil não mudam snapshots anteriores. Nova versão cria outro registro. Os PDFs anexados são preservados em seus bytes originais e não recebem nota automaticamente.
