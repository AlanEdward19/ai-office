# Personagem e movimento verification

**Verdict**: PASS
**Profile**: light
**Diff range**: HEAD `6efe1f6` → árvore local, incluindo três arquivos novos; sem commit por regra do AGENTS.md.
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | Roupa, pele e cabelo atualizam o personagem | Inspeção completa do wiring local | `src/components/office/character-creator.tsx:31` — `onChange({ ...appearance, [key]: event.target.value })`; `src/components/office/office-app.tsx:830` — `onChange={setAppearance}`; `src/components/office/office-canvas.tsx:47` e `src/components/office/office-scene.tsx:115` repassam appearance; `src/components/office/player.tsx:224`, `:228`, `:233` usam shirt, skin, hair nos materiais | PASS |
| C2 | Corpo mantém 0.24 unidades, inclusive dt=1 | `scripts/test.sh` exit 0; named test `solid obstacles stop walking without tunneling` executou | `src/domain/visual-office.test.ts:11` — dt=1; `:12` — `assert.ok(result.pose.z >= obstacle.maxZ + PLAYER_RADIUS)`; `src/domain/walker.ts:12` — `PLAYER_RADIUS = 0.24` | PASS |
| C3 | Movimento desliza no eixo livre | `scripts/test.sh` exit 0; named test `walking slides along a solid edge` executou | `src/domain/visual-office.test.ts:17` — `assert.ok(result.pose.x > 0.7)`; `:18` — `assert.ok(result.pose.z >= 1.24)` | PASS |
| C4 | Destino bloqueado é cancelado | `scripts/test.sh` exit 0; named test `blocked click target is cancelled` executou | `src/domain/visual-office.test.ts:22` — `assert.equal(result.target, null)`; `:23` — `assert.ok(result.pose.z >= 1.24)` | PASS |
| C5 | Deslocamento anima membros; repouso respira | `scripts/test.sh` exit 0; named test `gait stops limbs at rest and alternates them while moving` executou; consumo inspecionado | `src/domain/visual-office.test.ts:27` — `assert.equal(idle.left, 0)`; `:28` — bob limitado a 0.008; `:31` — `assert.equal(walking.right, -walking.left)`; `src/domain/character.ts:6` — bob parado é seno; `src/components/office/player.tsx:175` mede deslocamento real e `:178`–`:182` aplicam bob e rotações | PASS |
| C6 | Criador aberto bloqueia caminhada e E | Inspeção do input e propagação enabled | `src/components/office/office-app.tsx:647` — guard inclui `characterOpen`; `:712` — walking exige `!characterOpen`; `:726` passa enabled; `src/components/office/player.tsx:162`–`:168` zeram comandos e destino quando desabilitado | PASS |

## Wiring e Swept existing

- Obstáculos da cena: `src/components/office/office-scene.tsx:54`–`:64` percorrem meshes no grupo do ambiente, extraem Box3 em coordenadas mundiais e descartam chão/teto; `:116` passa o RefObject para OfficePlayer. O personagem fica fora desse grupo. `src/components/office/player.tsx:171` lê obstacles.current dentro de useFrame e entrega os sólidos a integrateWalk. Alteração de wiring revisada após correção do lint; provas completas repetidas com 46/46 passando.
- Autorização existente confirmada em `src/components/office/office-app.tsx:647`: interação exige session; o botão do criador exige session em `:829`.
- Observabilidade existente confirmada em `src/components/office/office-app.tsx:742`–`:745`: pose tem data-testid e coordenadas.
- Nenhuma finding de implementação encontrada nos checks C1–C6.

## Limitações e nível

Profile light: sem recomputação independente da tabela Coverage e sem faults injected. Não existe seção Test policy no checks.md.
As provas C2–C5 são de domínio, com um sólido retangular e tempos selecionados; não exercitam automaticamente cada móvel ou transição de andar.
C1/C6 foram inspecionados em código conforme checks.md, sem interação real de browser. Aparência no WebGL, seletor nativo de cor, foco/fechamento do diálogo, composição visual, cores, espaçamento e fluidez percebida não foram observados nesta verificação. O percurso humano da UI permanece não realizado.

Observação adicional do autor, não executada pelo Verifier: abriu o criador no browser, selecionou cor `#256f85` e penteado `bob`, fechou e observou o personagem correspondente; reabriu e confirmou seleções mantidas. Screenshot informado: `/tmp/ai-office-character.jpg`. Essa observação não cobre bloqueio de E/caminhada nem colisão na UI.

## Gate

`scripts/test.sh` — 46 passed, 0 failed, 0 skipped; os quatro testes nomeados C2–C5 aparecem individualmente no resultado. Primeira tentativa falhou antes dos testes por EPERM no pipe IPC do tsx; execução autorizada fora do sandbox passou.
`scripts/verify.sh --webpack` — exit 0 informado pelo orquestrador; build e lint passaram, 46/46 testes passaram e o log `/tmp/ai-office-webpack-verify.log` termina com `verify: OK`. O Verifier conferiu esse encerramento. Webpack foi utilizado porque Turbopack encontrou EPERM ao tentar bind no ambiente restrito.
`python3 /Users/aoliveira/.codex/skills/tlc-spec-lean/scripts/validate_verification.py visual-office` — exit 0, 0 errors, 0 warnings.
