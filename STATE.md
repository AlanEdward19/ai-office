# STATE.md

Fonte única de handoff entre skills (`agentic-delivery`, harness, spec, loop).

## Decisões (AD)
| ID | Resumo |
|---|---|
| AD-001 | Bootstrap agente: `AGENTS.md`, `rules/`, `scripts/`, `docs/`, `HARNESS.md` (2026-09-30) |
| AD-002 | Spec routing: `tlc-discover` / `tlc-spec-lean` / `tlc-spec-driven` via Princípio 9 em `agentic-delivery` |

## Handoff
- **Última fase concluída**: project-bootstrap (via agentic-delivery)
- **Artefatos**: `AGENTS.md`, `rules/*`, `scripts/*`, `docs/**`, `HARNESS.md`, `docs/adr/ADR-0001-domain-session-model.md`
- **Eval gates disponíveis**: `scripts/verify.sh`
- **Próximo passo sugerido**: skill `harness-engineering` se quiser sensores/guias além do verify; features novas → `agentic-delivery` → spec (Lean/Driven)

## PM tool
Linear (API key local). Org/tags: confirmar com `pm-handoff` quando for criar cards.

## Visual office (2026-09-30)
- Aparência local de personagem, membros animados e colisão por limites da geometria renderizada.
- Artefatos: `.specs/features/visual-office/{plan,checks,verification}.md`.
- Gate: `scripts/verify.sh --webpack` = 0; build, lint e 46 testes.
- Turbopack original falhou por bind interno bloqueado; scripts aceitam argumentos opcionais.
- Verifier independente: PASS light; UI também inspecionada no navegador pelo autor.
- Sem commit. Aparência dura nesta aba; clique bloqueado para, sem pathfinding.

## Escritório social (2026-09-30)
- Direção visual: 3D suave com câmera social elevada padrão; câmera próxima e zoom.
- Avatar compartilhado cena/preview: 6 penteados, 4 roupas, 4 acessórios; paletas e looks prontos.
- Cenário: lounge, café, mesas equipadas, plantas, móveis arredondados e paredes baixas.
- UX: dock, minimapa, ajuda; gestos acenar/dançar por 3 segundos; caminhada com blend suave.
- Auxiliar abortableSleep movido da rota observe para server, corrigindo export inválido detectado pelo Next.
- Artefatos: `.specs/features/social-office/{plan,checks,verification}.md`.
- Gates: `scripts/verify.sh --webpack` = 0, build/lint/48 testes; Verifier independente PASS light.
- Autor confirmou no browser: look Creative, fones, deslocamento por clique, troca das duas câmeras e acionamento de gestos.
- Capturas: `/tmp/ai-office-social-avatar.jpg`, `/tmp/ai-office-social-scene.jpg`.
- Sem commit. Multiplayer com avatares remotos, voz por proximidade e editor de mapas fora desta fatia visual.

## Correção de orientação (2026-09-30)
- Corrigido sinal da rotação visual: yaw do walker aponta +X, rotação Three do modelo frontal -Z requer -yaw.
- OfficePlayer usa avatarRotation; teste de regressão cobre giros de mouse e W em cinco direções.
- Gate `scripts/verify.sh --webpack` = 0: build, lint e 49 testes. Sem commit.

## Modos de câmera (2026-09-30)
- Botões independentes: 1ª pessoa, 3ª pessoa e Isométrica (usuário esclareceu que topdown significava a vista social inclinada).
- Primeira pessoa oculta avatar local e segue olhos; terceira acompanha atrás; isométrica usa diagonal com movimento relativo à câmera.
- Gate `scripts/verify.sh --webpack` = 0: build, lint e 52 testes. Sem commit.

## 2026-09-30 — interação completa e acabamento
- Mesa agora abre painel (E/botão); entrada de sala alcançável por fora da colisão.
- Painel de agente com atividade, conversa privada, cards, renomear e contratação. Todos providers podem receber cards; CLI usa sessão própria retomável, Cursor cloud vinculado.
- Revisão independente detectou e corrigiu cancel Cursor inicial, troca de cloud agent e corrida de processo interrompido.
- Teto interno com BackSide/vigas/luzes, relógio real Date, fuso IANA validado do anfitrião compartilhado sem transcript; labels de hora/conversão nos agentes locais, sem label no próprio avatar.
- Layout responsivo: dock/câmera separados, chamada recolhível, alvos 40–44px, painéis/dialog com rolagem e quadro fluido.
- Preview conferido 1280x720 e 360x800; criador mobile rola. Sem envio real a provedores/Linear durante testes.
- Gate final: scripts/verify.sh --webpack PASS (build/lint/60 testes), git diff --check limpo. Arquivos sem commit.

## 2026-09-30 — paredes nas três câmeras
- Paredes opacas com 3,2 m no lobby, RH, salas, ala local e perímetro; rodapés e passagens mantidos.
- Isométrica oculta todo teto/vigas e usa corte de 1,1 m nas paredes voltadas à câmera; demais paredes mantêm altura.
- 3ª pessoa usa raycast nas paredes para aproximar a câmera antes da obstrução; personagem mantém colisões do mobiliário/paredes.
- Gate scripts/verify.sh --webpack PASS (60 testes), servidor localhost responde HTTP 200.
- Conferência visual revelou obstrução na 3ª pessoa e motivou raycast. Rechecagem final do browser ficou limitada por timeouts CDP, sem evidência visual final.

## 2026-09-30 — carregamento, elevador e áreas vazias
- Reiniciado preview dev (npm run dev -- --webpack). Imports Drei agora diretos por componente; carregamento dinâmico tem limite 20s e erro visível/recarregar em SceneBoundary.
- Cena sai de Abrindo o andar em aba limpa; conferida visualmente nas três câmeras. Aba original antiga ainda apresentou timeout de controle; preview novo carregou normalmente.
- Elevador gira -PI/2 para a porta apontar ao oeste, consistente com entrada/interação/arrivalPose.
- Vagas visuais de projeto recebem áreas comuns mobiliadas (biblioteca/foco/convivência) e são liberadas quando projeto real ocupa slot; RH ganha espera/biblioteca/formação/entrevistas.
- Etiquetas 3D respeitam oclusão de paredes em vez de aparecer por trás.
- Gate final PASS: scripts/verify.sh --webpack, build/lint/62 testes. Sem commit e sem mensagens externas de agentes.
