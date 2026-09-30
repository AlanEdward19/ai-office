# Escritório social
## Problem
A cena parece um conjunto de blocos e a personalização é limitada. O usuário pede design, UX e animações mais ricos, próximos de um escritório social Gather.
## Flow
Reutiliza OfficeApp, OfficePlayer e OfficeScene (existentes).
- OfficeApp (exists): dock de personagem, câmera e gestos → OfficeCanvas (exists).
- OfficePlayer (exists): movimento → avatar articulado e câmera suave.
- CharacterCreator (exists): seleção → mesma geometria 3D utilizada na cena.
- OfficeScene (exists): móveis arredondados e ambientação → colisão existente.
## Impact
| Front | What changes |
| --- | --- |
| visual | vista elevada padrão, lounge, móveis detalhados e materiais teal/madeira |
| experiência | personalização por categorias, presets, preview 3D e dock |
## Relations
None - escolhas locais nesta aba.
## Surface
None - contratos externos preservados.
## Landing
None - dependências existentes; sem persistência ou contrato externo novo.
## Criteria
1. WHEN o criador abre THEN o sistema SHALL mostrar o mesmo modelo 3D da cena.
2. WHEN o usuário personaliza THEN o avatar SHALL suportar 6 penteados, 4 roupas e 4 acessórios.
3. WHEN o usuário alterna a câmera THEN o sistema SHALL oferecer vista elevada e próxima com transição suave.
4. WHEN o usuário acena ou dança THEN o avatar SHALL executar o gesto por 3 segundos e retornar ao repouso.
5. WHILE o usuário anda o avatar SHALL suavizar a transição dos membros entre caminhada e repouso.
6. The system SHALL manter colisão e interações existentes com mobiliário detalhado.
## Out of scope
| Excluded | Why |
| --- | --- |
| Multiplayer com avatares remotos, voz por proximidade e editor de mapa | Pedido atual de design/UX; exigem fluxo e protocolo próprios |
## Assumptions
| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Direção visual | escritório social 3D suave | evolui stack e cenário atuais | n |
## Observable
| Surface | Decision | Landing |
| --- | --- | --- |
| criador | categorias, presets e preview | AC 1, AC 2 |
| dock | câmera e gestos com nomes acessíveis | AC 3, AC 4 |
| navegação | colisão e bloqueio quando modal abre | AC 6 |
## Sources
- Pedido do usuário nesta conversa.
