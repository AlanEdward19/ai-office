# Personagem e movimento

## Problem
O visitante aparece como cápsula sem identidade e atravessa os móveis. Não há evidência quantitativa; o pedido é melhorar a experiência visual.

## Flow
Reutiliza OfficeApp, OfficeScene e integrateWalk (existentes).
- OfficeApp (exists): opções de aparência → OfficeCanvas (exists) → OfficePlayer (exists).
- OfficeScene (exists): geometria dos objetos → obstáculos → integrateWalk (exists).
- OfficePlayer (exists): deslocamento real → animação de braços, pernas e respiração.

## Impact
| Front | What changes |
| --- | --- |
| visual | Personagem articulado com roupa, pele e cabelo configuráveis |
| movimento | Objetos sólidos bloqueiam o corpo; movimento desliza pelas bordas |

## Relations
None - aparência somente em memória nesta aba, sem persistência nova.

## Surface
None - nenhuma rota ou contrato externo muda.

## Landing
None - sem dependências novas, dados persistidos ou contratos externos.

## Criteria
1. WHEN uma opção é selecionada THEN o personagem SHALL usar a aparência escolhida imediatamente.
2. WHEN o corpo encontra um obstáculo THEN o movimento SHALL manter distância de 0.24 unidades do retângulo sólido.
3. WHEN o visitante caminha diagonalmente junto a um obstáculo THEN o movimento SHALL deslizar no eixo livre.
4. IF o destino clicado fica bloqueado THEN o movimento SHALL cancelar o destino ao parar.
5. WHILE o corpo está se deslocando o personagem SHALL alternar braços e pernas; parado SHALL respirar sem caminhar.
6. WHILE o criador está aberto o visitante SHALL ficar parado e interações de E SHALL estar bloqueadas.

## Out of scope
| Excluded | Why |
| --- | --- |
| Física dinâmica, saltos e pathfinding | Primeira versão usa sólidos estáticos e movimento existente |
| Avatar compartilhado e persistência | Personalização local nesta aba |

## Assumptions
| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Estilo | humano estilizado com geometria simples | combina com a cena existente | n |

Open questions: none - usuário autorizou seguir com as três melhorias.

## Observable
| Surface | Decision | Landing |
| --- | --- | --- |
| criador | seletores de roupa, pele e cabelo, preview imediato | AC 1 |
| criador | fechar por Escape e botão | existing - Dialog Radix existente |
| criador | sem carregamento ou rede | n/a - estado local síncrono |
| movimento | animação e bloqueio de input no diálogo | AC 5, AC 6 |

## Sources
- Pedido do usuário: criador de personagem, colisão nos objetos, animações simples.
- rules/implementation.md e rules/tests.md.
