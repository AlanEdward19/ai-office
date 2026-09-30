# Escritório social verification

**Verdict**: PASS
**Profile**: light
**Diff range**: 6efe1f6d5839b8a6f90256d209263b198bf487ed..working tree (tracked diff e arquivos novos)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Sem commits por instrução AGENTS.md; verificação aplicada à árvore local final.

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | Prévia e cena usam Avatar | inspeção + `scripts/verify.sh --webpack` exit 0 | `src/components/office/character-preview.tsx:10` `<Avatar appearance={appearance} preview />`; `src/components/office/player.tsx:228` `<Avatar appearance={appearance} motion={motion} />` | PASS |
| C2 | 6 penteados, 4 roupas, 4 acessórios com controles e render | inspeção + gate exit 0 | `src/domain/character.ts:1` enumerações 6/4/4; `src/components/office/character-creator.tsx:53`–55 controles das três listas; `src/components/office/avatar.tsx:43` roupa; `src/components/office/avatar.tsx:63` cabelo; `src/components/office/avatar.tsx:70` acessórios (none por ausência de detalhe; tee pela manga curta em avatar.tsx:83) | PASS |
| C3 | Duas câmeras com interpolação | inspeção + gate exit 0 | `src/components/office/office-hud.tsx:20` ação com dois nomes; `src/components/office/office-app.tsx:836` alterna social/follow; `src/components/office/player.tsx:197` dois alvos; `src/components/office/player.tsx:205` `camera.position.lerp(..., 1 - Math.exp(-7 * Math.min(dt, 0.1)))` | PASS |
| C4 | Ambos gestos terminam aos 3 segundos | `scripts/test.sh` exit 0, teste social gestures expire after three seconds executado | `src/domain/visual-office.test.ts:39` `assert.equal(activeGesture(gesture, 3), null)` para wave e dance; `src/components/office/avatar.tsx:22` chama activeGesture com tempo decorrido | PASS |
| C5 | Transição de caminhada suave | `scripts/test.sh` exit 0, teste animation blend is bounded and frame-rate independent executado | `src/domain/visual-office.test.ts:47` `assert.ok(Math.abs(one - two) < 1e-10)`; linha 48 verifica retorno; `src/components/office/avatar.tsx:21` usa blendMotion em cada frame | PASS |
| C6 | Colisão, bloqueio de input e interações preservados | `scripts/test.sh` exit 0 e inspeção | `src/domain/visual-office.test.ts:12` `assert.ok(result.pose.z >= obstacle.maxZ + PLAYER_RADIUS)`; linha 22 cancela destino bloqueado; `src/domain/walker.test.ts:62` `assert.equal(nearestTarget(desk.x, desk.z, targets)?.id, "desk-1")`; `src/components/office/office-app.tsx:716` bloqueio por modais; `src/components/office/player.tsx:178` destino só com enabled; `src/components/office/office-scene.tsx:64` coleta sólidos | PASS |

## Swept existing

- Colisão por substeps: `src/domain/walker.ts:132` passo máximo 0.02; linhas 157–165 expansão por PLAYER_RADIUS e deslizamento por eixo.
- Autorização: `src/components/office/office-app.tsx:651` exige sessão e bloqueia modais; linhas 665–668 exigem host para contratar/recepção.
- Observabilidade: `src/components/office/office-app.tsx:749` pose em data-testid com posição e yaw.
- abortableSleep: `src/server/abortable-sleep.ts:3` mantém implementação; observe, codex-follow e claude-follow importam esse módulo. Busca global não encontrou caller do export antigo da rota.

## Limitations

Profile light: sem recomputação independente de Coverage e sem faults injected.
UI verificada por inspeção e compilação, sem sessão WebGL operada pelo Verifier: seleção de categorias/presets, OrbitControls no preview, zoom, transição das duas câmeras, click-to-walk, colisão real com geometria arredondada e expiração visual dos gestos não tiveram prova de browser. Testes de domínio cobrem tempo/blend/colisões matemáticas, não ligação de eventos e geometria runtime. Em preview/cena, espaçamento, cores, peso tipográfico, enquadramento e aparência dos detalhes dependem de avaliação visual humana. Nenhum bug concreto identificado na inspeção.

## Gate

`scripts/test.sh` exit 0 — 48 passed, 0 failed, 0 skipped; output `/tmp/social-independent-tests.log`.
`scripts/verify.sh --webpack` exit 0 — build Next.js 16.3.7/TypeScript, lint e 48 testes passaram; output `/tmp/social-independent-gate.log`, terminando em `verify: OK`.
Os nomes C4/C5 e os três novos testes de colisão aparecem individualmente no output.
