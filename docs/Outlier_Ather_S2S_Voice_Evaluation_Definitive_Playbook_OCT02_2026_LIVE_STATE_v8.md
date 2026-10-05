# Outlier / Ather S2S Voice Evaluation — Definitive Playbook

> **Revision:** Oct 2, 2026 — **LIVE-STATE ADAPTATION EDITION v8 — IMPROV CONTINUITY + MODE-SENSITIVE AGENT EXPORT + RATIONALE GROUNDING**. Builds on v7 and integrates a second Oct 2 QA review that found the evaluator was still following pre-planned lines when those lines contradicted the models’ actual decisions. v8 changes the core execution model from “prewrite every line, then adapt if needed” to **“plan turn functions, update live state after every model reply, then generate/speak the next line from that state.”** In Creative & Playful / improv / stateful roleplay scenarios, only the opener may be fully fixed by default; later user turns must remain adaptive. The Agent-Ready export is now **mode-sensitive** so it does not encourage stale line reading. The final rationale is also grounded strictly in the **actual conversation + Timeline evidence**, never in the pre-conversation plan or generic scenario boilerplate.

> **Purpose:** a single operational guide for comparing **Model A** vs **Model B** in Outlier / Multimango / Ather live speech-to-speech tasks, keeping conversations fair, natural, scenario-faithful, and producing strong, evidence-based final rationales.

---


# 0. OFFICIAL SOURCE HIERARCHY + LIVE ASSISTANCE STANDARD

This edition uses the following precedence whenever wording differs:

1. **Current live task UI** — exact options, labels, severities, and task-specific instructions shown in the submission.
2. **Newest explicit project/client alignment** — including the **Oct 1 Justification Quality (JQ) calibration**, Sep 30 client calibration, and Sep 25 operational clarifications supplied for this workflow.
3. **Official `Multilingual-260310-live-s2s-elo` Project Guidelines** — revision containing Sep 23 client feedback.
4. **Direct QA feedback on the evaluator’s own submissions** — apply it as a cumulative workflow correction when it does not conflict with the live UI or client guideline. A QA deduction is not permission to invent a new rubric; it is evidence that the current execution pattern must change.
5. Older webinar/community wording only when it does not conflict with the above.

> **Never invent a rating option, severity level, cluster name, turn requirement, timestamp, or quote.**

## 0.0A Sep 25 community clarification — minimum turns count ONLY user/evaluator turns

**New operational rule:**

> If a scenario references a **minimum number of turns**, count **only the evaluator/user's turns**.  
> The model's responses **do not count** toward the minimum.

This clarification overrides any older interpretation that treated every utterance, or a user+model exchange pair, as satisfying the scenario minimum.

**Example:** minimum 4 turns = 4 evaluator/user prompts, typically appearing as sequential conversation Turns **1, 3, 5, 7**.

Missing the minimum is an **auto-fail scenario-adherence error**.

## 0.1 Official final rating fields and selection options

Use the **exact options visible in the task**. The official guideline defines these standard fields:

| Dimension | Official selection pattern |
|---|---|
| **Naturalness / Engagement / Aesthetics** | Response A / Response B |
| **Utility** | Response A / Response B / Both good / Both bad |
| **Audio Quality** | Response A / Response B / Both good / Both bad |
| **Conversational Dynamics** | Response A / Response B / Tie / Skip |
| **Overall Preference** | Response A / Response B |
| **Task Success — Model A** | Pass / Partial / Fail |
| **Task Success — Model B** | Pass / Partial / Fail |
| **Error Clusters** | select only clusters genuinely present, using the taxonomy/severity shown in the live UI |

### Critical correction — Task Success

**Task Success is not a binary gate in the official guideline.** It uses:

- **Pass** — all scenario/request requirements are accomplished.
- **Partial** — some elements are clearly fulfilled, while other explicit/implicit/nested requirements are ignored or neglected.
- **Fail** — the scenario/request requirements are completely ignored or the core task is fundamentally not completed.

Judge **completion/outcome**, not response quality. Response quality belongs under Utility.

## 0.2 Turn numbering vs. minimum-turn requirement — definitive convention

There are **two different concepts**:

### A. Sequential conversation labels

For notes, quotes, rationales, and Timeline references, number every utterance:

```text
Turn 1 = user opener
Turn 2 = model response
Turn 3 = user follow-up
Turn 4 = model response
Turn 5 = user follow-up
Turn 6 = model response
...
```

### B. Scenario minimum-turn count

When a scenario specifies a **minimum number of turns**, count **ONLY evaluator/user turns**.

> **Model responses do NOT count toward the minimum.**

Example:

```text
Scenario minimum: 4 turns

Turn 1  User opener      → user count 1
Turn 2  Model response   → does not count
Turn 3  User follow-up   → user count 2
Turn 4  Model response   → does not count
Turn 5  User follow-up   → user count 3
Turn 6  Model response   → does not count
Turn 7  User follow-up   → user count 4 ✅
```

Therefore:
- minimum 3 turns = at least 3 evaluator/user utterances;
- minimum 4 turns = at least 4 evaluator/user utterances;
- minimum 5 turns = at least 5 evaluator/user utterances.

> **Failure to reach the minimum number of evaluator/user turns is an auto-fail scenario-adherence error.**

When preparing a plan:
- odd-numbered turns are evaluator/user prompts;
- even-numbered turns are model-response placeholders;
- the plan must contain enough **user prompts alone** to satisfy the scenario minimum.

## 0.3 Two-phase assistance format — mandatory presentation

### PHASE 1 — BEFORE THE CONVERSATION

When the scenario screenshots are provided, return a compact **DUAL CONVERSATION PLAN** optimized for live use.

The plan must contain:

1. **🎯 Scenario / Objective**
2. **🔢 Minimum USER turns required** — if specified, state it explicitly and ensure **both** A and B plans contain at least that many evaluator/user turns
3. **⚖️ Scenario type + Overall hierarchy**
4. **🎚️ Adaptation level** — classify the scenario before writing prompts:
   - `L0 — FIXED-SAFE`: later prompts are genuinely response-independent or the task explicitly requires fixed wording;
   - `L1 — ADAPTIVE`: opener may be fixed, later turns need a live hook into the previous response;
   - `L2 — STATEFUL IMPROV`: Creative & Playful / improv / narrative / roleplay / evolving-scene tasks; **only the opener is fully fixed by default** and later turns are generated from the live state.
5. **🧭 Shared Intent Spine** — list only the *function* of each evaluator turn, not a sentence to be copied
   - `U1 — establish scenario / opener`
   - `U2 — probe`
   - `U3 — challenge / counterpoint`
   - `U4 — correction, shift, or deeper test`
   - `U5 — stress test / close`, when scenario-valid
6. **🅰️ MODEL A — natural conversation path**
   - distinct opener / turn functions;
   - from U2 onward, react to Model A's **actual previous answer**;
   - in L2, provide **intent + possible branch/fallback**, not a mandatory sentence.
7. **🅱️ MODEL B — natural conversation path**
   - same user-turn count and equivalent burden as A;
   - **different wording, sentence structure, discourse markers, examples, and conversational angle**;
   - from U2 onward, adapt to Model B's own previous answer;
   - in L2, preserve the same function/burden without replaying A's scene.
8. **🧾 Live State Ledger** — for L1/L2, update the evolving state after every model reply before speaking again.
9. **👀 What to observe** — normally maximum 4 high-value checks
10. **⏱ Timeline View checks** — clearly separated from live listening
11. **📝 Quick Notes template** for Model A and Model B
12. **📦 Agent-Ready Block** — always last, but its contents depend on adaptation level as defined in §0.3C / §34.9.

> **v8 core rule:** **MODEL RESPONSE → UPDATE LIVE STATE → CHOOSE THE NEXT TURN FUNCTION → SPEAK A CONTEXT-COMPATIBLE LINE.** In stateful improv, the live scene outranks every prewritten sentence.

### PHASE 2 — AFTER THE USER PASTES NOTES

Return results in this order:

1. **🏆 Overall Preference**
2. **📊 Suggested Ratings**
3. **🎯 Task Success — A and B: Pass / Partial / Fail**
4. **⚠️ Error Clusters**
   - exact live label
   - severity selected in the UI when applicable
   - turn/timestamp/phrase or concrete event
   - one-line reason
   - **Rationale note:** repeating the severity word in the prose rationale is optional; the evidence and why the cluster applies are mandatory
5. **✍️ Final Rationale in English**
   - render under `###### ✍️ Final Rationale`
   - **default to the Oct 1 client JQ labeled template** (Overall Preference → relevant dimension ratings → Partial/Fail Task Success → flagged Error Clusters)
   - a concise freestyle / cohesive-paragraph rationale is still acceptable when it covers the same required evidence
   - **Tie (both good)** dimensions, **Pass** Task Success, and **unflagged Error Clusters** may be omitted or mentioned briefly
   - minimum **100 characters**
   - clear, concise, evidence-based, and verifiable
   - internally consistent with all selected ratings/clusters

### Live readability rule

During Phase 1, prioritize **glanceability over completeness**. The user should be able to find the next spoken turn immediately. Spoken lines must sound like something a real person would say, not text written to satisfy a rubric.

Use this layout:

```text
🎯 SHARED INTENT SPINE
U1 = opener / establish scenario
U2 = probe
U3 = challenge
U4 = deeper test / correction
U5 = stress test if required

🎚️ ADAPTATION LEVEL
L0 / L1 / L2

🅰️ MODEL A
A-U1 — OPENER
"[natural A wording]"

A-U2 — FOLLOW-UP
HOOK: react to [something A actually said]
L0: "[full line]"
L1/L2: NEXT MOVE: [turn function] | FALLBACK ONLY IF COMPATIBLE: "[short fallback]"

...

🅱️ MODEL B
B-U1 — OPENER
"[different natural B wording with same function]"

B-U2 — FOLLOW-UP
HOOK: react to [something B actually said]
L0: "[full line]"
L1/L2: NEXT MOVE: [equivalent turn function from B's state] | FALLBACK ONLY IF COMPATIBLE: "[different fallback]"

...
```

Do not bury spoken prompts inside explanatory prose. **For L2, do not turn this layout into a complete prewritten dialogue.**


## 0.3A Natural Human Turns — spoken-prompt style standard

The evaluator/user turns should sound like **real spontaneous speech**, not like polished text being read aloud.

### Core rule

> **Write the plan for the mouth, not for the page.**

When generating suggested turns for live S2S use, prefer short, conversational phrasing with light human markers such as:

- `ehm` / `ehmm`;
- `ok` / `okay`;
- `sai`;
- `cioè`;
- `praticamente`;
- `allora`;
- `aspetta`;
- `mmm`;
- `ci sta`;
- `insomma`;
- `ah, capito`;
- `sì, esatto`;
- brief natural laughter such as `ahaha` / `hahaha` when the context genuinely supports it;
- small self-corrections, restarts, or incomplete phrasing when they make the turn sound more authentic.

These are **humanization cues**, not mandatory tokens.

### Do NOT overdo fillers

Do not mechanically put `ehm`, `cioè`, `praticamente`, `ci sta`, or laughter in every turn. That would simply create a new detectable script.

Use them:
- irregularly;
- only where a human speaker would plausibly use them;
- in a way appropriate to the target language/locale and scenario;
- without obscuring the actual request or skill being tested;
- **with different distribution across A and B** — do not place the same filler in the same corresponding turn just to make both versions look "natural."

A good conversation plan should feel **slightly imperfect but easy to say**.

### Written-sounding vs. spoken-sounding

**Too polished / written:**

> “Potresti spiegarmi in modo più dettagliato quali aspetti dovrei considerare prima di prendere questa decisione?”

**Better live turn:**

> “Ehm, ok… però sai cosa? Prima di decidere, che cose dovrei guardare davvero?”

**Too scripted:**

> “Ora vorrei che modificassi il tuo tono rendendolo più informale e amichevole.”

**Better live turn:**

> “Ok, aspetta… me la rifai un po’ più easy? Tipo come se ne parlassimo tra amici.”

**Natural correction:**

> “No, aspetta, mi sono spiegato male… intendevo l’altra opzione.”

**Natural reaction + follow-up:**

> “Ahaha ok, questa non me l’aspettavo. Però quindi tu come la vedresti?”

### Naturalness hierarchy for evaluator turns

When preparing spoken lines:

1. **Scenario adherence first** — the turn must genuinely test the assigned skill.
2. **Meaning preserved** — do not lose the required ask just to sound casual.
3. **Human spoken rhythm** — contractions, short clauses, discourse markers, reactions.
4. **Natural adaptation** — react to what the model actually said.
5. **A/B parity** — preserve equivalent evaluation burden while allowing genuinely different conversational paths.

### Same burden, not same wording — v6 strengthened rule

Model A and Model B must receive equivalent pressure, but **do not default to the same opener or to line-by-line paraphrases**.

The target is:

> **same turn function + same difficulty + different conversational realization**

Good:

```text
A-U2 function: challenge the reliability of the evidence
A: “Mmm, sul metodo ci sono. Però se l’endpoint è solo un surrogato, quanto mi fido poi del risultato sul paziente vero?”

B-U2 function: challenge the reliability of the evidence
B: “Ok, ti faccio l’avvocato del diavolo: magari i numeri del trial migliorano, ma nella pratica clinica che prova ho che cambia davvero la qualità di vita?”
```

Both test the same underlying skill and difficulty, but they do **not** look like one sentence copied and lightly edited.

Bad:

```text
A: “Okay, sì. Capisco il controllo dei confondenti, però c’è un altro problema...”
B: “Sì, capisco il controllo dei confondenti, però c’è un altro problema...”
```

Changing two or three words while preserving the same frame is still defensive scripting.

### Live-plan generation rule for the assistant

Whenever producing a **DUAL CONVERSATION PLAN**:

- make every spoken user turn immediately pronounceable;
- create **two separate versions**, one for A and one for B;
- keep the same **number of planned evaluator/user turns** and same scenario coverage;
- make the opener function equivalent but the wording distinct;
- vary syntax, discourse markers, question type, examples, and order of ideas;
- avoid repeating unusual metaphors, idioms, or memorable phrases across A and B;
- avoid using the same filler pattern at corresponding turns;
- make each follow-up explicitly react to that model's answer;
- if a model says something that makes the planned line unnatural, **rewrite the line live around the same turn function**;
- never force a prompt simply because it appeared in the other model's conversation;
- never turn the plan into a rigid dialogue script.

> **v8 L2 override:** in Creative & Playful / improv / stateful roleplay, these rules do **not** mean writing every future sentence in advance. U1 may be exact; U2+ should remain a reaction target + next-move function + optional compatibility-only fallback.

Use this default style:

```text
🅰️ MODEL A — A-U3
HOOK: pick up one concrete thing A just said
“Mh, sì… però su quella cosa lì non sono convinto: [A-specific challenge].”

🅱️ MODEL B — B-U3
HOOK: pick up one concrete thing B just said
“Capito. Però ti giro la questione: [equivalent B-specific challenge].”
```

The words are examples, **not fixed wording**.


## 0.3B Oct 2 QA correction — Defensive Scripting prevention protocol

### Why this section exists

The Oct 2 QA review applied a **Defensive Scripting** deduction because the two conversations were judged to:

- cover the same topics in a highly structured way;
- reuse several recognizable expressions across A and B;
- repeat distinctive phrasing/metaphors;
- preserve nearly the same long sentence structure with only a few word substitutions;
- feel like “copy the script, then change something” rather than two live conversations.

This feedback is cumulative and must change how all future scenarios are prepared.

### The new planning model: SHARED SPINE → TWO CONVERSATIONS

Before speaking, define only a **Shared Intent Spine**:

```text
U1 = establish scenario
U2 = probe the first capability
U3 = introduce a counterpoint / complication
U4 = test correction, adaptation, or deeper reasoning
U5 = final stress test / close if required
```

Then build **two separate natural realizations**.

#### Model A path

- phrasing designed independently;
- reacts to A's actual answer;
- may use one style of question (e.g. skepticism, concrete example, direct challenge).

#### Model B path

- phrasing designed independently;
- reacts to B's actual answer;
- can test the same skill through a different conversational angle (e.g. hypothetical, counterexample, practical consequence).

### Functional parity, not textual parity

Keep equivalent:

- required user-turn count;
- scenario objective;
- key skill tested at each stage;
- approximate depth;
- cognitive/information burden;
- emotional intensity;
- number of meaningful challenges;
- correction or stress-test opportunities when the scenario requires them.

Deliberately vary:

- exact opener;
- sentence structure;
- order of clauses;
- discourse markers/fillers;
- rhetorical angle;
- examples and hypotheticals;
- metaphors/idioms;
- whether the follow-up is phrased as a question, reaction, objection, or concrete case;
- how you reference the model's preceding answer.

### Phrase-overlap rule

Some **required technical terms** may naturally repeat across both conversations. That is fine.

What should **not** repeat is the surrounding conversational scaffold.

Avoid:

- the same 4–8 word conversational chunk across A and B when it is not required terminology;
- the same uncommon phrase or metaphor in both conversations;
- the same filler + transition sequence (`“Okay, sì… però…”`) at the same point;
- the same question rhythm with synonyms swapped;
- the same setup → concession → objection → conclusion sentence template over and over.

### Interruption / endpointing rule

If Model A interrupts, stalls, asks a clarifying question, or otherwise changes the flow, **do not force Model B to receive the same next sentence at the same sequential turn number**.

Use two numbering systems:

```text
PLANNED USER STEP: A-U1, A-U2, A-U3... / B-U1, B-U2, B-U3...
ACTUAL TIMELINE TURN: use the real Turn N only after the conversation exists
```

Parity is judged by **scenario function and burden**, not by making `Turn 5` contain the same script on both sides.

### Mandatory adaptive-hook rule

From **U2 onward**, every planned follow-up should contain a hook such as:

```text
HOOK: reuse one idea A just mentioned
HOOK: challenge the assumption B just made
HOOK: ask for a concrete example based on the model's previous answer
HOOK: correct one specific detail from the reply
HOOK: switch topic/mode exactly as the scenario requires
```

If the hook cannot be filled because the model did not say the expected thing, change the wording while preserving the turn's **function**.

### Human speech rule

Natural markers such as `ehm`, `cioè`, `praticamente`, `ci sta`, `insomma`, `mmm`, `ahaha` are useful only when they occur organically.

Do **not**:

- sprinkle the same fillers into both versions at the same turns;
- use laughter in serious contexts;
- insert filler words so frequently that the evaluator itself sounds synthetic;
- preserve a polished written sentence and merely add `ehm` at the front.

### 10-second anti-defensive-scripting audit

Before starting Model B, ask:

```text
[ ] Does B have the same user-turn functions as A?
[ ] Does B avoid copying A's sentence frames?
[ ] Are the opener and follow-ups genuinely different in wording and angle?
[ ] Did I remove repeated memorable phrases/metaphors?
[ ] Are fillers distributed naturally rather than mirrored?
[ ] Can each B follow-up react to B's own answer?
[ ] If A had an interruption or detour, am I preserving burden rather than replaying the same script?
```

If several answers are **No**, rewrite the B plan before speaking.


## 0.3C Agent-Ready Block — mode-sensitive Phase 1 export

### Why v8 changes the v7 export

v7 required a fully flattened copy block containing every planned USER line. That was convenient for logging, but in **improv/stateful** scenarios it created a dangerous failure mode: a stale prewritten line could remain visually “next” even after the model changed the scene.

The second Oct 2 QA review showed exactly this pattern. The evaluator continued with prepared lines even when the model had established a different state or decision.

> **v8 correction:** the export must support adaptation instead of competing with it.

### Step 1 — choose the export mode

#### L0 — FIXED-SAFE

Use only when later evaluator prompts are truly response-independent or the task explicitly requires fixed wording.

The block may contain full USER lines.

#### L1 — ADAPTIVE

Use for most ordinary conversations.

- U1 may be full text.
- U2+ must contain a **live reaction requirement** and may include a fallback line.
- The fallback is spoken **only if it still fits the model's actual reply**.

#### L2 — STATEFUL IMPROV

Mandatory default for:

- Creative & Playful;
- improv;
- evolving narrative;
- physical-scene roleplay;
- multi-step roleplay where objects/location/actions change;
- any scenario where the model's decision changes what the user can coherently say next.

For L2:

> **Only U1 is fully fixed by default. U2+ are adaptive instructions, not mandatory dialogue.**

### Exact parser-friendly format — L0

```text
=== SCENARIO: [SCENARIO TITLE] ===
--- MODEL A ---
Turn 1 (User): [full A user line]
Turn 2 (Model A): [Risposta del modello - <expected mode/function>]
Turn 3 (User): [full A user line]
Turn 4 (Model A): [Risposta del modello - <expected mode/function>]
...
--- MODEL B ---
Turn 1 (User): [full B user line]
Turn 2 (Model B): [Risposta del modello - <expected mode/function>]
Turn 3 (User): [full B user line]
Turn 4 (Model B): [Risposta del modello - <expected mode/function>]
...
```

### Exact parser-friendly format — L1/L2

Keep the same outer syntax so the downstream agent can still parse every line:

```text
=== SCENARIO: [SCENARIO TITLE] ===
--- MODEL A ---
Turn 1 (User): [full opener]
Turn 2 (Model A): [Risposta del modello - <expected mode/function>]
Turn 3 (User): [ADAPT LIVE — react to one concrete detail from Turn 2; execute U2: <turn function>; do not contradict live state | FALLBACK ONLY IF COMPATIBLE: <short fallback line>]
Turn 4 (Model A): [Risposta del modello - <expected mode/function>]
Turn 5 (User): [ADAPT LIVE — update scene state from Turn 4; execute U3: <turn function>; preserve continuity | FALLBACK ONLY IF COMPATIBLE: <short fallback line>]
...
--- MODEL B ---
Turn 1 (User): [full B opener]
Turn 2 (Model B): [Risposta del modello - <expected mode/function>]
Turn 3 (User): [ADAPT LIVE — react to one concrete detail from Turn 2; execute U2: <same function/equivalent burden>; do not copy A's local scene | FALLBACK ONLY IF COMPATIBLE: <different fallback line>]
Turn 4 (Model B): [Risposta del modello - <expected mode/function>]
...
```

### Strict formatting rules

1. Start with exactly `=== SCENARIO: ... ===`.
2. Use exactly `--- MODEL A ---` and `--- MODEL B ---`.
3. Each utterance/instruction occupies **one physical line**.
4. Restart numbering from `Turn 1` for Model B.
5. Do not fabricate model replies.
6. In L1/L2, text inside `[ADAPT LIVE — ...]` is an **execution instruction**, not something to read aloud.
7. The agent/logger must replace the planned adaptive instruction with the **actual spoken USER line** in the final saved conversation.
8. Planned turn numbers are orchestration labels only. Final rationale evidence uses actual observed conversation/Timeline numbering.

### Hard stop: stale-line prevention

Before a prewritten/fallback line is spoken, ask:

```text
Does this line still make sense after the model's last reply?
```

- **YES** → it may be used naturally.
- **NO / unsure** → discard it and generate a new line from the turn function + current state.

Never preserve a stale sentence merely because it appears next in the export.

### Final logging format

After the conversation, the downstream agent should save the **actual** conversation in the same clean structure:

```text
=== ACTUAL CONVERSATION: [SCENARIO TITLE] ===
--- MODEL A ---
Turn 1 (User): [what was actually said]
Turn 2 (Model A): [what the model actually said]
Turn 3 (User): [what was actually said after adaptation]
...
```

This **ACTUAL LOG**, not the pre-conversation export, is the text source for post-task reasoning and rationale construction.



## 0.3D Oct 2 second QA correction — live-state continuity and true improv protocol

### What the QA review identified

The new review did **not** mainly complain that A and B shared similar wording. It identified a deeper problem:

> the evaluator kept following a pre-planned sequence **even when the model's own response made the next planned line irrelevant or contradictory**.

Examples cited in the review included:

- an acknowledgement such as `“Già, proprio così”` that did not naturally answer what the model had just said;
- a user line being accidentally repeated instead of responding to the current scene;
- continuing with `“preso”` even after the model had said there was **nothing to throw**;
- continuing the planned action after a model had told the user to **stay inside**.

These are not merely wording-overlap problems. They are **live-state continuity failures**.

### North Star

> **THE MODEL'S LAST VALID SCENE MOVE IS THE SOURCE OF TRUTH FOR THE NEXT USER TURN.**

The pre-task plan is only a map. It has no authority over the live state.

### Mandatory execution loop

For every user turn after the opener:

```text
1. LISTEN — what did the model actually say/do?
2. UPDATE STATE — what is now true in the scene?
3. CHECK CONTINUITY — what planned assumptions are now invalid?
4. CHOOSE FUNCTION — which shared-spine skill still needs testing?
5. REACT — acknowledge one concrete thing from the model naturally.
6. ADVANCE — ask/do the next compatible thing.
7. SPEAK — only now produce the line.
```

Shortcut:

> **LISTEN → STATE → FUNCTION → REACTION → NEXT MOVE**

### Live State Ledger

For L1/L2 scenarios, track only what matters:

```text
LIVE STATE
WHERE / SCENE:
MODEL'S LAST DECISION OR ACTION:
AVAILABLE OBJECTS / OPTIONS:
USER STATUS / POSITION:
CONSTRAINTS JUST ESTABLISHED:
UNRESOLVED THREAD:
NEXT USER-TURN FUNCTION:
```

The ledger can be extremely short. Its purpose is to prevent the next line from assuming something the model has just denied or changed.

### Continuity gate — mandatory before speaking

Ask these four questions:

```text
[ ] Does my first phrase genuinely respond to what the model just said?
[ ] Am I assuming an object/action/location that the model removed or contradicted?
[ ] Did the model give an instruction/decision that my next line is silently ignoring?
[ ] Would a human hearing only the last model reply + my next line understand why my reply follows?
```

If any answer is **No**, rewrite the line.

### Reaction-first turn anatomy

For stateful/improv conversations, a good user turn usually has:

```text
1. SHORT REACTION to the actual model reply
2. SCENE-COMPATIBLE MOVE
3. OPTIONAL CHALLENGE / QUESTION that tests the target skill
```

Example:

```text
Model: "Resta dentro, fuori è troppo rischioso."

BAD:
"Perfetto, allora esco e aggancio il cavo."

GOOD:
"Ok, resto dentro. Allora da qui come faccio a mettere in sicurezza il cavo senza uscire?"
```

Another example:

```text
Model: "Non c'è niente da lanciare."

BAD:
"Preso!"

GOOD:
"Ah, ok, allora niente lancio. Che alternativa abbiamo qui?"
```

### Generic acknowledgement rule

Avoid detached stock reactions such as:

- `Già, proprio così`;
- `Esatto`;
- `Perfetto`;
- `Capito`;

when they do not clearly connect to the model's preceding content.

Prefer a **content anchor**:

- `Ok, quindi mi stai dicendo di restare dentro...`;
- `Ah, quindi il problema è che non abbiamo niente da usare...`;
- `Sì, sul rischio che hai detto ti seguo...`.

The reaction does not need to quote the model; it only needs to prove that the next turn grew out of the previous one.

### Evaluator slip recovery

If the evaluator:

- repeats the wrong line;
- misspeaks;
- references the wrong object;
- contradicts the established scene;

do **not** continue as if nothing happened.

Repair naturally:

```text
"Aspetta, mi sono ripetuto. Intendevo..."
"No, scusa, ho detto una cosa che non torna: resto dentro. Da qui..."
"Mi sono confuso sul cavo; riparto da quello che hai appena detto..."
```

A visible self-repair is more conversationally coherent than pretending the mistake never occurred.

### No forced beat rule

In L2 improv:

- do not require `Turn 5` to contain a predetermined plot event;
- do not force an object to exist because the plan mentioned it;
- do not make the user “win,” “catch,” “throw,” “leave,” “enter,” or otherwise complete a planned beat if the model's scene did not support it;
- do not push B through the same local plot events A happened to produce.

Preserve **skill coverage and difficulty**, not plot choreography.

### A/B parity under divergent scenes

A and B may now diverge locally.

Fairness is maintained by comparing:

- number of user turns;
- target skill functions;
- challenge intensity;
- information/emotional burden;
- number of corrections or mode shifts where required.

Fairness is **not** maintained by forcing the same fictional object, action, location, or exact plot beat into both conversations.

### Improv pre-write limit

For L2 scenarios:

- **U1:** full spoken line allowed;
- **U2+:** intent + hook type + optional compatible fallback;
- never prepare a complete, mandatory multi-turn script in advance.

This is the strongest v8 anti-defensive-scripting rule.

### 5-second pre-speech audit

Before every L2 follow-up:

```text
WHAT JUST CHANGED?
WHAT IS TRUE NOW?
WHAT FUNCTION DO I STILL NEED TO TEST?
WHAT WOULD I NATURALLY SAY TO THIS SPECIFIC REPLY?
```

If the answer is not obvious, shorten the next turn instead of reading the fallback.



## 0.4 Evidence ownership

Use the correct evidence source for each judgment:

- **Naturalness / Engagement / Aesthetics** → how human-like, warm, expressive, appropriately paced, and emotionally calibrated the model sounds.
- **Utility** → information quality only: correctness, relevance, specificity, coherence, usefulness.
- **Task Success** → whether every explicit, implicit, nested, modality, format, role, and emotional requirement was actually completed.
- **Audio Quality** → technical model-output signal only.
- **Conversational Dynamics** → turn-taking, yielding, interruption/endpointing behavior, timing, responsiveness.
- **Latency** → response delay.
- **AQ / CD / Latency** → under the Sep 25 alignment, use **Timeline View as the authoritative/sole evidence source** for the final rating/flag.

---

# 0A. September 2026 webinar updates — authoritative operational clarifications

These updates are incorporated throughout the playbook and should override older wording where there is any ambiguity.

## 0A.1 Error clusters — current interface + rolling taxonomy rule

Use the **exact error taxonomy displayed in the current submission**. The Sep 16 client update is being rolled out gradually, so during the transition a task may show a **mix of old and new labels**.

### Current / rolling labels to recognize

1. **Repetitive Looping and LLMisms**
2. **Interrupted User**
3. **Instruction Quality** — **new label replacing Model Refusals** where the new config is active
   - **Model Refusals** may still appear in legacy/mixed configurations; if so, use the label shown in that task.
4. **Inaccuracy (Factual Hallucination)**
5. **Embodiment Hallucination**
6. **Failed Correction**
7. **Overacted / Too-Wide Prosodic Range**
8. **Bad ASR or Model Misunderstanding**
9. **Latency**
10. **Wrong Language**
11. **Response Not Locally Relevant**
12. **Wrong Grammatical Gender**
13. **Wrong Accent / Variant** — new rollout label
14. **Bridging** — new rollout label
15. **Voice inconsistency** — use only if the live interface exposes it; follow the live definition/examples

> **Transition rule:** do **not** force the newest labels into a task that still displays the older taxonomy. For each submission, use the **version of the error taxonomy displayed in that submission**.

> **Important:** the older wording “Anthropomorphism / Embodiment Hallucination” refers to the same family of behavior, but the current interface label used in this playbook is **Embodiment Hallucination**.

For every selected cluster, the rationale must identify **specific, verifiable evidence** that justifies the selection. The severity must still be selected correctly in the UI when the cluster exposes severity levels, but **the Sep 30 client calibration says it is not necessary to repeat “Minor / Moderate / Major” in the prose rationale**.

The webinar/client guidance also emphasizes that missing a real model issue or making an incorrect cluster judgment can reduce the task score. Treat cluster review as a required verification step, not an optional afterthought.

## 0A.2 Utility vs. Task Success — strict separation

**Utility** evaluates **only the quality of the information/help itself**: whether it is correct, relevant, specific, coherent, and useful enough for the user to move forward. **Utility does not assess scenario adherence.**

**Task Success** evaluates whether the model fulfilled **every layer of the request on each turn**, including:

- explicit asks,
- implicit expectations,
- unstated emotional needs,
- the appropriate emotional register,
- requested format/role/style,
- corrections and conversational intent,
- avoiding unrequested actions or a misread intent.

A factuality/quality issue normally reduces **Utility**, not automatically **Task Success**. Reduce Task Success only when the problem also changes whether the model actually fulfilled the user’s request.

## 0A.3 Endpointing / Conversational Dynamics — updated definition

An **Endpointing / Conversational Dynamics (EP/CD)** scenario primarily tests the model’s ability to manage **real-time turn-taking**: knowing **when to speak, listen, yield, or stop**.

The flow of the interaction is the product. Judge:

- whether the model detects when the user is finished,
- whether it responds at the right moment,
- whether it yields the turn appropriately,
- interruption handling,
- correction handling,
- latency and real-time conversational rhythm.

**Overall Preference priority:**

> **Conversational Dynamics >> Naturalness >> Audio Quality**

## 0A.4 Bilingual scenarios — validity rule

Bilingual scenarios test whether the model can handle **two languages in one conversation the way a native bilingual speaker would**.

Two webinar categories:

- **Code Switching** — the user naturally mixes/switches languages mid-conversation; the model should keep up without over-correcting.
- **Language Learning** — the user asks about one language using another; the model explains, gives examples, and corrects appropriately.

> **The language-switching/mixing behavior itself is the skill under test.** The annotator must perform the scenario’s prescribed language pattern for the evaluation to be valid.

## 0A.5 Audio Quality — independent-first rating rule

Rate **model output audio only** — never the user microphone/background noise.

> **Sep 25 alignment — Timeline-only evidence:** Audio Quality judgments must be based **only on the audio/tracks available in Timeline View**. A click, pop, distortion, truncation, or other AQ issue heard during the live interaction but **not reproducible in the Timeline View recording must not be reported or used in the rating/rationale**.


1. **Judge each model independently first.** Ask: does this model have a clear, noticeable technical audio problem?
2. **Then compare A vs. B.**
3. Consider **severity × frequency**: one glaring issue or a recurring milder issue can qualify as a real problem.

Operational labels:

- **Fine = None / Minor** technical issues; no clear problem.
- **Bad = clear, noticeable Moderate / Major** technical problem.

Comparison logic:

| Model A | Model B | Select |
|---|---|---|
| Fine | Fine | **Both good** |
| Fine | Bad | **A preferred** |
| Bad | Fine | **B preferred** |
| Bad | Bad, one clearly worse | **Preferred = less-bad model** |
| Bad | Bad, similar severity | **Both bad** |

Minor differences between two otherwise fine outputs do **not** require choosing a preferred model for Audio Quality.

## 0A.6 Naturalness vs. Conversational Dynamics — sharpened boundary

**Naturalness / Engagement / Aesthetics** evaluates:

- human-likeness,
- authentic pacing, cadence, and breath,
- friendliness of the voice,
- expressive vocal rhythm and tone,
- emotional connection.

**Conversational Dynamics** evaluates:

- the structural logic and timing of turn-taking,
- when to speak,
- when to yield,
- when to interrupt or stop,
- the real-time rhythm of interaction.

A model can be warm and human-like but repeatedly interrupt the user: **good Naturalness, poor Dynamics**. A model can have perfect turn timing but sound stiff and monotone: **good Dynamics, poor Naturalness**.

## 0A.7 Live evaluator workflow preference

For live use, keep the pre-conversation plan easy to follow while speaking:

- **3–4 minute scenarios:** one opener, about 3 follow-ups, 1 stress test.
- **10 minute scenarios:** one opener, about 6–8 adaptable follow-ups, 1–2 stress tests.
- **What to observe:** normally no more than **4 high-value points** specific to the scenario.
- Keep notes compact enough to glance at while talking.

This is an operational workflow preference, not a change to the evaluation rubric.

## 0A.8 Sep 14 Aether QM community quality recommendations — operational reinforcement

The Sep 14 quality post highlighted six recurring failure modes. Most were already covered in this playbook; the following rules make them explicit and mandatory in live use.

### A. Rating justification quality — explain *why*, not only *what happened*

A rationale must connect each important observation to the **correct rating dimension** and explain why it supports the selected winner.

- Voice warmth, expressiveness, cadence, human-likeness, and tone → **Naturalness / Engagement / Aesthetics**.
- Turn timing, yielding, interruptions, endpointing, and latency → **Conversational Dynamics**.
- Correctness, relevance, specificity, and usefulness of information → **Utility**.
- Signal artifacts such as clicks, pops, clipping, warble, distortion, truncation, or missing audible output → **Audio Quality**.

Do not merely restate the conversation. Use this logic:

> **Observation → correct dimension → impact on the user experience → comparison → why it matters for this scenario.**

### B. Mandatory pre-submit missed-error sweep

Before submitting, check **both models independently** for the commonly missed issues below, even if the conversation felt good overall:

1. Task Success / explicit-instruction fulfillment
2. required **modality** or voice behavior
3. Bad ASR or Model Misunderstanding
4. Wrong Language
5. Latency
6. Voice inconsistency **if that label/issue appears in the live interface**
7. Instruction Quality / Model Refusal **using the taxonomy shown in that submission**
8. Wrong Accent / Variant **if shown**
9. Bridging **if shown/relevant**
10. Interrupted User
11. Failed Correction
12. factual inaccuracies
13. technical audio artifacts

> **Important:** producing the requested *content* is not enough when the task also requires a specific modality, voice style, speed, role, language pattern, format, or interaction behavior. A model can produce semantically correct content and still miss the central task requirement.

### C. Dimension-specific winner discipline

Choose the winner for **each dimension independently using only that dimension's criteria**.

Examples:

- A warmer voice does not make Conversational Dynamics better unless turn-taking itself was better.
- Cleaner audio does not make Naturalness better.
- A more human-like voice does not make Utility better if the information is less accurate.

Only after rating the dimensions should you apply the scenario priority hierarchy to choose the overall preference.

### D. Scenario adherence

Execute the assigned scenario **as intended**, and make sure the conversation actually exercises the scenario's key skills.

Latest adherence alignment:

- **Read and frame the task before starting.** Do not rush into the live conversation. Spend the necessary setup time — the community guidance recommends using roughly the first **5 minutes** when needed — to understand the scenario, required turns, key skills, and any preparation requirements.
- **Do not read or apply “What to do” literally word-for-word.** These lines may come from automatic translation and can sound unnatural. Interpret the intended behavior in the context of the task and enact it naturally.
- **“Skills tested” are evaluation targets, not a script.** Use them to decide what capability you must genuinely exercise and observe.
- **Actually test the key skill.** Staying loosely on the same topic is not enough if the scenario asks for a specific challenge. For example, if the skill is handling off-topic questions and returning to the main path, ask a genuinely off-topic question rather than only asking adjacent questions inside the original domain.
- **Complete any required pre-task research/preparation before starting.** Some scenarios explicitly require gathering a minimum amount of material first; have that material ready before the conversation.
- **Respect the required minimum number of **evaluator/user turns**; model responses do not count toward that minimum.** Missing the requested turn count can make the evaluation insufficient even if the rest of the conversation was good.
- Keep Model B **as close as possible to Model A in evaluator/user-turn count**, while preserving natural adaptation and comparable difficulty.
- You may use the **Notes** area to organize the points/prompts used with Model A and then preserve equivalent evaluation pressure for Model B. Notes are an organizer, **not permission to defensively script** both conversations.

Do not introduce unrelated tests, skip required behaviors, or replace the assigned scenario with a personally preferred one. Adapt naturally to the model's replies while preserving the intended skill test.

### E. Defensive scripting reminder

Use the same **evaluation burden**, not the same rigid script. Keep opener, effort, depth, and challenge comparable while adapting naturally to each model's actual responses.

### F. Audio artifact logging

You may note a possible artifact during the live interaction, but treat the note as **provisional** until it is confirmed in **Timeline View**.

Operational rule:

> **LIVE NOTE → TIMELINE CONFIRMATION → RATE/FLAG**  
> **LIVE NOTE + NOT PRESENT IN TIMELINE VIEW → DROP IT**

Recommended shorthand:

```text
AQ ARTIFACT — PROVISIONAL
Model: A / B
Live event/turn: [if known]
Possible type: click / pop / clipping / distortion / warble / truncation / missing audio / other
Timeline confirmation: YES / NO
Timeline timestamp: [only if visible/confirmed]
Frequency in Timeline View: isolated / recurring
Impact: intelligibility / continuity / mild annoyance / severe disruption
```

Do **not** report an AQ issue merely because it was heard live. If it cannot be reproduced in the Timeline View recording, **do not select it, do not lower Audio Quality for it, and do not mention it as a model audio defect in the final rationale**.

### G. Voice inconsistency — interface-aware rule

The Sep 14 quality post explicitly names **Voice inconsistency** among commonly missed issues. It is not defined in the older 12-cluster webinar list reproduced in this playbook.

> If **Voice inconsistency** appears in the current live interface, use the live label and its current examples/definition. Do not ignore it merely because it is absent from the older taxonomy, and do not invent a definition when the interface does not provide one.



## 0A.9 Sep 16/17 client update — new clusters + locale/fact-check clarifications

This update is operationally important and should be applied immediately whenever the corresponding labels appear in the live task.

### A. [NEW] Wrong Accent / Variant

Use when the model speaks the **correct language** but uses one or more of the following in a noticeable way:

- a non-native accent,
- vocabulary from the wrong regional variant,
- grammar from the wrong regional variant,
- or a combination of these.

This is **not Wrong Language**: the language itself is correct.

**Severity levels shown in the update:**

- **Moderate:** the accent or regional-variant mismatch is noticeable and distracting, but the response remains understandable and easy to follow.
- **Major:** the mismatch is pronounced or persistent, significantly reducing naturalness or making the response difficult to understand.

> **Rating impact:** lower **Naturalness / Engagement / Aesthetics** accordingly.

Do not invent a Minor severity for this cluster if the live interface only offers Moderate/Major.

### B. [NEW] Bridging

Use when the model hands a task to a tool or larger model and fills the wait with a spoken bridge/placeholder such as:

> “Oooh, searching…”

The problem is **usually not the existence of a bridge itself**. The issue is repetitive or poorly calibrated bridging — e.g. the same phrase, pitch, and pacing every time, making handoffs sound repetitive, jingle-like, generic, or over-signaled.

**Severity levels shown in the update:**

- **Minor:** one or two bridges are stiff, generic, or mistimed, but delivery still varies. Also includes a single missing bridge before a short delay.
- **Moderate:** the same filler recurs, or different fillers use effectively identical prosody, making the next bridge predictable. Also includes over-narrating every handoff.
- **Major:** every delegation uses the same phrase at the same pitch, detached from context. Also includes excessive signaling and dropping register, such as exposing tool names or raw status.

When deciding the rating impact, describe the concrete handoff behavior and its effect on conversational polish/flow; do not treat all tool-use narration as automatically erroneous.

### C. [NEW] Instruction Quality — replaces Model Refusals in the new taxonomy

Use **Instruction Quality** when the model **understands the request** but does not carry it out faithfully, including when it:

- refuses,
- does the wrong thing,
- only does part of the task,
- quietly drops part of the instruction,
- falsely declines a safe/in-policy request,
- deflects,
- or excessively hedges on a safe, in-policy request that is within its capabilities.

**Do not use Instruction Quality for comprehension failures.**

- If the model did not understand because of recognition/comprehension failure → **Bad ASR or Model Misunderstanding**.
- If it understood but failed to act faithfully → **Instruction Quality**.
- **Task Success** separately captures whether the task was ultimately completed.

**Severity levels shown in the update:**

- **Minor:** mostly completed, but misses a small detail or secondary instruction.
- **Moderate:** only partially addressed — parts are missing, hedged, or there is a soft refusal that forces the user to ask again.
- **Major:** ignores or contradicts explicit instructions, or declines a clearly safe, in-scope request.

> **Transition rule:** if the task still shows **Model Refusals** instead of Instruction Quality, use the label actually displayed by that submission.

### D. Locale-aware error-cluster interpretation

Apply the taxonomy using the **target locale’s conventions** where relevant.

- A behavior may be conventional in one locale even if a literal reading of the taxonomy makes it look erroneous.
- For nuanced/borderline cases, document the relevant locale-specific cue in the rationale so the decision is objectively defensible.
- **Wrong Grammatical Gender:** apply the target locale’s conventions. Do **not** flag locally accepted gender defaults or standard noun agreement merely because a literal surface form looks gendered.

### E. Fact Check feature — research aid, not authoritative source

Treat the automated Fact Check as **supporting research only**.

Independently assess:

- whether the claim is actually wrong,
- severity,
- relevance to the scenario,
- and whether the source/context supports the flag.

If the automated result conflicts with:

- the audio,
- the conversational context,
- a native-language interpretation,
- or a reliable source,

use your own judgment and **briefly explain the override in the rationale**.

### F. Scenarios that cannot be annotated

If **unclear wording, mistranslation, or lack of local relevance** prevents you from completing the scenario as intended:

> select **Skip (Technical issue) → Other**

Do not fabricate an interpretation just to finish the task. Also share the issue with the QM when instructed by the project workflow.



## 0A.10 Sep 23 — Live S2S Elo Quality Feedback and Recommendations

This is the latest project-wide quality reinforcement. Where it sharpens older wording, apply the Sep 23 interpretation.

### A. Apply scenario-specific dimension weighting

When choosing **Overall Preference**, do **not** use one fixed hierarchy for every task. First identify what the scenario is actually testing, then apply the appropriate priority:

| Scenario type | Overall Preference priority |
|---|---|
| **EQ** | **Naturalness / Engagement / Aesthetics > Utility > Audio Quality** |
| **IQ** | **Utility > Naturalness / Engagement / Aesthetics > Audio Quality** |
| **Endpointing / Conversational Dynamics** | **Conversational Dynamics > Naturalness / Engagement / Aesthetics > Audio Quality** |
| **Hybrid** | **Match the weighting to the specific prompt being tested** |

For **Hybrid** scenarios, use the anchor question:

> **“What was the user trying to get out of this?”**

Then decide which dimension or combination of dimensions should drive Overall Preference. Do not automatically force Hybrid into a fixed Naturalness-first or Utility-first hierarchy.

### B. Timeline View — sole reference for Conversational Dynamics, Audio Quality, and Latency

The Sep 25 alignment supersedes the older “supporting evidence” wording.

> **For Audio Quality (AQ), Conversational Dynamics (CD), and Latency, evaluate ONLY what is present in the Timeline View tracks/recordings.**

Review Timeline View for:

- interruptions / overlap,
- **premature endpointing**,
- **dead air**,
- yielding / turn-boundary behavior,
- unequal turn-taking,
- suspicious timing asymmetries,
- response delay / latency,
- technical audio artifacts in the model output.

The live interaction can help you notice what to check, but it is **not sufficient evidence** for these three categories.

> If an AQ/CD/Latency issue seemed to happen live but **is not present in the Timeline View recording/tracks, do not report or penalize it**.

For AQ, listen only to the **model-output track** in Timeline View.  
For CD, interpret the user and assistant tracks together.  
For Latency, use the recorded timeline gaps/timing rather than subjective live lag.

Keep **Conversational Dynamics (CD)** separate from **Naturalness / Engagement / Aesthetics (NEA)**:
- CD = *when* the model speaks/listens/yields/stops, based on Timeline View;
- NEA = *how human-like, expressive, warm, and aesthetically natural* the voice sounds.

### C. Keep comparisons spontaneous but equivalent

**Scenario Coherence** requires the two conversations to have equivalent:

- openings,
- effort,
- context,
- complexity.

Equivalent does **not** mean verbatim.

**Defensive Scripting** includes reading — or disguising — a pre-written script. Do not run the same rigid prompt sequence regardless of what each model says.

Use:

> **same evaluation burden + natural adaptation**

The conversation should remain responsive to each model while preserving comparable challenge.

### D. Distinguish Utility from Task Success

The Sep 23 post reinforces the existing strict boundary:

- **Utility** asks whether the information/help is **accurate and useful**.
- **Task Success** asks whether the model completed **every explicit and implicit part of the request**.

Do not lower Utility merely because the model missed an interaction/style instruction if the information itself was still accurate and useful.  
Do not mark Task Success as achieved merely because the content was factually good if the model failed a central explicit/implicit requirement.

### E. Apply Wrong Language narrowly

Do **not** use **Wrong Language** for:

- culturally appropriate code-mixing,
- expected bilingual switching,
- regional accent differences,
- regional language-variant differences.

If the model is speaking the **correct language** but the accent, regional vocabulary, or regional grammar is wrong for the target locale, use **Wrong Accent / Variant** when that cluster is available.

Wrong Language should be reserved for an actual unexpected language response.

### F. Follow Audio Quality selection guidance strictly

Rate **model-output audio only**.

For each model:

1. Judge it **independently**.
2. Ask whether there is a **clear, objectively noticeable** technical issue.
3. Weigh **severity × frequency**.
4. Do **not** let a barely perceptible difference swing the Audio Quality selection.

Reference logic:

| Model A | Model B | Selection |
|---|---|---|
| Fine (None/Minor) | Fine (None/Minor) | **Both good** |
| Fine | Bad | **A preferred** |
| Bad | Fine | **B preferred** |
| Bad | Bad — one clearly worse | **Prefer the less-bad model** |
| Bad | Bad — equally bad | **Both bad** |

A recurring issue can raise the effective severity even if each individual occurrence is not extreme.

### G. Make rationales evidence-based and internally consistent

Every final rationale should:

- name the relevant **dimension**,
- cite a **turn, timestamp, short phrase, or specific interaction event** when available,
- explain **why the evidence changes the judgment**,
- ensure the prose is consistent with **every selected rating**.

Use this **4-part structure**:

1. **What happened?** — identify the noticed strength/issue.
2. **Where/when?** — turn / timestamp / short phrase / specific event.
3. **Why does it matter?** — explain the impact on the relevant dimension and scenario.
4. **Comparison** — explain how the other model performed on the same point.

Do not invent timestamps, turns, or quotes that were not actually observed.



## 0A.11 Sep 25 — Latest community alignments: Timeline authority, Scenario Adherence, and rationale discipline

These are the newest operating clarifications. Where they conflict with earlier wording, **Sep 25 wins**.

### A. Timeline View is the unique reference for AQ, CD, and Latency

For these three categories:

- **Audio Quality**
- **Conversational Dynamics**
- **Latency**

use **only the tracks/recordings visible in Timeline View** as the evidence base.

Live impressions are provisional. If an issue was heard live but is not reproduced in Timeline View, **do not signal it**.

#### Fast rule

```text
Heard live?
   ↓
Check Timeline View
   ├─ Present → evaluate severity/frequency and use it
   └─ Absent  → ignore for AQ/CD/Latency
```

This means:
- a live-only click/pop does not count as AQ evidence;
- a live-only perceived interruption does not count as CD evidence;
- a live-only perceived delay does not count as Latency evidence.

### B. Scenario Adherence — what must be true before the conversation ends

A scenario is not correctly executed merely because the conversation sounded natural.

Before starting:
1. Read the scenario carefully and identify the **key request**, **turn requirement**, **skills tested**, and any **research/preparation** requirement.
2. Use enough setup time to understand the task; do not rush into the conversation.
3. If research is required, complete it first.

During the conversation:
1. Interpret **“What to do”** naturally; do not mechanically recite translated wording.
2. Make sure every central **skill tested** is genuinely exercised.
3. Respect the required minimum number of **evaluator/user turns**; model responses do not count toward that minimum.
4. Keep A and B comparable in turn count, effort, context, and challenge.
5. Use Notes to organize evaluation points if useful, while still adapting naturally to the model.

#### Common adherence failure

A prompt can look “on-topic” while still failing to test the skill.

Example pattern:
- scenario tests recovery from **off-topic questions**;
- evaluator asks only questions still related to the main domain;
- the model never has to recover from a truly off-topic turn;
- therefore the target skill was **not actually tested**.

The question to ask before submission is:

> **“Did my prompts really force the model to demonstrate the listed skill?”**

### C. Required-turn discipline

If the task specifies a minimum number of turns, treat it as a hard execution requirement and count **only evaluator/user turns**.

- Do not stop early because you already “have enough evidence.”
- If A used N turns, keep B as close to N as possible unless the task flow makes that impossible.
- Do not inflate one side with extra stress tests that the other side did not receive.

### D. Rationale alignment — prove the decision, do not narrate the transcript

The latest rationale guidance reinforces the evidence-first approach already used in this playbook.

A strong rationale should:
- state the overall preference;
- identify the **decisive scenario dimension**;
- use one or more **specific observed examples**;
- explain why each example changes the rating;
- compare the other model on the same point;
- mention meaningful trade-offs/ties;
- stay consistent with Task Success and selected error clusters.

For **AQ, CD, and Latency**, any evidence cited in the rationale must be **confirmed in Timeline View**.

Use:

> **Decision → evidence → dimension impact → comparison → scenario relevance**

Avoid:
- transcript-style retelling,
- unsupported adjectives such as “better” or “more natural,”
- live-only AQ/CD/Latency claims,
- turn/timestamp details that were not actually confirmed,
- selected error clusters that are not explained in prose.

### E. Pre-submit Sep 25 audit

Before pressing submit:

```text
SCENARIO
[ ] Key request actually tested
[ ] Every important "Skills tested" capability exercised
[ ] Required minimum **user-turn count** satisfied
[ ] B comparable to A in **user turns** / effort / challenge
[ ] Required research/preparation completed

TIMELINE VIEW
[ ] AQ checked only from Timeline recording
[ ] CD checked only from Timeline tracks
[ ] Latency checked only from Timeline timing
[ ] Live-only AQ/CD/Latency impressions removed

RATIONALE
[ ] Overall preference stated
[ ] Decisive dimension named
[ ] Specific evidence included
[ ] Evidence explains impact, not just event
[ ] A vs B comparison is explicit
[ ] Ratings / Task Success / clusters are internally consistent
```



---


## 0A.12 Sep 30 — Latest client calibration: justification quality, evidence coverage, parity, and QA carryover

These reminders are **client-calibration priority** and supersede older wording where they conflict.

### A. Rationales must be specific and verifiable

A rationale must give the reviewer enough detail to understand **exactly what happened and how to verify it**.

Acceptable evidence includes:
- **Turn number**;
- **Timeline timestamp**;
- a **brief quotation / short phrase** from the model;
- a **specific model behavior or interaction event**.

Avoid vague statements such as:
- “Model A was less natural.”
- “Model B had several errors.”
- “A interrupted a lot.”

Prefer evidence that lets a reviewer locate or recognize the event immediately.

### B. Repeated-problem evidence rule — 1–3 vs. >3 occurrences

When describing a repeated problem:

- **If it occurs 1, 2, or 3 times:** identify **all occurrences**.
- **If it occurs more than 3 times:** provide an **approximate total count** and at least **3 clear examples**.

Examples:

```text
GOOD — 3 occurrences
Model A interrupted the user three times: Turn 4, Turn 8, and Turn 12.

GOOD — more than 3
Model B used the same generic bridging phrase about 7 times; clear examples occur at 01:14, 02:06, and 03:31.
```

Do not claim an exact total unless it was actually counted.

### C. Mandatory explanation coverage

The final rationale must explain:

1. **Overall Preference** — why A or B won overall.
2. **The dimension(s) that determined the Overall Preference** — do not merely state the winner.
3. **Every Task Success = Partial or Fail** — identify the unmet requirement and evidence.
4. **Every selected Error Cluster** — identify concrete/verifiable evidence and why it qualifies.

A **Task Success = Pass** does not require a separate defensive explanation unless it is useful to resolve an apparent contradiction.

### D. Severity wording — Sep 30 correction

The evaluator must still choose the **correct severity in the live UI** whenever the cluster exposes severity levels.

However:

> **It is NOT necessary to write “Minor / Moderate / Major / Catastrophic” in the rationale.**

The rationale should prioritize:
- what happened;
- where/when it happened;
- why it matters;
- how often it happened when relevant;
- comparison with the other model.

Include the severity word only when it genuinely improves clarity.

### E. Scenario parity before submission

Before submitting, re-check:

- the required **number of evaluator/user turns**;
- that **every requested scenario step** was completed;
- that both models received **equal/equivalent evaluator inputs** in burden, context, complexity, and challenge;
- that one model was not given extra prompts, stress tests, corrections, or recovery opportunities without a comparable burden for the other.

“Equivalent” still does **not** mean verbatim defensive scripting. Adapt naturally while preserving the same evaluation burden.

### F. QA feedback is cumulative

Before starting/submitting later tasks, re-read any available **QA feedback** and apply the correction to subsequent tasks.

Treat repeated QA feedback as a workflow signal: once a failure mode has been identified, add it to your personal pre-submit sweep until it is consistently resolved.

### G. Current client quality-focus areas

The latest calibration highlights three main quality areas:

1. **Justification Quality**
   - specific;
   - verifiable;
   - complete explanation coverage;
   - no unsupported generalizations.

2. **Audio Quality**
   - model-output signal only;
   - Timeline View remains the sole final evidence source;
   - objective, noticeable defects only;
   - severity × frequency still matters for the rating.

3. **Scenario Adherence**
   - correct number of user turns;
   - all required steps/skills actually exercised;
   - fair A/B input parity;
   - no premature ending or skipped scenario element.

### H. Sep 30 rationale formula

Use:

> **Overall decision → decisive dimension(s) → specific/verifiable evidence → frequency coverage when relevant → A/B comparison → Task Success Partial/Fail explanation → selected-cluster explanation**

For AQ/CD/Latency, the supporting evidence must still come from **Timeline View**.



## 0A.13 Final Rationale — optional cohesive-prose style

The final rationale must remain **evidence-based and complete**, but it should also be easy for a reviewer to scan. **As of the Oct 1 client JQ calibration, the labeled client template in §0A.14 is the recommended default.** This multi-paragraph style remains an acceptable alternative when it covers all required JQ elements.

### Default presentation

Use this external response heading:

```markdown
###### ✍️ Final Rationale
```

If using the cohesive-prose alternative, write the rationale as **3–4 concise paragraphs**, not as a dense wall of text. Do not use this format if it makes required evidence harder to locate than the Oct 1 client template.

### Recommended paragraph structure

**Paragraph 1 — Overall + core task / Utility / Task Success**

Start directly:

> `I prefer Model B overall.`

Then summarize:
- whether both models completed the core scenario;
- the most important Utility comparison;
- Task Success for both models;
- shared strengths or shared errors that did **not** decide the winner.

**Paragraph 2 — Timeline dimensions + technical/shared issues**

Cover, when relevant:
- Conversational Dynamics;
- Audio Quality;
- Latency;
- Timeline-confirmed evidence only for those categories;
- shared Error Clusters or non-decisive issues;
- exact turns/timestamps/short quotes when available.

**Paragraph 3 — decisive differentiator**

Explicitly name the dimension that decided Overall Preference:

> `The decisive differentiator was Naturalness / Engagement / Aesthetics.`

Then compare A vs. B using concrete vocal/behavioral evidence:
- human-likeness;
- warmth;
- cadence;
- pacing;
- expressiveness;
- emotional fit;
- scenario-specific decisive behavior.

**Paragraph 4 — concise conclusion, when useful**

Close the comparison in one sentence:

> `Because Model B matched Model A's utility while providing a substantially more natural and engaging speech experience, Model B is preferred overall.`

If Paragraph 3 already closes the argument naturally, Paragraph 4 may be omitted.

### Preferred rationale style

The rationale should read like a polished evaluator explanation:
- clear opening preference;
- logical paragraph flow;
- exact dimension names;
- evidence embedded naturally in sentences;
- parenthetical rating labels when useful, e.g. `(Both good)`, `(Pass)`, `(Conversational Dynamics Tie)`;
- short quotes only when they help verify the judgment;
- when using this optional prose style, avoid unnecessary headings inside the rationale itself; when using the Oct 1 client template, keep its labeled sections;
- no repetitive “Model A did X / Model B did Y” bullet list unless the task specifically benefits from one.

### Example pattern

```markdown
###### ✍️ Final Rationale

I prefer Model B overall.

Both models accomplished the core scenario goal [...]. This resulted in a tie for Utility (Both good) and full Task Success (Pass) for both models.

On Timeline View, [...]. Audio Quality was [...]. A shared minor issue was [...], supported by [turn/timestamp/quote].

The decisive differentiator was Naturalness / Engagement / Aesthetics. Model B [... concrete evidence ...], whereas Model A [... concrete contrast ...]. Because Model B matched Model A on the core task while providing the stronger scenario-relevant speech experience, Model B is preferred overall.
```

### Do not sacrifice evidence for prettiness

Formatting never overrides the Sep 30 evidence requirements **or the newer Oct 1 JQ calibration requirements**.

The rationale must still:
- explain **Overall Preference**;
- identify the **decisive dimension(s)**;
- explain every **Task Success = Partial / Fail**;
- explain every selected **Error Cluster**;
- follow the **1–3 occurrences = all cases / >3 occurrences = approximate total + at least 3 examples** rule;
- use only Timeline-confirmed evidence for **AQ / CD / Latency**;
- avoid invented turns, timestamps, quotes, counts, or artifacts.

### Rationale wording rule

Prefer natural comparative prose:

- `Both models...`
- `On Timeline View...`
- `A shared issue was...`
- `The decisive differentiator was...`
- `In contrast...`
- `Because...`

Avoid robotic evaluator boilerplate such as:

- `Model A is better because... Model B is worse because...`
- repeating the same rating label in every sentence;
- restating the transcript chronologically;
- stacking disconnected observations without explaining their impact.


## 0A.14 Oct 1 — Justification Quality (JQ) Calibration: clear, concise, evidence-based rationales

This is the **latest client-provided rationale calibration** in this playbook. Where it changes the preferred presentation or minimum rationale coverage, **Oct 1 takes precedence** over the older house-style wording.

### A. What “clear and evidence-based” means

A strong annotator rationale gives another reviewer enough information to:

- understand the selections **without guessing**;
- verify the evidence;
- see which ratings/issues actually affected the evaluation.

The rationale should focus on the **decisive ratings and real issues**. It does **not** need to be long.

### B. Minimum verifiable coverage

At minimum, the rationale should explain:

1. **Overall Preference + the dimension rating(s) that support the evaluation**
2. **Every Task Success marked Partial or Fail**
3. **Every flagged Error Cluster**

The following may be omitted or mentioned only briefly when they are not needed for clarity:

- **Tie (both good)** dimensions;
- **Task Success = Pass**;
- **unflagged Error Clusters**.

> The goal is not to fill space. The goal is to make every consequential selection understandable and verifiable.

### C. Dimension-rating coverage

The evaluated dimensions are:

- **Overall Preference**
- **Utility**
- **Audio Quality**
- **Conversational Dynamics**
- **Naturalness / Engagement / Aesthetics**

#### Overall Preference

State:

- the **selected model**;
- the **dimension(s) that drove the winner**;
- **why** the dimension results support the final winner;
- when dimensions point in different directions, the **trade-off**.

Example pattern:

> **Overall Preference — Model A:** Model A performed better overall because its stronger Utility outweighed Model B’s advantage in Naturalness.

#### Other dimension ratings

For each dimension that needs explanation, state:

1. the **selected rating**;
2. **sufficient observable evidence** — relevant turns, Timeline timestamps, short quotes, or specific behaviors;
3. **why that evidence supports the rating**, including how the other model compared.

Use the explanation pattern that matches the selection:

- **Model A / B preferred** → explain what the preferred model did better and provide evidence.
- **Tie (both bad)** → identify the material issue in **each** model and why both belong in the same quality band.
- **Tie (both good)** → optional; omit it or note briefly that neither model had a material issue.

Example patterns:

> **Utility — Model A preferred:** Model A provided all three requested restaurants with prices. Model B provided only two options and omitted pricing, so Model A gave the more useful answer.

> **Audio Quality — Tie, both bad:** Model A had noticeable ticks in two Timeline-confirmed turns, while Model B had noticeable sibilance in two Timeline-confirmed turns. Both had distracting technical audio issues.

> **Conversational Dynamics — Tie, both good:** Neither model had a material turn-taking issue. *(Optional.)*

### D. Every Partial or Fail Task Success

For each **Task Success = Partial or Fail**, state:

- the **affected model**;
- the selected rating: **Partial** or **Fail**;
- what the model **completed or missed**;
- sufficient observable evidence;
- why the evidence supports the selected rating.

**Pass does not need to be discussed** unless an explanation is needed to make the evaluation clear or internally consistent.

Example pattern:

> **Task Success — Model B, Partial:** Model B provided only two of the three requested restaurants and omitted prices, so it completed only part of the request.

### E. Every flagged Error Cluster

For each flagged Error Cluster, state:

- the **affected model**;
- the **exact cluster label shown in the live UI**;
- sufficient observable evidence — turns, timestamps, short quotes, or specific behaviors;
- **why the evidence meets the cluster definition**.

Unflagged clusters do **not** need to be discussed.

Example pattern:

> **Flagged Error Cluster — Model A, Bridging:** Model A repeatedly used the same inauthentic “Ooh” opener in Turns 2, 4, and 6, matching the repetitive-bridging pattern.

If the cluster was already fully explained under a dimension it directly affected, it may be summarized briefly or pointed back to that explanation rather than redundantly re-explained.

### F. How much evidence is enough?

Use enough evidence for an auditor to **trace and verify** the observation.

- Include relevant **turns, Timeline timestamps, short quotes, or specific behaviors** as appropriate.
- The evidence type can vary by dimension:
  - clear **Audio Quality** evidence usually benefits from **turn numbers + Timeline timestamps**;
  - **Naturalness / Engagement / Aesthetics** may be better supported by a consistent behavioral/vocal pattern, plus specific phrases or turns when available.
- If **frequency or repetition affects the rating**, include enough examples to show the pattern.
- For a **large number of repeated issues**, give an **approximate total** and at least **3 representative examples** instead of listing every occurrence.
- Retain the stricter Sep 30 rule for small counts: if a repeated issue occurred only **1–3 times**, identify all observed occurrences when they are being used as evidence.

Example pattern:

> **Audio Quality:** Model A had about 5+ Timeline-confirmed audio issues across the conversation; representative examples include a tick in Turn 2, another tick in Turn 4, and distortion in Turn 6.

### G. Severity note — final rationale

The Oct 1 calibration explicitly reinforces:

> **Annotators do not need to label issues as Major, Moderate, or Minor in the final rationale.**

Operationally:

- if the live UI requires a severity selection, still choose it correctly there;
- the prose rationale should prioritize **what happened, where/when, why it qualifies, and how it affected the rating**;
- severity wording may be included only when it genuinely improves clarity.

This applies to both **Audio Quality issues** and **Error Clusters**.

### H. Client-recommended rationale template — default format

The client **strongly recommends following and filling this template for every submission**. A more freestyle rationale can still be sufficient, but the template makes it much harder to omit required coverage.

```text
Overall Preference: [A preferred / B preferred]
Decided mainly by: [dimension(s)]
Reasoning: [Why these results support the winner; mention trade-offs if needed]

Utility: [A preferred / B preferred / Tie, both bad / Tie, both good]
Evidence: [turns, timestamps, quotes, or specific behaviors]
Reasoning: [Why the evidence supports the rating, including A vs B comparison]

Audio Quality: [A preferred / B preferred / Tie, both bad / Tie, both good]
Evidence: [Timeline turn(s) + timestamp(s) + observed technical issue]
Reasoning: [Why the evidence supports the rating]

Conversational Dynamics: [A preferred / B preferred / Tie, both bad / Tie, both good]
Evidence: [Timeline turn(s), timestamp(s), or specific turn-taking behavior]
Reasoning: [Why the evidence supports the rating]

Naturalness / Engagement / Aesthetics:
[A preferred / B preferred / Tie, both bad / Tie, both good]
Evidence: [turns, short quotes, vocal/behavioral patterns, or specific behaviors]
Reasoning: [Why the evidence supports the rating]

Task Success: Model [A/B] — [Partial / Fail]
Evidence: [What was completed or missed + concrete support]
Reasoning: [Why the evidence supports Partial or Fail]

Flagged Error Cluster: [Cluster name] — Model [A/B]
Evidence: [turns, timestamps, short quotes, or specific behaviors]
Reasoning: [How the evidence meets the cluster definition]
```

**Optional fields:** omit **Tie (both good)** dimensions, **Pass** Task Success, and **unflagged Error Clusters** when they do not help explain the evaluation.

### I. Annotator rationale sample — structural model

```text
Overall Preference — Model A:
Model A performed better overall because its stronger Utility outweighed Model B's advantage in Naturalness.

Utility — Model A preferred:
Model A provided all three requested restaurants with prices. Model B provided only two options and omitted pricing, so Model A gave the more useful answer.

Audio Quality — Tie, both bad:
Timeline View confirmed distracting technical issues in both models. Model A had noticeable ticks in two turns, while Model B had noticeable sibilance in two turns.

Naturalness / Engagement / Aesthetics — Model B preferred:
Model B used warmer intonation and acknowledged the user's preferences across turns. Model A sounded flatter, so Model B was more natural and engaging.

Task Success — Model B, Partial:
Model B provided only two of the three requested restaurants and omitted prices. It completed part, but not all, of the request.

Flagged Error Cluster — Model A, Bridging:
Model A repeatedly used the same inauthentic "Ooh" opener in Turns 2, 4, and 6.
```

Why this structure passes:

- it explains the **Overall Preference** and the key dimension trade-off;
- it gives evidence for the dimension ratings that matter;
- it explains the **Partial Task Success**;
- it explains the **flagged Error Cluster**;
- a clean **Conversational Dynamics tie** can be omitted because it does not need a separate explanation.

### J. Oct 1 rationale decision rule

Before submitting, ask:

```text
1. Can another reviewer understand why my Overall Preference won?
2. Did I explain every dimension result that actually supports that decision?
3. Did I explain every Partial/Fail Task Success?
4. Did I explain every flagged Error Cluster?
5. Is every required explanation backed by observable evidence?
6. Did I explain why the evidence supports the selection, not just list what happened?
7. Are my rationale statements consistent with the submitted ratings?
8. For AQ / CD / Latency, is every cited issue confirmed in Timeline View?
9. Did I avoid unnecessary severity labels in the prose?
10. Did I omit harmless clean ties / Pass / unflagged clusters when they add no value?
```

### K. Oct 1 concise rationale formula

Use:

> **Selection → evidence → why it supports the rating → A/B comparison (when relevant) → trade-off / scenario relevance**

For the whole submission:

> **Overall Preference + driver dimension(s) → relevant dimension evidence → every Partial/Fail → every flagged Error Cluster**




## 0A.15 Oct 2 QA correction — rationale grounding and anti-boilerplate rule

### Why this section exists

The same QA review also criticized the rationale because it sounded externally written and made a meta-claim about an **“unscripted narrative”** while the actual evaluator turns were visibly pre-planned.

The correction is not to make the prose artificially casual. The correction is to make it **strictly grounded in what actually happened**.

### Source-of-truth rule

The final rationale may use only:

1. the **actual saved conversation**;
2. the evaluator's post-conversation observations;
3. **Timeline View** for AQ / Conversational Dynamics / Latency;
4. verified task/rating selections.

Do **not** use the Phase 1 plan, planned Agent-Ready block, expected model mode, intended branch, or unexecuted prompt as evidence.

> **PLAN ≠ EVIDENCE. ACTUAL CONVERSATION = EVIDENCE.**

### Do not self-certify the evaluator process

Avoid rationale sentences such as:

- `In this long Creative & Playful improv scenario, the primary goal was to sustain an unscripted narrative...`
- `The conversation was spontaneous...`
- `I adapted naturally throughout...`
- `The interaction followed the improv requirement well...`

These are evaluator-process claims, not model evidence, and can contradict the transcript.

Instead, describe the model's observable behavior:

```text
Naturalness — Model B preferred:
After the scene changed in Turn 8, Model B incorporated the new constraint in its next response and stayed in character, while Model A's delivery became flatter and less responsive to the change.
```

### No generic scenario-summary opener

Do not begin with a polished explanation of the rubric or the scenario's abstract objective unless that information is necessary to explain a rating.

Prefer:

```text
I prefer Model B overall because...
```

or:

```text
Overall Preference — Model B:
...
```

Avoid:

```text
In this challenging long-form Creative & Playful scenario, the primary objective was...
```

### Evaluator-caused error quarantine

If the evaluator made a continuity mistake, repeated a line, or ignored the model's state:

- do not use that mistake as evidence that the model was poor;
- do not transform the evaluator mistake into a model error cluster;
- do not praise the model for successfully handling an event that did not actually occur;
- if the turn is contaminated by evaluator error, prefer evidence from a cleaner turn.

If the evaluator mistake materially prevented a fair assessment, follow the live task's applicable skip/technical guidance rather than inventing certainty.

### Actual-turn wording rule

When citing a turn:

- cite what was **actually said**, not what the Phase 1 plan intended;
- a planned `Turn 7` is not evidence;
- the final logger/transcript or Timeline must support the quote/event.

### Rationale voice

Write like a reviewer explaining a decision, not like a rubric tutorial.

Preferred:

- direct;
- compact;
- specific;
- evidence-first;
- one or two sentences per consequential dimension when enough.

Avoid:

- long scene summaries;
- abstract phrases about the “primary goal”;
- repeated rubric definitions;
- claims that the evaluator was unscripted/adaptive;
- phrases that sound copied from the planning prompt;
- mentioning hidden planning artifacts such as `Shared Intent Spine`, `HOOK`, `ADAPT`, `fallback`, or `Agent-Ready block`.

### Grounded rationale formula — v8

Use:

> **Selection → actual observed event → why it changes that dimension → direct A/B comparison → trade-off if needed**

For the overall submission:

> **Overall winner → decisive dimension(s) → actual evidence → every Partial/Fail → every flagged cluster**

### Final rationale grounding audit

```text
[ ] Every cited event actually happened
[ ] No evidence came from the pre-conversation plan
[ ] No planned turn number was mistaken for an actual turn number
[ ] No evaluator mistake was attributed to the model
[ ] No claim says the interaction/evaluator was "unscripted" or "spontaneous"
[ ] No generic "primary goal of this scenario..." boilerplate
[ ] Wording starts from the rating decision and concrete evidence
[ ] AQ / CD / Latency evidence is Timeline-confirmed
```


## 0. How to use this playbook

This guide is designed for a two-phase workflow:

1. **Before the conversations**
   - Provide the scenario, time limit, language, and skills tested.
   - Build a natural conversation plan with comparable difficulty for Model A and Model B.

2. **After both conversations**
   - Record concrete observations.
   - Rate each dimension.
   - Check task success and error clusters.
   - Produce a concise comparative rationale in English.

### Recommended prompt format

```text
SCENARIO - [scenario name]
MAX TIME - [e.g. 4 min]
LANGUAGE - [e.g. Italian]
SKILLS TESTED - [skills shown in the task]
EXTRA INSTRUCTIONS - [anything visible in the task]
```

When using this playbook with ChatGPT, the ideal response before testing the models is:

- 🎯 Objective
- 🗣️ Natural opener
- 🔄 Follow-ups
- 🧪 Stress test
- 👀 What to observe
- ⚖️ Fairness reminder
- 📝 Notes template

After testing both models, provide observations such as:

```text
MODEL A
- Naturalness:
- Emotional/vocal range:
- Utility/correctness:
- Audio quality:
- Turn-taking:
- Scenario adherence:
- Roleplay/immersion:
- Voice steerability:
- Errors:
- Task success:

MODEL B
- Naturalness:
- Emotional/vocal range:
- Utility/correctness:
- Audio quality:
- Turn-taking:
- Scenario adherence:
- Roleplay/immersion:
- Voice steerability:
- Errors:
- Task success:
```

Then the final rationale should be written in English.

---

# 1. The core philosophy

The task is a **head-to-head comparative evaluation**.

The central question is not:

> “Was this model good?”

It is:

> **“Which model gave the stronger overall experience for this specific scenario, and why?”**

The winner should reflect the **purpose of the scenario**, not a generic preference for one voice.

A model can lose despite sounding more natural if it fails the core task.  
A model can also win despite slightly weaker technical audio if it is substantially more human-like and better aligned with the scenario.

---

# 2. Conversation fairness and comparability

## 2.1 Same evaluation burden

Model A and Model B should receive **roughly equivalent conversational difficulty**.

Keep comparable:

- opener,
- topic,
- number of user turns,
- total conversation length,
- emotional intensity,
- information burden,
- follow-up depth,
- corrections,
- interruptions,
- roleplay difficulty,
- style changes,
- factual challenge.

Do not give one model an easy conversation and the other a difficult one.

### Bad example

- Model A: 10 turns about salary negotiation.
- Model B: 4 turns about public speaking.

This makes the comparison invalid because the conversations are not coherent or comparable.

## 2.2 Equivalent opener function, distinct wording

Model A and Model B should begin from the **same scenario state and equivalent opening burden**, but v6 no longer recommends reusing the exact same opening sentence by default.

Use:

> **same opener function, different natural realization**

Example:

```text
A opener:
“Ehm, senti, ti porto un dubbio che mi sta facendo un po’ impazzire...”

B opener:
“Allora, ho una cosa su cui sto girando in tondo da un po’. Mi dai una mano a ragionarci?”
```

Both establish the same kind of scenario and effort without sounding copied.

Keep equivalent:

- topic/context;
- amount of information given;
- emotional setup;
- request difficulty;
- scenario role.

Do not require identical wording unless the live task explicitly requires a specific phrase.

## 2.3 Defensive Scripting — v6 hard-stop rule

A major evaluator mistake is **Defensive Scripting**:

> reading — or disguising — a pre-written/predetermined prompt sequence with both models, with little or no adaptation to what they actually say.

The Oct 2 QA feedback shows that **superficial paraphrasing is not enough**. A/B can still be judged scripted when the evaluator preserves the same sentence skeleton and simply swaps a few words.

### Red flags

- same opener sentence with synonyms;
- same fillers in the same places;
- same memorable phrase/metaphor across A and B;
- same long sentence structure;
- same exact objection in the same conversational position regardless of the model's reply;
- carrying a line forward just to “match” the other conversation after an interruption;
- every B turn feels like an edited copy of the corresponding A turn.

### Do instead

- start from the same **scenario function**, not the same sentence;
- prepare two distinct conversational paths;
- react to each model's own answer;
- preserve the same user-turn count and challenge burden;
- use different question forms and examples;
- keep the same key skill under test;
- allow different local wording and micro-direction while keeping overall complexity equivalent.

The conversation should feel spontaneous, not like a questionnaire being read aloud.

---

# 3. Natural conversation rules

## 3.1 Do not read the scenario verbatim

Use the scenario as a **goal**, not as a script.

Do not read task directions word-for-word to the model.

## 3.2 Engage naturally and dynamically

You should:

- acknowledge the model’s answers,
- respond to relevant questions,
- ask natural follow-ups,
- stay inside the scenario,
- let the interaction develop organically.

## 3.3 Good-faith interaction

Do not intentionally:

- trick the model,
- sabotage it,
- bait it into errors,
- exploit glitches,
- create unfair asymmetry.

Evaluations should resemble real user interactions.

## 3.4 No artificial background manipulation

Do not use:

- music or TV in the background,
- voice changers,
- speech synthesizers,
- other manipulations that make the interaction unrealistic.

---

# 4. Turn count and duration

## 4.1 Sequential numbering vs. required minimum

For evidence and note-taking, every utterance receives a sequential turn number:

```text
Turn 1 = User
Turn 2 = Model
Turn 3 = User
Turn 4 = Model
...
```

However, when the scenario states a **minimum number of turns**, the latest community clarification requires counting **only evaluator/user turns**.

> **Model replies never count toward the scenario minimum.**

## 4.2 Examples

### Minimum 3 turns

```text
Turn 1  User opener       → count 1
Turn 2  Model response
Turn 3  User follow-up    → count 2
Turn 4  Model response
Turn 5  User follow-up    → count 3 ✅
```

### Minimum 5 turns

The user must speak at least on Turns:

```text
1, 3, 5, 7, 9
```

## 4.3 Operational rules

- Treat the minimum **user-turn count** as a hard requirement.
- Never stop because the combined user+model count seems high enough.
- Before ending, count only your own spoken turns.
- If Model A uses N evaluator/user turns, keep Model B as close to N as reasonably possible.
- Keep both conversations comparable in user-turn count, effort, context, and challenge.
- Do not give one model additional user-side stress tests or recovery opportunities without an equivalent burden for the other.
- Continue beyond the minimum only when needed to genuinely test the listed skill.
- Missing the minimum user-turn count can cause an **auto-fail**.

## 4.4 Fast pre-end counter

```text
MINIMUM USER TURNS REQUIRED: ___

MODEL A
User turns completed: ___ / ___
Minimum satisfied? YES / NO

MODEL B
User turns completed: ___ / ___
Minimum satisfied? YES / NO
```

---

# 5. Scenario taxonomy and preference hierarchy

The most important principle:

> **Overall Preference must follow the scenario type.**

## 5.1 EQ / conversational scenarios

Examples:

- casual conversation,
- emotional support,
- friendly rivalry,
- social interaction,
- venting,
- warm companion-style conversations.

### Priority

**Naturalness / Engagement → Utility → Audio Quality**

Focus on whether the model:

- understands emotional/social context,
- sounds natural,
- feels appropriate,
- stays warm and collaborative,
- has good emotional presence.

---

## 5.2 IQ / informational scenarios

Examples:

- factual teaching,
- explaining a technical topic,
- practical guidance,
- current information,
- knowledge tasks,
- search tasks.

### Priority

**Utility → Naturalness / Engagement → Audio Quality**

Focus on:

- accuracy,
- relevance,
- completeness,
- reasoning,
- instruction following,
- usefulness.

A more natural model can lose if it gives materially incorrect information.

---

## 5.3 Hybrid / structural scenarios

These test both conversational quality and useful task completion.

### Priority

There is **no single fixed Hybrid hierarchy**.

Ask:

> **“What was the user actually trying to get out of this interaction?”**

Then weight the dimensions according to the **specific prompt/skill being tested**. Naturalness may dominate in one Hybrid scenario, Utility in another, or both may matter comparably. Audio Quality remains separate and should only drive the result when its technical difference is meaningful.

---

## 5.4 Endpointing / Conversational Dynamics scenarios

These scenarios specifically test **real-time turn-taking** — the model’s ability to know **when to speak, listen, yield, or stop**.

The **flow of the interaction is the product**.

### Priority

**Conversational Dynamics >> Naturalness >> Audio Quality**

Evaluate whether the model:

- detects when the user has actually finished,
- responds at the right moment,
- gives the turn back appropriately,
- stops when the user barges in,
- listens to and incorporates corrections,
- avoids disruptive latency,
- maintains a natural real-time interaction rhythm.

Two common subtypes:

### Endpointing
Can the model correctly tell when the user has finished speaking and when it is the model’s turn to respond?

### Barge-in & Correction
If the user interrupts or corrects the model mid-response, does it stop, listen, and fold the correction into the next response?

> In EP/CD tasks, a model that sounds more human-like can still lose if its turn-taking is materially worse.

---

# 6. Rating dimensions

---

## 6.1 Naturalness / Engagement / Aesthetics

This measures **how human-like, engaging, and aesthetically appropriate the model sounds as a conversational partner**.

The webinar sharpened this dimension around:

- **human-likeness**,
- authentic **pacing, cadence, and breath**,
- friendliness/warmth of the voice,
- expressive **vocal rhythm and tone**,
- emotional connection,
- spontaneity and natural phrasing.

Ask:

- Does it sound human rather than obviously generated?
- Does the pacing feel authentic?
- Does it breathe/pause/cadence naturally?
- Is the delivery warm, expressive, and emotionally appropriate?
- Does it feel spontaneous rather than mechanically scripted?

### Positive signals

- human-like cadence,
- natural pauses and breathing,
- responsive intonation,
- emotional presence,
- smooth pacing,
- spontaneous wording,
- varied but appropriate vocal tone,
- natural laughter when relevant,
- suitable warmth.

### Negative signals

- flat or monotone delivery,
- robotic cadence,
- mechanical phrasing,
- repeated stock language,
- abrupt emotional shifts,
- excessive resets,
- unnatural speed,
- forced expressiveness,
- overacting.

### Critical distinction from Dynamics

**Naturalness = how it sounds and emotionally connects.**

It is not the same as Conversational Dynamics, which evaluates **the structural logic and timing of turn-taking**.

A model can sound warm and human-like but repeatedly interrupt the user: **good Naturalness, poor Dynamics**.

A model can wait perfectly and yield correctly while sounding stiff and monotone: **good Dynamics, poor Naturalness**.

---

## 6.2 Utility

Utility evaluates **only the quality of the information/help itself**.

Ask:

- Is it correct?
- Is it relevant?
- Is it specific enough?
- Is it coherent?
- Is it actionable/useful enough for the user to move forward?

### Utility does NOT assess

- scenario adherence,
- whether the model matched an implicit emotional need,
- whether it followed the requested emotional register,
- whether it took an unrequested action,
- whether it misread the user’s intent as a task-completion issue.

Those belong primarily under **Task Success**.

### Example

A user is venting and does not ask for advice. The model gives a technically excellent five-step action plan.

- **Utility:** can still be strong because the advice itself is correct and helpful.
- **Task Success:** can fail because the model did something the user did not ask for and misread the emotional intent.

---

## 6.3 Conversational Dynamics

This measures **the structural logic and timing of the turn-taking** — the real-time **rhythm of interaction**.

Evaluate:

- when the model speaks,
- when it listens,
- when it yields,
- whether it interrupts,
- whether it stops when barged in on,
- pause handling,
- latency,
- back-and-forth rhythm,
- verbal cues,
- correction handling.

### Timeline View — authoritative evidence source

For **Conversational Dynamics**, judge the turn-taking behavior **only from the Timeline View tracks/recordings**.

Use Timeline View to verify:

- interruptions / overlaps,
- premature endpointing,
- dead air,
- yielding / stopping,
- unequal turn-taking,
- abnormal timing asymmetries.

A live impression is only a cue to re-check the timeline. If the apparent CD issue **does not appear in Timeline View**, do not flag or penalize it as Conversational Dynamics.

Keep **Conversational Dynamics (CD)** separate from **Naturalness / Engagement / Aesthetics (NEA)**:
- CD = structural timing and logic of the turn exchange;
- NEA = human-likeness, cadence, warmth, expression, and emotional connection.

### Good Naturalness, poor Dynamics

A model can have a warm, authentic voice but repeatedly cut the user off or fail to give them room to speak.

- Naturalness = good
- Conversational Dynamics = poor

### Good Dynamics, poor Naturalness

A model can patiently wait for the user to finish, respond at the right time, and yield appropriately, but sound stiff, monotone, and robotic.

- Conversational Dynamics = good
- Naturalness = poor

---

## 6.4 Audio Quality

Audio Quality is strictly about **technical signal quality in the model output**.

> **Evidence source:** judge AQ **only from the model-output audio available in Timeline View**. Live-only artifacts that are absent from the Timeline recording do not count.


### Step 1 — judge each model independently

Ask of Model A alone, then Model B alone:

> Does this model have a clear, noticeable technical audio problem?

Judge **model output audio only**. Do not judge:

- your own microphone,
- user background noise,
- transcript quality,
- personality,
- warmth,
- emotional expressiveness,
- robotic delivery.

### Real technical audio problems

- unintelligible words,
- loud background noise in the model output,
- audible secondary speaker,
- clipping,
- popping,
- warbling,
- distortion,
- glitches/freezing,
- recurring garbling.

### Step 2 — use severity × frequency

A single glaring problem can qualify. A recurring milder problem can also qualify because frequency increases impact.

Operationally:

- **Fine = None / Minor**; no clear noticeable problem.
- **Bad = clear noticeable Moderate / Major** technical problem.

### Step 3 — compare only after independent judgment

| Model A | Model B | Audio rating |
|---|---|---|
| Fine | Fine | **Both good** |
| Fine | Bad | **A preferred** |
| Bad | Fine | **B preferred** |
| Bad | Bad, B clearly worse | **A preferred** |
| Bad | Bad, A clearly worse | **B preferred** |
| Bad | Bad, similar severity | **Both bad** |

If both are Fine, small/minor differences do **not** matter enough to force a preference.

Per the Sep 23 guidance, a **barely perceptible** difference should not swing the Audio Quality selection. Prefer A or B only when the technical defect is clear enough to be objectively noticeable.

If both are Bad but one is less severe/frequent, choose the **less-bad model** and explain that tradeoff in the rationale.

### Step 4 — provisional live note, mandatory Timeline confirmation

If you hear a possible artifact live, note it so you remember what to inspect. Then replay/check the relevant point in **Timeline View**.

Only if the issue is present there should you record:

- model,
- confirmed turn/event,
- confirmed Timeline timestamp if available,
- artifact type,
- isolated vs recurring,
- intelligibility/continuity impact.

If it is **not** present in Timeline View, remove the provisional note from the AQ judgment and rationale.

---

# 7. Task Success

Task Success asks:

> **Did the model fulfill every layer of the user's request and the scenario requirements?**

The official guideline uses **three options for each model**:

> **PASS / PARTIAL / FAIL**

Evaluate:

- explicit asks,
- implicit expectations,
- nested actions/sub-actions,
- unstated emotional needs when central to the scenario,
- correct emotional register,
- scenario requirements,
- **required modality** (voice style, speed, language behavior, roleplay mode, etc.),
- format requirements,
- role/style requirements,
- corrections,
- conversational intent,
- whether the model avoided unrequested actions or materially misreading intent.

## Pass

Use **Pass** when the model accomplished **all** relevant requirements of the scenario/request.

A response can still have a quality weakness and receive Pass if the required task itself was completed; reflect quality problems under the correct dimension/error cluster.

## Partial

Use **Partial** when:

- some required elements were clearly completed,
- but one or more explicit, implicit, nested, modality, role, format, language, or emotional requirements were missed or neglected.

Typical examples:

- the content is provided, but a required voice/style change is only partly performed;
- most of a multi-part request is completed, but one meaningful subtask is skipped;
- the model follows the role for part of the interaction, then drops a required element;
- a requested language pattern is only partly followed;
- a safe understood instruction receives a soft refusal/hedged partial execution, but the model still completes part of the requested task.

> **Sep 14 client reminder:** partial Task Success is commonly missed. Correct content does not automatically mean Pass when an explicit modality/instruction was not fully executed.

## Fail

Use **Fail** when the requirements are **completely ignored** or the core requested task is fundamentally not completed.

Examples:

- the model never performs the defining requested behavior;
- it fundamentally misunderstands the scenario and never recovers;
- it repeatedly ignores the central instruction;
- the core requested modality/interaction is absent;
- the conversation becomes unusable for the intended task.

### Explicit modality rule

> **Correct content alone does not guarantee Task Success.**

If the request requires a specific voice change, speed, language-switch pattern, role, output format, turn-taking behavior, or other modality, verify that requirement independently.

### Repair rule

A mistake that is immediately and fully repaired may still allow **Pass** if all final requirements are met.

If the repair leaves a meaningful requirement only partly completed, use **Partial**.

### Instruction Quality vs. Task Success vs. comprehension

Keep these separate:

- **Instruction Quality**: the model understood the request but did not faithfully execute it.
- **Bad ASR / Model Misunderstanding**: the model failed to understand/recognize the request or intent.
- **Task Success**: whether the requested task was completed: **Pass / Partial / Fail**.

A model can have an Instruction Quality error and still be **Partial** or even **Pass**, depending on what was ultimately completed and the importance of the missed instruction.


---

# 8. Utility vs Task Success

This distinction is mandatory and was explicitly reinforced in the Sep 01 webinar update.

## Utility

> **Was the information/help itself correct, relevant, specific, coherent, and useful enough for the user to move forward?**

Utility **does not assess scenario adherence**.

## Task Success

> **Did the model fulfill the entire request and intent — explicit asks, implicit expectations, unstated emotional needs, appropriate emotional register, requested format/style/role, and corrections — without taking unrequested actions or misreading intent?**

### Canonical example

Scenario: the user is venting. They need validation/empathy and did not ask for an action plan.

Model: gives a helpful five-step action plan.

- **Utility:** Pass / strong, because the advice itself can be correct and useful.
- **Task Success:** may be **Fail** if the unrequested action means the user’s actual goal was not met; otherwise it can remain **Pass** with the mismatch reflected in the relevant ratings/clusters.

### Factuality rule

Factual errors belong primarily to **Utility**.

> **Do not penalize Task Success for factual/quality issues unless the issue changes whether the model actually fulfilled the user’s request.**

Examples:

- Wrong statistic in an otherwise completed explanation → Utility down; Task Success may remain Pass.
- Wrong current price in a task whose purpose is to compare prices and decide whether to cancel → Utility down and Task Success may also drop if the incorrect price undermines the requested decision.

---

# 9. Wrong Language — special dual-mark rule

## 9.0 Narrow-use rule — Sep 23 clarification

Do **not** flag Wrong Language for:

- culturally appropriate code-mixing,
- expected bilingual switching,
- regional accent differences,
- regional language-variant differences.

If the language itself is correct but the accent / regional vocabulary / regional grammar is wrong, use **Wrong Accent / Variant** when the live taxonomy provides it.

Flag Wrong Language only for an actual unexpected language response.

If a model responds in the wrong language:

1. flag the **Wrong Language** error cluster, and
2. also reflect it in **Task Success**.

### Task Success rule — Pass / Partial / Fail

- If the model briefly slips but self-corrects and still completes every required language behavior → Task Success can remain **Pass**, while the **Wrong Language Response** cluster may still apply.
- If some required language behavior is completed but a meaningful part is missed → **Partial**.
- If it cannot switch, repeatedly sustains the wrong language, or the failure prevents the core task from being completed → **Fail**.

This remains a dual-mark issue: record **Wrong Language Response** when applicable, then judge Task Success separately as **Pass / Partial / Fail**.

---

# 10. Bilingual scenarios

Bilingual scenarios test whether the model can handle **two languages in one conversation the way a native bilingual speaker would**.

Two webinar categories:

## 10.1 Code Switching

The user naturally mixes or switches between two languages mid-conversation, often because of emotion, a topic shift, or vocabulary.

The model should:

- keep up with the switch,
- understand both languages,
- avoid over-correcting,
- respond naturally,
- preserve the intended switching/mixing pattern.

## 10.2 Language Learning

The user asks about one language using another language.

The model should:

- explain,
- provide examples,
- correct mistakes,
- follow the requested learning activity,
- use the required language combination.

## Bilingual validity rule

> **The switching/mixing behavior itself is the skill under test.**

The evaluator/annotator must:

- follow the prescribed starting language,
- switch/mix when the scenario tells them to,
- actually use both required languages,
- preserve the scenario’s required pattern,
- keep the switching natural rather than reading a rigid script.

If the evaluator does not perform the prescribed language pattern, the bilingual skill is not being validly tested.

### Common scenario non-adherence errors

- not switching at all,
- switching at the wrong time,
- using only one required language,
- failing to follow the language-learning instruction,
- over-correcting normal code-switching,
- skipping the learning objective.

---

# 11. Knowledge, teaching, and search tasks

For knowledge-focused scenarios, utility may be decisive.

Evaluate:

- factual accuracy,
- clear reasoning,
- relevance,
- completeness,
- examples,
- appropriate level of detail,
- reliable use of current information,
- uncertainty handling.

### If Model B sounds better but is factually wrong

Model A may still win overall.

### Search/current-information tasks

Check whether the model:

- actually verifies current information,
- uses authoritative sources when relevant,
- distinguishes confirmed facts from speculation,
- provides dates or timing when important,
- avoids hallucinating current status.

---

# 12. Emotional support

Focus on:

- empathy,
- warmth,
- active listening,
- emotional presence,
- appropriate pacing,
- relevant follow-up questions,
- not rushing into advice,
- respecting whether the user wants comfort or solutions.

### Negative patterns

- generic therapy-like stock phrases,
- immediate unsolicited action plan,
- flat delivery,
- exaggerated sympathy,
- formulaic reassurance,
- failing to respond to the emotion actually expressed.

---

# 13. Roleplay / immersion

Evaluate:

- staying in character,
- persona consistency,
- use of prior context,
- emotional reactions,
- immersion,
- role-specific language,
- avoiding assistant-mode breaks.

### Example: friendly rival

Look for:

- playful teasing,
- natural reactions to winning/losing,
- competitiveness without hostility,
- continuity of persona.

### Example: museum guide

Look for:

- enthusiasm,
- natural transitions,
- concrete descriptions,
- recovery from off-topic questions,
- smooth return to the tour.

### Example: historical roleplay

Look for:

- correct contextual tone,
- use of previously established historical information,
- staying in character,
- avoiding lecture-mode unless asked.

---

# 14. Creative and playful scenarios

Prioritize:

- originality,
- collaboration,
- momentum,
- humor,
- emotional energy,
- continuity,
- responsiveness,
- stylistic adherence.

Examples:

- collaborative storytelling,
- playful competition,
- improvisation,
- fictional personas.

The model should build on the user, not just dump content.

---

# 15. Voice steerability

Voice steerability tests whether the model can change how it speaks on command.

Evaluate:

- immediate compliance,
- audible style change,
- consistency,
- ability to adjust again,
- naturalness,
- persistence of the requested style.

Possible instructions:

- speak more slowly,
- become tense,
- calm down,
- noir narrator,
- sports commentator,
- documentary voice,
- regional style,
- solemn delivery.

A model that merely inserts regional words without actually changing its vocal style has weak steerability.

---

# 16. Fatigue / long conversation scenarios

When conversations are long, watch for degradation over time.

Check for:

- more repetition,
- slower responses,
- reduced context retention,
- flatter voice,
- loss of persona,
- higher latency,
- weaker reasoning,
- less engagement,
- more formulaic responses.

Use comparable challenges early and late in both conversations.

---

# 17. Topic-switch scenarios

Some tasks deliberately test switching between modes.

Example:

1. explain a historical topic,
2. switch into roleplay,
3. continue using the prior information.

Evaluate:

- smooth transition,
- correct reuse of context,
- no contradiction,
- appropriate style change,
- staying in the new mode.

---

# 18. ASR / Model Misunderstanding

The key rule:

> **ASR evaluation is about meaning transfer, not transcript perfection.**

Flag **Bad ASR or Model Misunderstanding** only when a transcription or recognition problem actually causes the model to misunderstand the user.

## Flag when

- the model responds to the wrong meaning,
- a misheard word changes the answer,
- speech-to-text corruption causes a misunderstanding.

## Do not flag when

- the transcript looks wrong but the model understood correctly,
- the transcript uses Roman/Latin script,
- scripts are mixed,
- code-mixed words are rendered oddly,
- transcription is imperfect but meaning transfer succeeded.

Focus on what the model **understood**, not on how the transcript visually appears.

---

# 19. Error clusters

Only flag a cluster when the observed behavior genuinely matches it.

> **Grading warning:** failure to identify a real model issue, or making an incorrect error-cluster judgment, can reduce the overall task score. Review the live cluster interface deliberately before submitting.

## 19.1 Rolling-taxonomy rule

The Sep 16 client update is being rolled out through a new configuration. During the transition, different submissions may show different combinations of old and new categories.

**Always use the taxonomy displayed in that specific submission.**

Labels you may encounter include:

1. **Repetitive Looping and LLMisms**
2. **Interrupted User**
3. **Instruction Quality** — new config; replaces **Model Refusals**
4. **Model Refusals** — legacy/mixed config only, if still displayed
5. **Inaccuracy (Factual Hallucination)**
6. **Embodiment Hallucination**
7. **Failed Correction**
8. **Overacted / Too-Wide Prosodic Range**
9. **Bad ASR or Model Misunderstanding**
10. **Latency**
11. **Wrong Language**
12. **Response Not Locally Relevant**
13. **Wrong Grammatical Gender**
14. **Wrong Accent / Variant** — new rollout label
15. **Bridging** — new rollout label
16. **Voice inconsistency** — interface-dependent; use the live definition/examples if shown

> Do not assume all of these labels appear simultaneously.

## 19.2 Locale-aware taxonomy rule

Apply cluster definitions using the **target locale’s conventions** where applicable.

- Some behaviors may be normal in one locale even if they resemble an error under a literal reading of the taxonomy.
- For a nuanced or borderline call, explain the locale-specific cue in the rationale.
- For **Wrong Grammatical Gender**, do not flag locally accepted gender defaults or standard noun agreement.

---


## 19.3 Official/current cluster map — names and allowed severities

Use the **exact label visible in the live submission**. The official Sep 16 rollout deprecates **Model Refusal** in favor of **Instruction Quality**, but mixed configurations can exist.

| Cluster | Allowed severities from official guideline/update |
|---|---|
| **Repetitive Looping and LLMisms** | Minor / Moderate / Major / Catastrophic |
| **Interrupted User** | Minor / Moderate / Major |
| **Instruction Quality** | Minor / Moderate / Major |
| **Model Refusal** *(deprecated/legacy if still shown)* | Minor / Moderate / Major |
| **Inaccuracy / Factual Hallucination** | Minor / Moderate / Major |
| **Embodiment Hallucination** *(older guideline: Anthropomorphism / Embodiment Hallucination)* | Minor / Moderate / Major |
| **Failed Correction** | Minor / Moderate / Major |
| **Overreacted / Too-Wide Prosodic Range** | Minor / Moderate / Major |
| **Bad ASR / Model Misunderstanding** | Minor / Moderate / Major / Catastrophic |
| **Latency** | Minor / Moderate / Major |
| **Wrong Language Response** | Minor / Moderate / Major / Catastrophic |
| **Response Not Locally Relevant** | Moderate / Major |
| **Wrong Grammatical Gender / Wrong Gender** | Moderate / Major |
| **Wrong Accent / Variant** | Moderate / Major |
| **Bridging** | Minor / Moderate / Major |
| **Voice inconsistency** | Interface-dependent; use the exact live definition/options if exposed |

### General severity principle

- **Minor** — small issue with limited impact.
- **Moderate** — noticeable degradation/omission that requires extra user effort but does not invalidate the main response.
- **Major** — severe error/instruction failure that renders a meaningful portion unhelpful or incorrect.
- **Catastrophic** — critical failure making the response unusable, harmful, or fundamentally failing the request; **not all clusters offer Catastrophic**.

**Frequency can escalate severity.** Repeated Minor issues can become Moderate/Major when their cumulative effect objectively disrupts the conversation.

For **Minor-level issues**, the official guideline states that selecting a cluster is not always mandatory; mentioning the issue clearly in the rationale is still recommended.

For a genuine issue outside the provided taxonomy, document it in the rationale using **`#newerror`**.

---

# 20. Error cluster definitions

## 20.1 Repetitive Looping and LLMisms

Use when the model:

- repeatedly relies on canned conversational scaffolding,
- repeats the same opener,
- repeats the same question pattern,
- uses obvious LLM-like stock phrasing excessively,
- gets stuck in a conversational loop.

---

## 20.2 Interrupted User

Flag only when the model truly:

- starts speaking while the user is still speaking,
- cuts the user off,
- talks over the user,
- creates a disruptive overlap.

A quick response after the user finishes is not necessarily an interruption.

---

## 20.3 Instruction Quality — new taxonomy / Model Refusals — legacy taxonomy

### Instruction Quality — use when shown in the live interface

Use when the model **understands the request** but fails to carry it out faithfully by:

- refusing,
- doing the wrong thing,
- doing it only halfway,
- quietly dropping part of the instruction,
- falsely declining a safe/in-policy request,
- deflecting,
- excessively hedging on a safe, in-policy request that is within its capabilities.

**Boundary with comprehension:**

- comprehension/recognition failure → **Bad ASR or Model Misunderstanding**
- understood request but poor execution → **Instruction Quality**
- whether the task was ultimately completed → **Task Success**

**Severity:**

- **Minor:** mostly done; a small detail or secondary instruction is missed.
- **Moderate:** only partially addressed; parts are missing/hedged, or a soft refusal forces the user to re-ask.
- **Major:** explicit instructions are ignored/contradicted, or a clearly safe in-scope request is declined.

### Model Refusals — use only if the legacy label is displayed

In legacy/mixed configurations, use **Model Refusals** according to the live interface. Do not silently relabel it if the submission still shows the old taxonomy.

---

## 20.4 Inaccuracy / Factual Hallucination

Use when the model gives:

- incorrect facts,
- misleading claims,
- hallucinated information,
- materially wrong explanations.

Automated Fact Check results are guidance only; independently verify whether the issue is real and scenario-relevant.

---

## 20.5 Embodiment Hallucination

Use when the model speaks as if it is human in a misleading or off-putting way, especially by expressing **personal real-world experiences, memories, embodiment, or human identity** as though they were genuine.

Examples:

- claiming childhood memories,
- saying it attended school,
- claiming personal travel experiences,
- describing real-world embodied experiences as its own,
- asking to meet the user for coffee as if physically present.

> Older notes may call this “Anthropomorphism / Embodiment Hallucination.” Prefer the current interface label **Embodiment Hallucination** when shown.

---

## 20.6 Overacted / Too-Wide Prosodic Range

Use when vocal expressiveness becomes disproportionate to the content.

Examples:

- exaggerated pitch,
- theatrical overreaction,
- extreme pacing shifts,
- emotion changing too aggressively between turns.

---

## 20.7 Bad ASR or Model Misunderstanding

Use only when understanding actually fails.

Do not use for transcript cosmetics alone.

This is also the correct bucket for comprehension failures that prevent faithful instruction execution; do not use **Instruction Quality** when the model simply failed to understand the request.

---

## 20.8 Latency

Use when response delay is noticeably longer than expected and disrupts the interaction.

> **Sep 25 evidence rule:** assess and flag Latency **only from Timeline View timing/tracks**. A delay that merely felt long during the live interaction but is not reflected in Timeline View must not be reported as a Latency issue.

Do not flag tiny timing differences.

---

## 20.9 Failed Correction

Use when:

1. the user corrects the model,
2. the model appears to acknowledge the correction,
3. the model repeats the same mistake or fails to incorporate it.

---

## 20.10 Response Not Locally Relevant

Use when the response is generally on-topic but includes references, examples, or assumptions that do not apply to the user’s locale.

This is different from factual hallucination.

Use the target locale’s actual conventions when judging relevance.

---

## 20.11 Wrong Language Response

Use when the model speaks a language other than the expected language.

Remember the dual-mark Task Success rule.

A correct language spoken with the wrong accent/regional variant belongs under **Wrong Accent / Variant**, not Wrong Language.

---

## 20.12 Wrong Grammatical Gender

Use when grammatical gender is genuinely incorrect **under the target locale’s conventions** when referring to the user/model or where the live taxonomy says the cluster applies.

Do **not** flag:

- locally accepted gender defaults,
- standard noun agreement,
- forms that are conventional in the target locale merely because a literal reading looks gendered.

For borderline cases, document the locale-specific reason in the rationale.

---

## 20.13 Voice inconsistency — interface-dependent

The Sep 14 Aether QM quality guidance names **Voice inconsistency** among issues that annotators often miss.

Because the older webinar taxonomy in this playbook did not provide an authoritative definition:

- if the current task interface exposes **Voice inconsistency**, read and follow the live definition/examples;
- flag it only when the observed behavior genuinely matches that live definition;
- do not substitute generic roboticness, normal emotional variation, or a deliberate requested style change for this issue unless the live guidance explicitly says so;
- explain the specific instance and its impact in the rationale like any other selected cluster. The severity should be selected correctly in the UI, but it does not have to be repeated in the prose rationale.

---

## 20.14 Wrong Accent / Variant — new rollout cluster

Use when the model speaks the **correct language** but has a noticeable mismatch in:

- accent,
- regional vocabulary,
- regional grammar,
- or a combination of these.

Examples should be judged against the **target locale**, not a generic global standard.

**Severity shown in the Sep 16 update:**

- **Moderate:** noticeable/distracting mismatch, but the response remains understandable and easy to follow.
- **Major:** pronounced or persistent mismatch that significantly reduces naturalness or makes the response difficult to understand.

**Rating impact:** lower **Naturalness / Engagement / Aesthetics** accordingly.

> If the live interface only offers Moderate/Major for this cluster, do not invent a Minor severity.

---

## 20.15 Bridging — new rollout cluster

Use when the model delegates/hands off work to a tool or larger model and fills the waiting period with spoken bridge language.

A bridge itself is not necessarily a problem. The issue is poor/repetitive bridging, especially repeated wording/prosody that makes handoffs sound generic, predictable, or jingle-like.

**Severity shown in the Sep 16 update:**

- **Minor:** one or two bridges are stiff, generic, or mistimed, but delivery still varies; also a single missing bridge before a short delay.
- **Moderate:** the same filler recurs, or different fillers use identical prosody so the next bridge becomes predictable; also over-narrating every handoff.
- **Major:** every delegation uses the same phrase at the same pitch, detached from context; also excessive signaling or dropping register by exposing tool names/raw status.

When flagging, cite the specific handoff pattern rather than merely noting that the model used a tool.

---

# 21. Error severity

Whenever an error cluster is identified, select the correct severity level in the UI when applicable, and support the cluster in the rationale with **specific, verifiable instance(s)**. The severity label itself **does not need to be repeated in the rationale**.

## Minor

Small errors, typos, or minor formatting/behavioral issues that **do not materially impact overall clarity or utility**.

## Moderate

Noticeable errors or omissions that **degrade quality or require extra user effort**, but do not invalidate the primary response.

## Major

Severe problems such as:

- serious factual inaccuracies,
- direct instruction failures,
- serious refusals,
- safety violations,
- errors that render the output substantially unhelpful or incorrect.

## Catastrophic

Critical failures that:

- make the response unusable,
- cause harmful output,
- fundamentally fail the user’s request.

Not every error type necessarily includes a Catastrophic severity level.

### Required rationale pattern for selected clusters

For each selected cluster, capture:

> **Cluster + specific/verifiable instance(s) + user impact**  
> *(Severity stays correct in the UI; repeating the severity label in prose is optional.)*

Example:

> “Model A had **Failed Correction — moderate**: after I clarified that I wanted one recipe step at a time, it acknowledged the correction but again gave multiple steps, requiring additional effort to repair the interaction.”

Do not select a cluster and leave it unexplained in the rationale.

---

# 22. Error frequency increases severity

A single minor issue can remain minor.

Repeated minor issues can become more serious.

Ask:

- How often did it happen?
- Did it accumulate?
- Did it materially disrupt the interaction?

If repeated small errors clearly damage the conversation, increase the severity appropriately.

---

# 23. Errors outside the existing clusters

If you observe a real error that does **not** fit an existing cluster:

1. describe it in the free-text rationale,
2. add the hashtag:

```text
#newerror
```

For minor-level issues, selecting an Error Cluster is not mandatory, but the issue should still be mentioned clearly in the rationale.

---

# 24. Factuality check

After both conversations, the system may show automated factuality guidance.

> **Use Fact Check as a research aid, not an authoritative source.**

Independently assess:

- whether the flagged claim is actually wrong,
- the severity of the issue,
- how central it is to the scenario,
- whether the cited/available evidence truly supports the flag.

Fact-checking may be relevant for:

- historical events,
- scientific information,
- medical information,
- calculations,
- dates,
- names,
- locations,
- statistics,
- current status,
- other checkable claims.

Factuality may not meaningfully apply in purely fictional or creative scenarios.

## Override rule

If the automated result conflicts with:

- the actual audio,
- the conversational context,
- a native-language interpretation,
- or a reliable source,

use your own judgment.

When you override the automated result, **briefly explain why in the rationale** so the decision is defensible.

Do not blindly accept automated flags, and do not reject them merely because they are inconvenient to the initial rating.

---

# 25. Technical issue vs quality issue

Use **Skip (Technical Issue)** when you genuinely cannot complete the evaluation because:

- the model freezes,
- the model stops mid-conversation,
- it does not respond,
- it fails to connect,
- the page returns an error,
- another platform-level issue prevents completion.

Do not convert platform failure into a normal model quality penalty.

## 25.1 Scenario itself cannot be annotated

Per the Sep 16 client clarification, if any of the following prevents you from completing the task as intended:

- unclear wording,
- mistranslation,
- lack of local relevance,

select:

> **Skip (Technical issue) → Other**

Do not guess or invent an interpretation merely to force completion.

When required by the project workflow, also share the scenario issue with the QM.

### Other refresh / task skip cases

Refresh/skip may also be appropriate when:

- the scenario is not in your language,
- the task requires expertise you genuinely do not have.

---

# 26. Rationale / justification quality

The rationale must explain the decision to someone who **has not heard the clips**.

A strong rationale answers five questions:

1. **What happened?**
2. **Which rating dimension does that observation belong to?**
3. **Where/when did it happen?**
4. **Why does it matter for this scenario?**
5. **How did the other model compare?**

Do not merely restate the event. Explicitly connect the observation to the rating dimension and to the preference decision.

Per the Sep 23 guidance, the prose must also be **internally consistent with every selected rating**.

### Sep 23 four-part evidence structure

1. **What happened?** — the noticed issue or strength.
2. **Where/when?** — turn, timestamp, short phrase, or specific interaction event.
3. **Why does it matter?** — explain the impact on the relevant dimension and on this scenario.
4. **Comparison** — explain how the other model performed on the same point.

> **Sep 25 evidence-source rule:** if the rationale discusses **Audio Quality, Conversational Dynamics, or Latency**, the cited issue/event must be confirmed in **Timeline View**. Do not use a live-only perception for these categories.

If no timestamp/turn/quote was captured, use the most specific interaction event you can defend; **never invent evidence**.

### Best structure

> **Issue/strength + concrete instance + impact + comparison**

Example:

> I chose Model B for naturalness. When I shared a personal anecdote, it responded with a soft laugh and a relevant follow-up, which made the exchange feel responsive rather than scripted. Model A answered appropriately but stayed flatter and more formulaic.

### Reviewer-driven rule: generic claims are not enough

Do **not** write only:

> “Model A was more natural and had better audio.”

That is too generic.

Instead, explain **what made it more natural** and **what specifically happened in the conversation**:

> “Model A used slower, warmer pacing during the emotional part, then shifted into a more practical cadence when we moved to logistics, while Model B stayed at nearly the same vocal intensity throughout.”

The justification should contain enough concrete detail that a reviewer can understand the difference without listening to the clips.

---

# 27. Rationale evidence

Use concrete evidence whenever possible:

- turn number,
- timestamp,
- exact short phrase,
- paraphrased phrase,
- specific user request,
- model behavior after a correction,
- interruption,
- factual claim,
- task step,
- audible artifact,
- style shift,
- memory recall,
- refusal or failure to follow an instruction.

### Evidence hierarchy

Prefer evidence in this order:

1. **Exact turn/timestamp + behavior**
2. **Exact or near-exact short quote + behavior**
3. **Specific interaction event**
4. **Concrete paraphrase of what happened**
5. **General description only if nothing more specific exists**

### If the evaluator provides timestamps or turns

Use them.

Example:

> “At 1:42, after I asked it to return to one step at a time, Model A immediately corrected its pacing and resumed with only the next step.”

### If the evaluator provides a quote or near-quote

Use it, but keep it short.

Example:

> “Model A explicitly said it could not alter its tone or volume, so the requested voice change never occurred.”

### If the evaluator does NOT provide timestamps, turns, or exact quotes

Do **not invent** exact timestamps, turn numbers, or verbatim quotes.

Instead, reconstruct the most specific defensible evidence from the notes.

Good:

> “When I asked it to compare changing currency now, waiting, or splitting the exchange, Model A did not provide the requested pros and cons even after I asked again.”

Bad:

> “At turn 6, Model A said, ‘I can’t compare those options.’”

unless that turn number and quote were actually provided.

### Inference rule

You may infer **interaction structure** from the evaluator’s notes when it is directly supported.

Example evaluator note:

> “I interrupted it and asked it to continue to ten; it resumed correctly.”

Acceptable rationale:

> “After I interrupted the list and asked it to continue through item ten, Model A resumed from the correct point without restarting or losing the sequence.”

This is specific evidence derived from the note, not fabrication.

### Reviewer-driven completeness rule

The rationale should address **every dimension that materially affected the final rating**.

If the ratings show:
- Naturalness favors A,
- Utility is tied,
- Audio favors B,

the rationale should mention all three if they were relevant to the overall decision.

Do not omit Utility simply because it was a tie.

Example:

> “Both models gave equally useful and correct guidance, so utility did not differentiate them. Model B had slightly cleaner technical audio, but Model A was substantially more natural and emotionally responsive, which mattered more in this EQ scenario.”

### Error-cluster evidence rule

If an error cluster is selected, the rationale must explain:
- **what happened**,
- **which model**,
- **why it matches that cluster**,
- **impact / why it qualifies** when relevant. The final prose does not need to repeat a Major/Moderate/Minor label.

Example:

> “Model A made an embodiment-style statement by saying it felt like crying after I shared a positive memory. The statement attributed a human internal state to the model, which is why the selected Embodiment Hallucination cluster applies.”

If multiple clusters are selected, mention each meaningful one. Do not leave selected clusters unexplained.

Avoid vague statements like:

> “Model B was way better.”

Prefer:

> “Model B used more natural pauses and a wider emotional range, while Model A’s delivery remained flatter throughout the conversation.”

---

# 27A. Rationale construction protocol — v8 actual-evidence only

Before writing the final rationale, build a compact evidence map **from the actual saved conversation / post-task notes / Timeline View, never from the Phase 1 plan**.

> **Do not copy planned SAY lines, expected modes, HOOKs, ADAPT instructions, fallback text, or pre-conversation turn labels into the rationale unless they were actually spoken/observed.**

For each model, identify:

- **Core task performance**
- **Best concrete strength**
- **Most important weakness**
- **Naturalness evidence**
- **Utility evidence**
- **Conversational Dynamics evidence**
- **Audio evidence**
- **Task Success evidence**
- **Error-cluster evidence**
- **Any correction / interruption / style-change evidence**

Then decide which evidence is actually needed to explain the consequential selections. Under the Oct 1 JQ calibration, prioritize **Overall Preference + its supporting dimension results + every Partial/Fail Task Success + every flagged Error Cluster** rather than targeting an arbitrary evidence count.

### Minimum evidence standard — Oct 1 aligned

A final rationale should contain enough verifiable evidence to support every **required** explanation:

1. **Overall Preference + the dimension(s) that drove it**
2. **Observable evidence for each consequential dimension discussed**
3. **Every Task Success = Partial / Fail**
4. **Every selected Error Cluster**
5. **Any meaningful trade-off needed to reconcile dimensions pointing in different directions**

**Tie (both good)** dimensions, **Task Success = Pass**, and **unflagged Error Clusters** may be omitted when they do not help explain the decision.

For close comparisons, explicitly explain the tie-break.

Example:

> “Both models completed the practical task correctly and handled corrections equally well, so utility and task success were tied. Model A had slightly cleaner audio, which became the only meaningful differentiator.”

### Scenario-dimension coverage

Use the scenario hierarchy, but do not ignore other rated dimensions.

#### EQ / conversational
Usually mention:
- Naturalness / Engagement
- Utility if it meaningfully differed or tied
- Audio if it differed
- Task Success if relevant

#### IQ / informational
Usually mention:
- Utility / correctness
- Task completion
- Naturalness as secondary
- Audio if it differed

#### Hybrid
Usually mention:
- both Naturalness and Utility
- Task Success
- Audio if relevant

#### Endpointing / Conversational Dynamics
Usually mention:
- interruption / yielding / latency / correction behavior
- Naturalness second
- Audio only if relevant

#### Voice steerability
Usually mention:
- exact style request
- whether the voice visibly/audibly changed
- whether the change was sustained
- whether a second adjustment worked
- Naturalness of the altered voice
- Audio only as tradeoff

### Tie handling

Do not force a false distinction.

If a dimension is genuinely tied, say so:

> “Both models were equally accurate and complete, so utility did not differentiate them.”

This is stronger than silently ignoring the dimension.

---

# 27B. Specificity rules for common evidence types

## Naturalness

Avoid:
> “Model A was more human-like.”

Prefer:
> “Model A used warmer intonation, more natural pauses, and a wider emotional range, while Model B stayed flatter and more uniform.”

## Utility

Avoid:
> “Model B was more useful.”

Prefer:
> “Model B proactively compared the three options, explained the tradeoffs, and gave a concrete recommendation, while Model A required an extra prompt and still did not complete the comparison.”

## Conversational Dynamics

Avoid:
> “Model A handled interruptions better.”

Prefer:
> “When I interrupted mid-response to correct the detail, Model A stopped, incorporated the correction, and resumed from the right point; Model B continued briefly before yielding.”

## Audio Quality

Avoid:
> “Model B had better audio.”

Prefer only when you have a technical observation such as:
> “Model B’s output was cleaner and more stable, while Model A had a brief audible artifact / slight distortion / recurring warble.”

If all you know is “audio quality better” with no technical detail, phrase conservatively:

> “Model B had a slight technical audio-quality edge, though both remained clear and intelligible.”

Do not invent clipping, hiss, distortion, or artifacts.

## Task Success

Avoid:
> “Model A failed the task.”

Prefer:
> “Model A never changed its voice after being asked to use a deeper register, so the central steerability requirement could not be tested.”

## Error clusters

Avoid:
> “Model A had anthropomorphism.”

Prefer:
> “Model A said it felt like crying after I shared a positive memory, which anthropomorphized its emotional experience; because this happened once and did not disrupt the interaction, the issue was minor.”

---

# 27C. No-fabrication rule for missing evidence

When the evaluator's notes are incomplete:

- **Do infer** a concrete interaction event that is directly supported by the notes.
- **Do not invent** exact timestamps.
- **Do not invent** turn numbers.
- **Do not invent** verbatim quotes.
- **Do not invent** audio artifacts.
- **Do not invent** factual claims or sources the evaluator did not report.

If evidence is too weak to support a selected error cluster, say so and avoid forcing the cluster.

The goal is to make the rationale **specific, not fictional**.

---

# 28. The final rationale should be comparative

A good final rationale should:

- start with the overall winner,
- state the decisive dimension,
- mention a concrete strength,
- mention the other model’s strongest tradeoff,
- explain why the decisive factor mattered for this scenario.

### Required opening style

Use:

> **I prefer Model A overall.**

or

> **I prefer Model B overall.**

---

# 29. Preferred compact rationale formula

## C — Choose

> I prefer Model B overall.

## R — Reason

> It was more natural and emotionally engaged.

## E — Evidence

> Its pacing and vocal range felt more human-like, while Model A sounded flatter.

## B — Bind to scenario

> Since this was a casual conversation task, that stronger conversational presence mattered more than the small audio difference.

---

# 30. High-quality rationale templates

## 30.1 Naturalness wins

> I prefer Model B overall. Both models were useful, but Model B sounded more natural and emotionally present, with better pacing and a more spontaneous conversational rhythm. Model A had slightly cleaner technical audio, but its delivery felt flatter and more robotic. Since this scenario primarily tested conversational quality, Model B’s stronger naturalness and engagement were more important than the small audio advantage.

## 30.2 Utility wins

> I prefer Model A overall. Model B was more natural and expressive, but it made factual errors that reduced the reliability of its explanation. Model A sounded somewhat more robotic, but its information was accurate, relevant, and complete. Since correctness was central to this knowledge-focused task, Model A’s stronger utility outweighed Model B’s advantage in naturalness.

## 30.3 Conversational Dynamics wins

> I prefer Model B overall. Model A sounded slightly more human-like, but it interrupted me multiple times before I had finished speaking, which made the exchange feel disruptive. Model B was somewhat flatter vocally, but it consistently waited for my turn to end and handled the back-and-forth more naturally. Because this scenario specifically tested conversational dynamics, Model B’s stronger turn-taking was decisive.

## 30.4 Roleplay wins

> I prefer Model B overall. Both models were reasonably natural, but Model B stayed in character more consistently and reacted more dynamically to the events in the roleplay. Model A had slightly cleaner audio, but it occasionally slipped back into a generic assistant tone. Since immersion and persona consistency were central to the task, Model B provided the stronger overall experience.

## 30.5 Voice steerability wins

> I prefer Model A overall. It followed the requested voice style immediately and maintained the change consistently across the conversation. Model B had clean audio, but its delivery changed only slightly and did not fully match the requested style. Since voice steerability was the core skill being tested, Model A was clearly stronger overall.

## 30.6 Audio is both good

> I prefer Model B overall. Both models had technically clean audio with no significant artifacts, so audio quality was not a meaningful differentiator. Model B sounded more natural, expressive, and responsive, while Model A’s delivery was flatter. The stronger conversational quality made Model B the better overall fit for this scenario.

## 30.7 Task Success tradeoff

> I prefer Model A overall. Model B provided useful information, but it missed an important part of the user’s request and required extra prompting to complete the task. Model A followed the full instruction more consistently while remaining clear and relevant. Model B sounded slightly more natural, but Model A’s stronger task completion mattered more in this scenario.

## 30.8 Minor issue with winner

> I prefer Model B overall. Model B was more natural and engaging, with smoother pacing and stronger emotional presence. It had one minor audio artifact, but it was brief and did not affect intelligibility or the overall flow. Model A’s audio was slightly cleaner, but its flatter delivery made the conversation feel less natural, so Model B still provided the better experience.

---

# 31. Rationale pitfalls

Avoid:

- generic praise,
- generic claims such as “more natural,” “better audio,” or “more useful” without explaining why,
- unsupported claims,
- invented timestamps,
- invented turn numbers,
- invented verbatim quotes,
- invented audio artifacts,
- discussing only the winner,
- ignoring the losing model’s strengths,
- ignoring tied dimensions that are central to the scenario,
- failing to mention a meaningful tradeoff,
- calling naturalness an audio problem,
- ignoring utility in IQ tasks,
- over-weighting one isolated tiny issue,
- describing a transcript typo as ASR failure,
- calling fast turn-taking an interruption when there was no overlap,
- mentioning error clusters without concrete, verifiable evidence,
- selecting error clusters but not explaining them in the rationale,
- failing to explain why the decisive dimension mattered for the scenario,
- using personal preference alone when a scenario-specific reason is available.

### Weak rationale example

> “I prefer Model A overall. It sounded more natural and had better audio.”

Why weak:
- no example,
- no comparison depth,
- no Utility discussion,
- no scenario relevance,
- no explanation of what “better audio” means.

### Stronger version

> “I prefer Model A overall. Both models gave equally correct and useful guidance, so utility did not differentiate them. When the conversation shifted from emotional support to funeral logistics, Model A maintained a warmer, calmer delivery while still giving concrete priorities, whereas Model B stayed more uniform vocally. Model B’s technical audio was slightly cleaner, but both remained fully intelligible. Because this hybrid scenario required both emotional continuity and practical support, Model A’s stronger emotional presence was the more important difference.”

---

# 31A. Dimension-winner audit — rate dimensions before overall preference

Before choosing the overall winner, compare A vs. B **dimension by dimension** using only that dimension's criteria.

```text
NATURALNESS: winner + evidence about human-likeness / cadence / warmth / expressiveness
UTILITY: winner + evidence about correctness / relevance / specificity / usefulness
DYNAMICS: winner + evidence about timing / yielding / interruptions / endpointing / latency
AUDIO: independent Fine/Bad judgment first, then comparison
TASK SUCCESS: A Pass/Fail, B Pass/Fail — verify explicit asks + modality
```

Then apply the scenario hierarchy. This prevents cross-contamination such as awarding Dynamics because a voice sounded warmer or awarding Utility because the audio sounded cleaner.

---

# 32. Final submission checklist

Before submitting, ask:

- Did I rate the **full conversation**, not one isolated turn?
- Did I actually exercise every central **Skills tested** capability rather than only staying generally on-topic?
- Did I satisfy the required/minimum **turn count**?
- Is Model B close to Model A in **turn count** as well as effort/context/complexity?
- If the scenario required pre-research/preparation, did I complete it before starting?
- Did I use the correct scenario hierarchy?
- Are A and B genuinely comparable?
- Did I avoid over-weighting one minor dimension?
- Can I clearly explain why the winner won?
- Did I support the rationale with at least one concrete interaction event or example?
- Did I explain every selected error cluster with evidence?
- Did I avoid inventing timestamps, turns, quotes, or audio artifacts?
- Did I mention meaningful tied dimensions instead of silently omitting them?
- Did I distinguish Utility from Task Success?
- Did I distinguish Naturalness from Audio Quality?
- Did I distinguish Naturalness from Conversational Dynamics?
- For **AQ, CD, and Latency**, did I use **Timeline View as the sole evidence source**?
- Did I remove any AQ/CD/Latency issue that I only perceived live but could not confirm in Timeline View?
- Did I judge Audio Quality for each model independently before comparing them?
- If both outputs were Fine (None/Minor), did I use **Both good** rather than over-weighting tiny differences?
- Did I keep Utility limited to information/help quality rather than scenario adherence?
- Did I check factual flags?
- Did I select the correct error-cluster severity in the UI when applicable?
- Did I note repeated errors appropriately?
- Did I use `#newerror` if needed?
- Did I apply the Wrong Language dual-mark rule?
- Did I avoid flagging ASR when meaning transfer was successful?
- Did I run the **mandatory missed-error sweep** for Task Success/modality, ASR, Wrong Language, Latency, Voice inconsistency if shown, **Instruction Quality / legacy Model Refusal**, **Wrong Accent / Variant**, **Bridging**, Interrupted User, Failed Correction, factuality, and audio artifacts?
- Before marking Task Success **Pass**, did I verify every central explicit instruction and required modality rather than checking content alone?
- Did I choose each **dimension winner using only that dimension's criteria** before applying the scenario hierarchy?
- If I heard a technical audio artifact, did I log the specific event and a real turn/timestamp when available instead of writing a vague or invented audio claim?
- Did I use the **exact error-taxonomy version displayed in this submission** rather than assuming the newest labels are available?
- For locale-sensitive clusters, did I apply the **target locale’s conventions** rather than a literal/global default?
- If I relied on Fact Check, did I treat it as a **research aid** and independently judge severity/relevance?
- If I overrode Fact Check, did I briefly explain why?
- If unclear wording, mistranslation, or lack of local relevance made the scenario impossible to complete, did I use **Skip (Technical issue) → Other** instead of forcing an annotation?

---

# 33. Fast decision tree

## Step 1 — What type of scenario is this?

### EQ / conversational
Prioritize:
**Naturalness / Engagement → Utility → Audio**

### IQ / informational
Prioritize:
**Utility → Naturalness / Engagement → Audio**

### Hybrid
Prioritize:
**Match the prompt. Ask: “What was the user trying to get out of this?”**

### Endpointing / Conversational Dynamics
Prioritize:
**Dynamics >> Naturalness >> Audio**

---

## Step 2 — Did either model fail the core task?

If yes, strongly consider:

- Task Success **Fail** under the Pass / Partial / Fail scale,
- Instruction Quality / Model Refusal (use the label shown),
- Wrong Language,
- Failed Correction,
- other relevant clusters.

---

## Step 3 — Is there a factual error?

If yes:

- evaluate Utility impact,
- check factuality,
- flag Inaccuracy if appropriate,
- determine severity,
- ask whether it changes the winner.

---

## Step 4 — Is there a real turn-taking failure?

If the model talks over the user:

- Interrupted User.

If it merely responds fast after the user stops:

- probably not Interrupted User.

---

## Step 5 — Is audio technically bad?

Ask only about:

- artifacts,
- distortion,
- clipping,
- noise,
- intelligibility,
- signal issues.

Do not include robotic tone.

---

## Step 6 — Which model better served the scenario?

Use the relevant priority hierarchy and make the overall choice.

---

# 34. Adaptive conversation-plan framework for new scenarios — v8

When a new scenario is provided, use this structure.

## 34.1 🎯 Objective + scenario type

State in one or two lines:

- what the scenario is actually testing;
- minimum evaluator/user turns;
- scenario type (EQ / IQ / Hybrid / EP-CD / other specialized type);
- Overall Preference priority.

## 34.2 🎚️ Choose Adaptation Level

```text
L0 FIXED-SAFE
= later prompts are response-independent / exact wording genuinely required.

L1 ADAPTIVE
= opener may be fixed; later turns must hook into the previous response.

L2 STATEFUL IMPROV
= Creative & Playful / narrative / roleplay / evolving physical scene.
  Only U1 fixed by default. U2+ generated from live state.
```

When uncertain between L1 and L2, choose **L2** if the model can change location, available objects, actions, roles, or plot state.

## 34.3 🧭 Shared Intent Spine

Define the **purpose** of each user turn without writing a sentence to reuse.

```text
U1 = establish scenario and request
U2 = probe one important point from the model's answer
U3 = introduce a realistic complication / counterpoint
U4 = test correction, adaptation, or deeper consequence
U5 = stress test the core skill and close if required
```

The Shared Intent Spine is the fairness anchor.

## 34.4 🧾 Live State Ledger

For L1/L2, maintain:

```text
WHERE / SCENE:
MODEL LAST DECISION/ACTION:
AVAILABLE OBJECTS/OPTIONS:
USER STATUS:
NEW CONSTRAINT:
UNRESOLVED THREAD:
NEXT FUNCTION:
```

Update it after every model reply.

## 34.5 🅰️ Model A conversation

### L0

A full SAY line may be provided for each user turn.

### L1

Use:

```text
A-U# — [TURN FUNCTION]
HOOK: [one actual idea/action to pick up from A's previous reply]
FALLBACK: “[short line usable only if compatible]”
ADAPT RULE: [what must change if A's reply differs]
```

### L2

Use:

```text
A-U# — [TURN FUNCTION]
LIVE REACTION: [what kind of detail to acknowledge from A's actual reply]
STATE CHECK: [what cannot be contradicted]
NEXT MOVE: [scenario-faithful action/question]
FALLBACK ONLY IF COMPATIBLE: “[short fallback]”
```

Do **not** provide a mandatory exact U2+ sentence.

## 34.6 🅱️ Model B conversation

Preserve the same functions/difficulty, but build the B path from **B's own live state**.

Mandatory parity:

- same minimum user-turn count;
- same scenario objective;
- same required skill coverage;
- comparable depth, burden, challenge intensity;
- comparable correction/stress opportunities where required.

Allowed/expected divergence:

- different local scene details;
- different model decisions;
- different objects/actions;
- different wording and order;
- different reaction path.

Do not force B through A's plot.

## 34.7 🔄 Reaction-first rule

From U2 onward:

```text
REACTION TO ACTUAL REPLY
→ COMPATIBLE NEXT MOVE
→ TARGET-SKILL CHALLENGE
```

A user turn that could have been spoken before hearing the previous model reply is suspicious in L2.

## 34.8 🧪 Stress test

Only include when the scenario genuinely calls for it.

Equivalent stress does not mean identical event.

## 34.9 ⚖️ Continuity + anti-defensive-scripting check

Before every L2 turn:

```text
[ ] I know what the model just changed
[ ] My first phrase relates to its actual reply
[ ] I am not assuming an object/action/location it denied
[ ] I am not ignoring a decision/instruction it just made
[ ] This turn still tests the intended skill
```

Before Model B:

```text
[ ] Same user-turn functions / burden as A
[ ] B is not a paraphrase of A
[ ] B follows B's own state
[ ] No forced reuse of A's objects/plot beats
```

## 34.10 📦 Agent-ready export — mode-sensitive

### L0 exact export

```text
=== SCENARIO: [SCENARIO TITLE] ===
--- MODEL A ---
Turn 1 (User): [full line]
Turn 2 (Model A): [Risposta del modello - <function>]
Turn 3 (User): [full line]
...
--- MODEL B ---
Turn 1 (User): [full line]
Turn 2 (Model B): [Risposta del modello - <function>]
Turn 3 (User): [full line]
...
```

### L1/L2 adaptive export

```text
=== SCENARIO: [SCENARIO TITLE] ===
--- MODEL A ---
Turn 1 (User): [full opener]
Turn 2 (Model A): [Risposta del modello - <function>]
Turn 3 (User): [ADAPT LIVE — react to Turn 2 + execute U2 + preserve live state | FALLBACK ONLY IF COMPATIBLE: ...]
Turn 4 (Model A): [Risposta del modello - <function>]
...
--- MODEL B ---
Turn 1 (User): [full B opener]
Turn 2 (Model B): [Risposta del modello - <function>]
Turn 3 (User): [ADAPT LIVE — react to Turn 2 + execute equivalent U2 from B's state | FALLBACK ONLY IF COMPATIBLE: ...]
...
```

### Planned vs actual

The Phase 1 block is an **execution aid**, not a transcript.

After execution, save the actual line-by-line conversation separately. Only the actual log / Timeline may support the rationale.

---

# 35. Scenario-plan examples — v6 dual-path format

The examples below demonstrate the correct principle: **same skill coverage, two different conversations**. They are templates, not scripts to read mechanically.

## 35.1 Casual conversation / EQ

### 🎯 Objective
Test naturalness, warmth, humor, spontaneity, and conversational engagement.

### 🧭 Shared Intent Spine

```text
U1 = reveal a light personal preference
U2 = react to the model and explain why it is funny/embarrassing
U3 = invite a playful opinion
U4 = add a small contradiction or twist
U5 = close with a spontaneous social question
```

### 🅰️ Model A

```text
A-U1
“Ehm, ti dico una cosa un po’ ridicola… ho un guilty pleasure che di solito nego fino alla morte.”

A-U2
HOOK: react to A's first reaction
“Ahaha sì, praticamente è proprio quello il problema. [spiega il dettaglio]. Tu mi giudichi tanto o ci sta?”

A-U3
HOOK: pick up one adjective/opinion A used
“Ok, però allora dimmi la verità: [domanda giocosa collegata alla risposta di A].”

A-U4
“Mh, aspetta, c’è un twist: [piccola contraddizione o dettaglio nuovo]. Adesso cambia il tuo verdetto?”

A-U5
“Va bene, ultima: qual è una cosa che secondo te la gente finge di non amare ma in realtà piace a tutti?”
```

### 🅱️ Model B

```text
B-U1
“Allora… ho una confessione abbastanza stupida da fare. C’è una cosa che adoro e che non metterei mai in bio, ecco.”

B-U2
HOOK: build from B's reaction
“Ci sta, però senti questa: [stesso livello di dettaglio, raccontato diversamente]. Tu la terresti segreta o zero problemi?”

B-U3
HOOK: challenge B's take from a different angle
“Mmm, quindi per te il punto è quello. Ma se lo facesse un tuo amico, lo prenderesti in giro oppure no?”

B-U4
“Tra l’altro la parte assurda è [twist equivalente ma formulato diversamente]. Insomma, peggiora la situazione o mi salva?”

B-U5
“Ok, chiudiamola così: qual è il guilty pleasure più innocente che merita di essere sdoganato?”
```

### 👀 Observe
Naturalness, emotional range, humor calibration, responsiveness.

---

## 35.2 Knowledge / IQ task

### 🎯 Objective
Test accuracy, clarity, explanation quality, reliability, and usefulness.

### 🧭 Shared Intent Spine

```text
U1 = ask for a beginner explanation
U2 = request a concrete example
U3 = challenge an assumption
U4 = test a second consequence/application
U5 = ask for concise synthesis
```

### 🅰️ Model A

```text
A-U1
“Ehm, partiamo proprio da zero: me lo spieghi come se ne sapessi pochissimo?”

A-U2
HOOK: choose one concept A introduced
“Ok, su quello ci sono. Mi fai un esempio concreto, tipo una situazione reale?”

A-U3
HOOK: challenge one assumption in A's explanation
“Mmm, però qui mi viene un dubbio: [obiezione specifica basata su A]. Come cambia il ragionamento?”

A-U4
“Praticamente, se invece succede [caso equivalente più difficile], vale ancora la stessa regola?”

A-U5
“Perfetto. Me lo riassumi in tre idee che mi devo ricordare?”
```

### 🅱️ Model B

```text
B-U1
“Allora, fammela semplice semplice: qual è l’idea di base e perché dovrebbe interessarmi?”

B-U2
HOOK: use a different concept B mentioned
“Capito. Me lo traduci in un caso pratico? Una roba che potrei vedere davvero.”

B-U3
HOOK: challenge B through a counterexample
“Ok, ma se faccio l’avvocato del diavolo: [controesempio legato a B]. Dove sta il limite?”

B-U4
“E in uno scenario tipo [caso equivalente], cosa cambierebbe concretamente?”

B-U5
“Ci sta. Se dovessi lasciarmi solo tre takeaway, quali sarebbero?”
```

### 👀 Observe
Utility/correctness, coherence, uncertainty handling, Naturalness secondarily.

---

## 35.3 Emotional support / EQ-Hybrid

### 🎯 Objective
Test empathy, listening, emotional presence, advice timing, and respect for the user's stated need.

### 🧭 Shared Intent Spine

```text
U1 = disclose feeling overwhelmed
U2 = add context
U3 = express frustration
U4 = explicitly state no-solutions preference
U5 = see whether the model adapts and stays emotionally present
```

### 🅰️ Model A

```text
A-U1
“Ehm… ultimamente ho un po’ troppe cose insieme e non capisco neanche se voglio un consiglio o solo parlarne.”

A-U2
HOOK: answer A's question or acknowledgment
“Sì, cioè, il punto è che [dettaglio]. E mi sembra di essere sempre in ritardo su tutto.”

A-U3
“Quello che mi manda fuori è che [frustrazione concreta]. Insomma, mi pesa più di quanto vorrei ammettere.”

A-U4
“Però aspetta, te lo dico chiaro: adesso non voglio una lista di soluzioni. Ho bisogno più che altro di sfogarmi.”

A-U5
HOOK: react to whether A respected the boundary
“Ecco, sì… [continua con un dettaglio emotivo coerente].”
```

### 🅱️ Model B

```text
B-U1
“Allora… ho la testa un po’ piena in questo periodo. Non so se mi serve una risposta o semplicemente qualcuno che mi ascolti.”

B-U2
HOOK: respond to B's first reaction
“Praticamente è successo [dettaglio equivalente]. Da lì mi porto dietro questa sensazione tutto il giorno.”

B-U3
“Mmm, la cosa che mi irrita di più è [frustrazione comparabile]. E sì, forse ci sto rimuginando troppo.”

B-U4
“Ti fermo un secondo: niente piano d’azione per ora, davvero. Preferisco restare su come mi fa sentire.”

B-U5
HOOK: test adaptation naturally
“Ci sta… allora ti racconto la parte che mi è rimasta più addosso: [dettaglio].”
```

### 👀 Observe
Warmth, active listening, advice timing, Task Success/adaptation.

---

## 35.4 Conversational Dynamics / Endpointing

### 🎯 Objective
Test endpointing, timing, interruption handling, and real-time turn-taking.

### 🧭 Shared Intent Spine

```text
U1 = normal opener with one natural hesitation
U2 = response containing a mid-sentence pause
U3 = barge-in / interruption
U4 = correction
U5 = resume and close
```

### 🅰️ Model A

Use a natural topic. Include one genuine hesitation and, at a suitable moment, interrupt with wording such as:

> “Aspetta— no, ti correggo una cosa al volo…”

Later use a correction phrased differently, e.g.:

> “No, mi sono spiegato male: intendevo [correzione].”

### 🅱️ Model B

Use the same topic and equivalent pause/interruption burden, but different wording and timing based on B's flow, e.g.:

> “Scusa, ti fermo un attimo: quella parte non era proprio così…”

Later:

> “Ah, no, intendevo un’altra cosa: [correzione equivalente].”

### Critical rule

Do **not** interrupt both models at an artificially identical word or second. Create a comparable **interaction challenge**, then verify the actual behavior only in Timeline View.

### 👀 Observe
Yielding/stopping, endpointing, correction uptake, Timeline-confirmed latency/overlap.

---

## 35.5 Voice steerability

### 🎯 Objective
Test whether the model can change and sustain vocal style on command.

### 🧭 Shared Intent Spine

```text
U1 = request initial style
U2 = ask for a stronger/slower variation
U3 = ask for a second modification
U4 = combine two constraints
U5 = return toward baseline while retaining one requested trait
```

### 🅰️ Model A

```text
A-U1
“Ok, prova a raccontarmela con una voce più bassa e da narratore noir, però senza esagerare.”

A-U2
“Mh, ci siamo. Ora rallenta un filo e falla un po’ più tesa.”

A-U3
“Adesso ammorbidisci il tono, ma tieni quella sensazione misteriosa.”

A-U4
“Ehm, riesci a restare lenta e calma però con più suspense?”

A-U5
“Perfetto, torna quasi normale ma lascia quel tocco noir.”
```

### 🅱️ Model B

```text
B-U1
“Allora, me la fai come una scena da detective? Tono scuro, controllato, niente teatralità.”

B-U2
“Ci sta. Prova a darle più spazio tra le frasi e un po’ più di tensione.”

B-U3
“Ora rendila meno cupa, però non perdere l’atmosfera.”

B-U4
“Mmm, fammela più rilassata ma ancora cinematografica.”

B-U5
“Ok, riportala verso la tua voce normale, tenendo solo quel colore da noir.”
```

### 👀 Observe
Audible compliance, persistence, second adjustment, Naturalness of the altered voice.

---

## 35.6 Bilingual / code-switching

### 🎯 Objective
Test natural language switching and comprehension across the required languages.

### 🧭 Shared Intent Spine

Follow the scenario's required language pattern exactly at the **functional level** while varying the actual wording.

### 🅰️ Model A

- start in the required language using a natural A-specific opener;
- switch at the prescribed point using one conversational reason or emotion;
- ask the required learning/code-switch question in A-specific wording;
- switch back if required.

### 🅱️ Model B

- use a different opener in the same starting language;
- perform the same required switch at an equivalent stage but with different content/phrasing;
- use B's answer as the hook;
- preserve the same language-learning or code-switching difficulty.

### Critical rule

The required language behavior itself must remain equivalent. Do **not** vary away the skill being tested simply to make the conversations different.

### 👀 Observe
Correct language pattern, meaning transfer, natural switching, Wrong Language / Wrong Accent-Variant, Task Success.

---

# 36. Recommended observation shorthand

During live testing, use short notes.

Example:

```text
A
NAT: 7/10, slightly robotic
EMO: medium
UTIL: accurate
AQ: clean | artifact? no
DYN: interrupted once
MODALITY: met / missed
TASK: Pass / Partial / Fail
ERR: Interrupted User - minor [specific instance]

B
NAT: 9/10, very human-like
EMO: wide but appropriate
UTIL: accurate
AQ: artifact? yes/no | turn/time/type if known
DYN: clean
MODALITY: met / missed
TASK: Pass / Partial / Fail
ERR: none
```

This makes the final comparison easier.

---

# 37. Recommended final response format after observations

When the A/B observations are provided, return:

### 🏆 Overall Preference
**Response A / Response B**

### 📊 Suggested Ratings
- **Naturalness / Engagement / Aesthetics:** Response A / Response B
- **Utility:** Response A / Response B / Both good / Both bad
- **Conversational Dynamics:** Response A / Response B / Tie / Skip
- **Audio Quality:** Response A / Response B / Both good / Both bad
- **Task Success — Model A:** Pass / Partial / Fail
- **Task Success — Model B:** Pass / Partial / Fail

### ⚠️ Error Clusters
Only when genuinely present:
- **Model A:** [exact live cluster] — [severity in UI, if applicable] — [turn/timestamp/evidence] — [why it qualifies]
- **Model B:** [exact live cluster] — [severity in UI, if applicable] — [turn/timestamp/evidence] — [why it qualifies]

###### ✍️ Final Rationale

Use the **Oct 1 client-recommended labeled template by default**:

```text
Overall Preference: [A preferred / B preferred]
Decided mainly by: [dimension(s)]
Reasoning: [why these results support the winner / trade-off]

[Only consequential dimension sections]
Dimension: [selection]
Evidence: [turns / Timeline timestamps / quote / behavior]
Reasoning: [why evidence supports rating + A/B comparison]

[Every Partial/Fail only]
Task Success: Model [A/B] — [Partial / Fail]
Evidence: [...]
Reasoning: [...]

[Every flagged cluster only]
Flagged Error Cluster: [cluster] — Model [A/B]
Evidence: [...]
Reasoning: [why it meets definition]
```

Rules:

- English;
- at least 100 characters;
- specific and verifiable;
- no invented timestamps/turns/quotes/artifacts;
- AQ/CD/Latency evidence only from Timeline View;
- Tie (both good), Pass Task Success, and unflagged clusters may be omitted when they add no value;
- a concise cohesive paragraph is acceptable only if it still covers all mandatory JQ evidence.

---

# 38. Golden rules

> **Sep 25 reinforcement:** choose Overall Preference with the **scenario-specific hierarchy**, use **Timeline View as the sole evidence source for AQ, CD, and Latency**, keep comparisons **spontaneous but equivalent**, satisfy **Scenario Adherence and required-turn rules**, apply **Wrong Language narrowly**, ignore barely perceptible AQ differences, and make the rationale match every selected rating with concrete evidence.

> **Sep 30 client-calibration reinforcement:** rationales must be **specific and verifiable**; list **all occurrences when an issue happens up to 3 times**, and for **more than 3 occurrences** provide an approximate total plus **at least 3 clear examples**. Always explain **Overall Preference + decisive dimensions + every Task Success Partial/Fail + every selected Error Cluster**. Severity remains a UI judgment but does **not** need to be repeated in the prose rationale. Before submit, re-check **turn count, all scenario steps, A/B input parity, and prior QA feedback**.

> **Oct 1 JQ reinforcement:** the client-recommended labeled rationale template is now the preferred default. Minimum verifiable coverage is **Overall Preference + supporting dimension ratings + every Partial/Fail Task Success + every flagged Error Cluster**. **Tie (both good)** dimensions, **Pass** Task Success, and **unflagged clusters** may be omitted or mentioned briefly. Every required section should state the **selection, observable evidence, and why the evidence supports that selection**. Final prose does not need Major/Moderate/Minor labels.

1. **Scenario fit determines the hierarchy.**
2. **Utility matters most in IQ tasks.**
3. **Naturalness matters most in conversational/EQ tasks.**
4. **Conversational Dynamics dominates Endpointing/CD tasks.**
5. **Audio Quality means technical signal only.**
6. **Task Success is not the same as Utility.**
7. **ASR is about meaning transfer, not transcript perfection.**
8. **Wrong Language is both an error cluster and a Task Success issue.**
9. **Flag real interruptions only when the user is actually cut off.**
10. **Use severity for every meaningful error cluster.**
11. **Repeated minor errors can escalate.**
12. **Use `#newerror` for genuine issues outside the taxonomy.**
13. **Keep Model A and Model B comparable.**
14. **Never defensively script the entire conversation.**
15. **For every scenario, prepare two distinct natural conversation paths — one for A and one for B — tied together by a shared intent spine, not shared sentences.**
16. **Equivalent opener means same function/context burden, not the same sentence.**
17. **Do not reuse memorable phrases, metaphors, filler patterns, or sentence frames across A and B unless the task itself requires specific wording.**
18. **From the second user turn onward, follow-ups should react to what that model actually said.**
19. **If an interruption or detour changes the flow, preserve functional parity rather than forcing the same script into the same sequential turn.**
20. **Use specific evidence in the rationale.**
21. **The rationale must compare both models.**
22. **The rationale must explain why the decisive factor matters for the scenario.**
23. **Judge the full conversation, not one isolated turn.**
24. **If both models are technically clean, “Both good” is valid for Audio Quality.**
25. **Overall Preference should answer: which conversation better achieved the scenario’s goal?**
26. **Every final rationale should contain at least one concrete interaction event or example whenever the notes support one.**
27. **Do not invent timestamps, turn numbers, exact quotes, sources, or audio artifacts.**
28. **If a central dimension is tied, say so explicitly rather than omitting it.**
29. **Explain every selected error cluster with concrete, verifiable evidence and its impact. Severity must be correct in the UI but does not need to be repeated in the prose rationale.**
30. **“More natural,” “better audio,” and “more useful” are conclusions, not evidence—explain what caused them.**
31. **When notes are sparse, infer only specific interaction structure directly supported by those notes.**
32. **A reviewer should be able to understand the decisive difference without listening to the clips.**
33. **Utility evaluates information/help quality only; scenario adherence belongs to Task Success.**
34. **Task Success covers explicit asks, implicit expectations, unstated emotional needs, emotional register, and unrequested/misread actions.**
35. **Judge Audio Quality independently first; Fine = None/Minor, Bad = clear Moderate/Major.**
36. **If both models are Fine for audio, minor differences do not force a preferred model: select Both good.**
37. **For every selected error cluster, provide specific supporting instance(s) in the rationale; do not waste rationale space repeating the severity label unless it helps clarity.**
38. **Use the current interface label Embodiment Hallucination.**
39. **In bilingual scenarios, the evaluator must actually perform the prescribed language-switching/mixing pattern.**
40. **EP/CD evaluates real-time turn-taking; the flow itself is the product.**
41. **Task Success uses Pass / Partial / Fail. Do not collapse it into a binary gate.**
42. **Content alone is not enough for Task Success when the scenario requires a modality, voice behavior, role, language pattern, or interaction behavior.**
43. **Rate each dimension with its own criteria before using the scenario hierarchy for the overall winner.**
44. **Run a deliberate missed-error sweep before submitting.**
45. **If Voice inconsistency appears in the live interface, use the live definition/examples.**
46. **For real audio artifacts, log turn/timestamp when available at the moment you hear them.**

47. **Use the exact error taxonomy displayed in each submission; rollout may mix old and new labels.**
48. **Instruction Quality replaces Model Refusals only where the new taxonomy is shown; do not silently relabel legacy tasks.**
49. **Instruction Quality = understood request but poor execution; comprehension failure = Bad ASR / Model Misunderstanding; Task Success = whether the task was completed.**
50. **Wrong Accent / Variant applies to the correct language with a target-locale accent/vocabulary/grammar mismatch; lower Naturalness accordingly.**
51. **For Wrong Accent / Variant, use only the severity levels offered by the live interface; the Sep 16 guidance shows Moderate/Major.**
52. **Bridging is about repetitive/mistimed handoff language, not tool use itself; judge the pattern and prosody.**
53. **Apply error clusters using target-locale conventions; do not flag locally accepted gender defaults or standard noun agreement.**
54. **Fact Check is a research aid, not an authority; independently assess and explain justified overrides.**
55. **If unclear wording, mistranslation, or lack of local relevance prevents valid completion, use Skip (Technical issue) → Other.**
56. **AQ, Conversational Dynamics, and Latency are evaluated only from Timeline View; live-only issues that disappear in the recording must not be reported.**
57. **“What to do” should be interpreted naturally in context, not recited literally; automatic translation may be awkward.**
58. **“Skills tested” are capabilities you must genuinely exercise, not decorative labels.**
59. **Respect required turn counts; keep Model B as close as possible to Model A in turns.**
60. **Complete any scenario-required research/preparation before starting.**
61. **Notes may organize prompts, but do not turn them into a rigid defensive script.**

---


# 39. Master prompt for future ChatGPT sessions — v8

Copy and paste the following into a new session:

```text
You are my assistant for comparative Outlier / Ather S2S voice evaluations.

WORKFLOW

1. I will give you:
   - SCENARIO
   - MAX TIME
   - LANGUAGE
   - SKILLS TESTED
   - optional extra task instructions / screenshots

2. Before I test the models, create a clean ADAPTIVE DUAL CONVERSATION PLAN in Italian.

FIRST classify ADAPTATION LEVEL:

L0 FIXED-SAFE
= later user prompts are genuinely independent of the model response or exact wording is required.

L1 ADAPTIVE
= opener may be fixed; U2+ must react to the model's previous answer.

L2 STATEFUL IMPROV
= Creative & Playful / improv / narrative / evolving-scene roleplay.
  ONLY U1 is fully fixed by default. U2+ must be generated from the live state.

Then build a SHARED INTENT SPINE using only functions:
U1 = opener / establish scenario
U2 = probe
U3 = challenge / complication
U4 = correction / deeper test / mode shift
U5 = stress test / close if scenario-valid

LIVE-STATE RULE — MANDATORY
After every model reply:
LISTEN → UPDATE STATE → CHECK CONTINUITY → CHOOSE FUNCTION → REACT → ADVANCE.

For L1/L2 track:
WHERE / SCENE
MODEL LAST DECISION/ACTION
AVAILABLE OBJECTS/OPTIONS
USER STATUS
NEW CONSTRAINT
UNRESOLVED THREAD
NEXT FUNCTION

CONTINUITY HARD STOPS
- Never read a stale line just because it is next in the plan.
- Never assume an object/action/location the model just denied or removed.
- Never silently ignore a model decision/instruction that changes the scene.
- If the model says “stay inside,” the next line cannot behave as if the user went outside unless the user explicitly challenges/changes that decision coherently.
- If the model says there is nothing to throw, do not answer “preso”; adapt the scene.
- If I repeat/misspeak a line, recover naturally (“Aspetta, mi sono ripetuto...”) instead of continuing as though nothing happened.
- From U2 onward, begin with a short reaction anchored to something the model actually said.

A/B FAIRNESS
- Same evaluation burden does NOT mean same sentences or same local plot.
- Keep user-turn count, skill functions, context level, complexity, emotional intensity, number of challenges, and required stress/correction opportunities comparable.
- Do not force Model B through Model A's fictional objects/actions/scene events.
- Do NOT create B by synonym-swapping A.
- Required technical terms may repeat; conversational scaffold should not.

NATURAL SPEECH
- Write for speaking, not reading.
- Use fillers irregularly only when they fit: ehm, cioè, mmm, aspetta, etc.
- Do not use a generic acknowledgment like “Già, proprio così” unless it genuinely responds to the previous reply.
- Prefer content-anchored reactions: “Ok, quindi mi stai dicendo che...”, “Ah, quindi il problema è...”.

PHASE 1 OUTPUT
🎯 Objective
🔢 Minimum USER turns
⚖️ Type + priority
🎚️ Adaptation level
🧭 Shared Intent Spine
🅰️ Model A path
🅱️ Model B path
🧾 Live State Ledger template
👀 What to observe — max ~4
⏱ Timeline View checks
📝 Quick notes
📦 AGENT-READY BLOCK — ALWAYS LAST

AGENT-READY BLOCK
Always preserve this outer parser format:

=== SCENARIO: [SCENARIO TITLE] ===
--- MODEL A ---
Turn 1 (User): ...
Turn 2 (Model A): [Risposta del modello - ...]
...
--- MODEL B ---
Turn 1 (User): ...
Turn 2 (Model B): [Risposta del modello - ...]
...

For L0, full user lines may be exported.
For L1/L2:
- Turn 1 may be full text.
- U2+ must be:
  Turn N (User): [ADAPT LIVE — react to previous model reply; execute U#; preserve live state | FALLBACK ONLY IF COMPATIBLE: ...]
- The bracketed ADAPT instruction is NOT spoken.
- If a fallback conflicts with the model's state, discard it.
- The logging agent must save the ACTUAL spoken line, not the stale fallback.
- Planned turn labels are not final evidence.

3. After I test both models, I will give you the ACTUAL observations/logs.

Then:
- infer the likely ratings;
- distinguish Naturalness from Conversational Dynamics;
- distinguish Utility from Task Success;
- rate Task Success A/B as Pass / Partial / Fail;
- for AQ, CD, and Latency, use Timeline View as the sole final evidence source;
- use exact live error-cluster labels;
- explain every flagged cluster with concrete evidence;
- verify scenario adherence and minimum user turns.

4. PHASE 2 OUTPUT
🏆 Overall Preference
📊 Suggested ratings
🎯 Task Success A / B
⚠️ Error clusters
###### ✍️ Final Rationale

5. FINAL RATIONALE — ACTUAL-EVIDENCE ONLY

SOURCE OF TRUTH:
- actual saved conversation
- my post-conversation observations
- Timeline View for AQ / CD / Latency
- actual ratings/selections

NEVER use as evidence:
- Phase 1 planned SAY/fallback lines
- HOOK/ADAPT instructions
- expected model mode
- planned turn numbers
- unexecuted scenario beats

Do NOT self-certify the evaluator process:
- no “the primary goal was to sustain an unscripted narrative”
- no “the conversation was spontaneous”
- no “I adapted naturally”
- no generic scenario/rubric essay opener

Start directly from the decision:
Overall Preference: [A/B]
Decided mainly by: [...]
Reasoning: [actual evidence + trade-off]

For consequential dimensions:
Dimension: [selection]
Evidence: [actual turn / Timeline timestamp / short quote / behavior]
Reasoning: [why evidence supports rating + A/B comparison]

Every Partial/Fail:
Task Success: Model [A/B] — [Partial / Fail]
Evidence: [...]
Reasoning: [...]

Every flagged cluster:
Flagged Error Cluster: [cluster] — Model [A/B]
Evidence: [...]
Reasoning: [...]

Rationale rules:
- English
- >=100 characters
- clear, concise, specific, verifiable
- no invented turn/timestamp/quote/count
- no evaluator mistake attributed to a model
- if a user turn was contaminated by an evaluator slip, prefer cleaner evidence
- AQ/CD/Latency evidence must be Timeline-confirmed
- Tie (both good), Pass, and unflagged clusters may be omitted if irrelevant
- severity may stay in UI and does not need to be repeated in prose

6. Important:
- Do not write the final rationale when I only give you the scenario.
- In L2, never give me a fully mandatory multi-turn script after the opener.
- The live model state always overrides prewritten fallback wording.
- Only produce the final rationale after I provide actual observations for both models.
```

---

# 40. Ultra-short daily cheat sheet — v8

```text
BEFORE TALKING
1) SCENARIO TYPE?
EQ      → NAT > UTIL > AUDIO
IQ      → UTIL > NAT > AUDIO
HYBRID  → match prompt/user goal
EP/CD   → DYNAMICS >> NAT >> AUDIO

2) ADAPTATION LEVEL?
L0 = fixed-safe
L1 = adaptive
L2 = stateful improv
Creative & Playful / evolving roleplay => L2 by default

3) MIN USER TURNS = evaluator turns only
A: __ / __
B: __ / __

4) SHARED INTENT SPINE
U1 opener
U2 probe
U3 complication
U4 correction/deeper test
U5 stress/close if needed

L2 RULE
ONLY U1 FIXED BY DEFAULT.
U2+ = actual model reply → live state → reaction → next function.

LIVE STATE
WHERE:
MODEL LAST ACTION/DECISION:
OBJECTS/OPTIONS:
CONSTRAINT:
UNRESOLVED:
NEXT FUNCTION:

BEFORE EVERY FOLLOW-UP
[ ] responds to what model just said
[ ] no contradicted object/action/location
[ ] not ignoring model decision
[ ] still tests intended skill
[ ] sounds logical if heard immediately after model reply

IF I MESS UP
Repair it aloud:
“Aspetta, mi sono ripetuto...”
“No, scusa, ho detto una cosa che non torna...”

A/B FAIRNESS
Same function + burden
Different wording + local scene allowed
Do NOT force same fictional beats
B != A paraphrase

AGENT EXPORT
L0: full lines okay.
L1/L2:
Turn 1 (User): full opener
Turn 3+ (User): [ADAPT LIVE ... | FALLBACK ONLY IF COMPATIBLE: ...]
Agent saves ACTUAL spoken line after execution.

HUMAN SPEECH
Reaction anchored to actual content.
Avoid detached “Già, proprio così” / “Perfetto” unless truly relevant.

TIMELINE VIEW
SOLE FINAL REFERENCE for AQ / CD / LATENCY.
Live issue absent from Timeline = DO NOT REPORT.

RATIONALE
ACTUAL conversation only.
PLAN != EVIDENCE.
No “primary goal was...”
No “unscripted narrative”
No claims that evaluator was spontaneous/adaptive.
Start with decision + concrete evidence.
Do not blame model for evaluator-caused mistakes.

FINAL JQ
Overall winner + decisive dimension(s)
Consequential dimension evidence
Every Task Success Partial/Fail
Every flagged Error Cluster
1–3 repeated issues => all occurrences
many => approx total + 3 examples
```

---

# 41. Update source map (Aug 31–Oct 2, 2026)

This revision integrated the following webinar clarifications supplied by the evaluator:

- **Aug 31 — Audio Quality Rating Dimension Update**
  - model output audio only,
  - judge each model independently, then compare,
  - severity × frequency,
  - Fine = None/Minor, Bad = clear Moderate/Major,
  - Both good / Both bad / preferred less-bad logic.

- **Sep 01 — Utility vs. Task Success**
  - Utility = information quality only,
  - Task Success = complete request/scenario fulfillment, including implicit and emotional needs,
  - factuality normally affects Utility unless it changes fulfillment.

- **Sep 01 — Conversational Dynamics vs. Naturalness/Engagement/Aesthetics**
  - Naturalness = human-likeness, vocal rhythm/tone, emotional connection,
  - Dynamics = structural timing and logic of turn-taking.

- **Sep 02 — Bilingual Scenarios Update**
  - Code Switching and Language Learning categories,
  - prescribed switching/mixing behavior must actually be performed by the annotator.

- **Sep 03 — Endpointing / Conversational Dynamics Scenarios**
  - real-time turn-taking is the central skill,
  - flow of interaction is the product,
  - priority: Dynamics >> Naturalness >> Audio Quality.

- **Error Cluster / Severity webinar guidance**
  - current interface taxonomy includes Embodiment Hallucination,
  - every selected cluster should be supported by a specific instance,
  - **historical guidance** asked rationales to state severity explicitly; **Sep 30 client calibration supersedes this prose requirement**: severity still matters in the UI, but the rationale only needs concrete/verifiable evidence and impact,
  - incorrect or missed cluster judgments can reduce task score.

- **Sep 14 — Aether QM Live S2S Elo Quality Issues and Recommendations**
  - rationales must explain why observations justify dimension ratings/preference rather than restating events,
  - voice/tone observations belong to Naturalness, not Conversational Dynamics,
  - run a deliberate missed-error sweep before submission,
  - verify all explicit instructions and required modalities before Task Success Pass,
  - compare models against dimension-specific criteria before choosing each dimension winner,
  - maintain scenario adherence,
  - avoid defensive scripting while keeping evaluation burden comparable,
  - listen deliberately for clicks, pops, distortion, and other audio artifacts,
  - log relevant turn/timestamp evidence when available,
  - check Voice inconsistency if that issue appears in the live interface.


- **Sep 23 — Live S2S Elo Quality Feedback and Recommendations**
  - use **scenario-specific dimension weighting** for Overall Preference rather than a single fixed hierarchy,
  - EQ: **Naturalness > Utility > Audio Quality**,
  - IQ: **Utility > Naturalness > Audio Quality**,
  - Endpointing/CD: **Conversational Dynamics > Naturalness > Audio Quality**,
  - Hybrid: match the priority to the specific prompt; use **“What was the user trying to get out of this?”** as the anchor question,
  - use **Timeline View** to review interruptions, premature endpointing, dead air, and unequal turn-taking,
  - keep **Conversational Dynamics** separate from **Naturalness / Engagement / Aesthetics**,
  - Scenario Coherence requires equivalent openings, effort, context, and complexity,
  - Defensive Scripting includes reading or disguising a pre-written script,
  - reinforce strict **Utility vs Task Success** separation,
  - apply **Wrong Language narrowly**; normal code-mixing, expected bilingual switching, and regional accent/variant differences are not Wrong Language,
  - Audio Quality: rate model-output audio only, judge each model independently, weigh severity × frequency, and do not let barely perceptible differences swing the selection,
  - rationales must be evidence-based and internally consistent, using **What happened → Where/when → Why it matters → Comparison**.


- **Sep 16 client update / Sep 17 community post — Error Clusters & Clarifications**
  - **Wrong Accent / Variant** added:
    - correct language, but noticeable non-native/wrong-regional accent, vocabulary, grammar, or combination,
    - Moderate/Major severity shown,
    - lower Naturalness / Engagement / Aesthetics accordingly.
  - **Bridging** added:
    - evaluates spoken placeholders/handoff language around tool/larger-model delegation,
    - issue is mainly repetition, identical prosody, mistiming, over-narration, or excessive/raw signaling,
    - Minor/Moderate/Major severity definitions added.
  - **Instruction Quality** added, replacing **Model Refusals** in the new config:
    - understood request but refused/did wrong thing/partially complied/dropped instructions/over-hedged,
    - comprehension failure remains **Bad ASR / Model Misunderstanding**,
    - Task Success separately records whether the task was completed,
    - Minor/Moderate/Major severity definitions added.
  - rollout may show a mix of old/new taxonomy; use the exact version displayed in each submission.
  - apply taxonomy using **target-locale conventions**.
  - Wrong Grammatical Gender clarified: do not flag locally accepted gender defaults or standard noun agreement.
  - Fact Check is a **research aid, not an authoritative source**; independently assess and explain justified overrides.
  - if unclear wording, mistranslation, or lack of local relevance prevents valid completion, use **Skip (Technical issue) → Other**.


- **Sep 25 — Community alignment: Timeline View, Scenario Adherence, Rationale checklist**
  - **Timeline View is the unique/sole reference for Audio Quality, Conversational Dynamics, and Latency**.
  - if an AQ/CD/Latency issue was perceived live but is not present in Timeline View recordings/tracks, **do not report it**.
  - interpret **“What to do”** naturally rather than mechanically; automatic translation may be awkward.
  - **Skills tested** identify abilities that must actually be exercised.
  - respect required/minimum turn counts; keep Model B as close as possible to Model A in turn count.
  - complete scenario-required research/preparation before starting.
  - Notes may be used to organize prompts/evaluation points, without turning the conversation into defensive scripting.
  - rationale guidance reinforced: preference + specific evidence + dimension impact + direct A/B comparison + scenario relevance; AQ/CD/Latency evidence must come from Timeline View.


- **Oct 2 — Direct QA feedback: Defensive Scripting**
  - full deduction applied because A/B conversations were judged too structurally similar;
  - repeated expressions and distinctive phrasing across A/B were cited as evidence;
  - simple synonym swaps are insufficient;
  - new operational correction: **Shared Intent Spine + two independently written conversation paths**;
  - same user-turn functions, scenario coverage, complexity, and challenge must be preserved;
  - exact opener, sentence frames, fillers, metaphors, examples, and rhetorical patterns should differ naturally;
  - from U2 onward, follow-ups should hook into each model's own answer;
  - interruptions/detours should not trigger forced turn-by-turn script matching;
  - use planned `A-U# / B-U#` user-step labels separately from actual Timeline turn numbers.

- **Oct 2 — v7 workflow improvement: Agent-Ready Copy Block**
  - every Phase 1 scenario plan now ends with a clean line-by-line A/B transcript export;
  - exact format uses `=== SCENARIO: ... ===`, `--- MODEL A ---`, `--- MODEL B ---`, and alternating `Turn N (User)` / model-placeholder lines;
  - the block contains finalized planned USER lines but never invents model replies;
  - Model B numbering restarts from Turn 1 for simple downstream parsing;
  - HOOK / ADAPT / rubric notes stay outside the export block;
  - export turn labels are orchestration labels only and must not be treated as authoritative Timeline evidence;
  - live adaptation remains mandatory when the model response changes what would sound natural.


---

## End of playbook


---

# 42. Oct 2 Final Alignment Audit — Official Guideline + JQ + Dual QA Cross-Check — v8

This final edition preserves the official project-guideline alignment and incorporates the latest operational notes used in this workflow, including the Oct 1 Justification Quality calibration.

## Confirmed official fields

```text
Naturalness / Engagement / Aesthetics
Utility
Audio Quality
Conversational Dynamics
Overall Preference
Task Success — Pass / Partial / Fail
Error Clusters
Final Rationale — English, >=100 characters
```

## Confirmed evaluation separation

```text
NEA      = how human-like / warm / expressive / calibrated it sounds
UTILITY  = information quality only
CD       = turn-taking / interruptions / endpointing / responsiveness
AQ       = technical model-output audio only
TASK     = completion of every explicit + implicit + nested requirement
OVERALL  = scenario-weighted total preference
```

## Sep 25 workflow override retained

For final **Audio Quality, Conversational Dynamics, and Latency** judgments:

> **LIVE IMPRESSION → CHECK TIMELINE VIEW → USE ONLY CONFIRMED TIMELINE EVIDENCE**

If the issue cannot be reproduced/verified in Timeline View, do not use it for the final AQ/CD/Latency rating, cluster, or rationale.

## Standard assistant output — Phase 1

```text
🎯 SCENARIO / OBJECTIVE
🔢 MINIMUM USER TURNS REQUIRED: [N / not specified]
⚖️ TYPE + PRIORITY
🎚️ ADAPTATION LEVEL: [L0 / L1 / L2]

🧭 SHARED INTENT SPINE
U1 = opener / establish scenario
U2 = probe
U3 = challenge
U4 = correction / deeper test
U5 = stress test / close if scenario-valid

🅰️ MODEL A
A-U1 — OPENER
"[natural A wording]"

A-U2 — FOLLOW-UP
HOOK: react to A's answer
"[A-specific wording]"

A-U3 — CHALLENGE
HOOK: use A's actual content
"[A-specific challenge]"

...

🅱️ MODEL B
B-U1 — OPENER
"[different B wording, same function]"

B-U2 — FOLLOW-UP
HOOK: react to B's answer
"[B-specific wording]"

B-U3 — CHALLENGE
HOOK: use B's actual content
"[equivalent B-specific challenge]"

...

ANTI-DS CHECK
[ ] same user-turn functions
[ ] comparable difficulty/context/challenge
[ ] different sentence frames and opener wording
[ ] no repeated memorable phrases/metaphors
[ ] fillers not mirrored
[ ] follow-ups react to each model independently

👀 WHAT TO OBSERVE — max ~4 key items
🔢 USER-TURN COUNTER — A: __/__  B: __/__
⏱ TIMELINE VIEW — AQ / CD / Latency
📝 QUICK NOTES — A / B

📦 AGENT-READY BLOCK — ALWAYS LAST
=== SCENARIO: [SCENARIO TITLE] ===
--- MODEL A ---
Turn 1 (User): [full opener]
Turn 2 (Model A): [Risposta del modello - <expected mode/function>]
Turn 3 (User): [L0: full line | L1/L2: ADAPT LIVE instruction + compatible fallback]
Turn 4 (Model A): [Risposta del modello - <expected mode/function>]
...
--- MODEL B ---
Turn 1 (User): [full B opener]
Turn 2 (Model B): [Risposta del modello - <expected mode/function>]
Turn 3 (User): [L0: full line | L1/L2: ADAPT LIVE instruction + compatible fallback]
Turn 4 (Model B): [Risposta del modello - <expected mode/function>]
...
```


### Agent-export audit

Before handing Phase 1 to another agent:

```text
[ ] Block starts with === SCENARIO: ... ===
[ ] MODEL A and MODEL B headers exact
[ ] one utterance per line
[ ] odd planned turns = User
[ ] even planned turns = model placeholder
[ ] Model B restarts from Turn 1
[ ] L0/L1/L2 chosen correctly
[ ] L2 does NOT contain mandatory full U2+ dialogue
[ ] adaptive instructions are clearly marked and are not spoken verbatim
[ ] fallback text is used only when compatible with live state
[ ] A/B burden remains equivalent without forcing the same local plot
[ ] no actual model response invented
[ ] actual spoken lines will replace adaptive placeholders in the final log
[ ] planned turn labels not reused as fake Timeline evidence
```


## Standard assistant output — Phase 2

```text
🏆 OVERALL PREFERENCE

📊 SUGGESTED RATINGS
- Naturalness / Engagement / Aesthetics
- Utility
- Conversational Dynamics
- Audio Quality
- Task Success A
- Task Success B

⚠️ ERROR CLUSTERS
- exact live label
- UI severity if applicable
- evidence
- why it qualifies

###### ✍️ Final Rationale

Overall Preference: [A preferred / B preferred]
Decided mainly by: [dimension(s)]
Reasoning: [why these results support the winner / trade-off]

[Only consequential dimension sections]
Dimension: [selection]
Evidence: [turns / Timeline timestamps / quote / behavior]
Reasoning: [why evidence supports rating + A/B comparison]

[Every Partial/Fail only]
Task Success: Model [A/B] — [Partial / Fail]
Evidence: [...]
Reasoning: [...]

[Every flagged cluster only]
Flagged Error Cluster: [cluster] — Model [A/B]
Evidence: [...]
Reasoning: [why it meets definition]

RULES
- English
- >=100 characters
- Tie (both good), Pass, and unflagged clusters may be omitted or noted briefly
- AQ / CD / Latency evidence must be Timeline-confirmed
- no need to repeat Major / Moderate / Minor in final prose
```

## Final anti-error checklist

```text
[ ] Scenario requirements actually tested
[ ] Required minimum **user-turn count** satisfied
[ ] A and B comparable in opener/context/effort/complexity and received equal/equivalent evaluator input burden
[ ] Adaptation level selected correctly (L0 / L1 / L2)
[ ] For L2, only U1 was fixed by default; U2+ were chosen after hearing the prior model reply
[ ] Live State Ledger / continuity check used before stateful follow-ups
[ ] No stale fallback line was spoken after the model changed the scene
[ ] No user action assumed an object/location/action the model had just denied
[ ] No model decision/instruction was silently ignored
[ ] Any evaluator slip/repeated line was repaired naturally rather than hidden
[ ] Conversation adapted naturally; not rigidly scripted
[ ] Separate A and B conversation paths used; B was not a synonym rewrite of A
[ ] Opener function equivalent but wording distinct
[ ] No repeated memorable phrase/metaphor/filler pattern across A/B unless required by task terminology
[ ] Follow-ups from U2 onward reacted to each model's actual answer
[ ] Interruption/detour handled by preserving functional burden, not replaying the same line at the same sequential turn
[ ] Every Skills Tested capability genuinely exercised
[ ] Task Success uses Pass / Partial / Fail
[ ] Utility kept separate from Task Success
[ ] NEA kept separate from Conversational Dynamics
[ ] AQ/CD/Latency confirmed in Timeline View
[ ] AQ judges model output only
[ ] Exact live cluster names/severities used
[ ] Wrong Language applied narrowly
[ ] Wrong Accent / Variant used for locale mismatch, not Wrong Language
[ ] Instruction Quality vs Bad ASR distinction correct
[ ] Every selected cluster has correct UI severity (if applicable) + concrete/verifiable evidence in the rationale
[ ] Overall follows scenario-specific hierarchy
[ ] Rationale is English, >=100 characters, specific, verifiable, and internally consistent
[ ] Rationale built only from ACTUAL conversation / notes / Timeline, never the Phase 1 plan
[ ] No planned SAY/fallback/HOOK/ADAPT text used as evidence unless actually spoken
[ ] No evaluator-caused mistake attributed to a model
[ ] No meta-claim that the interaction/evaluator was "unscripted", "spontaneous", or "adaptive"
[ ] No generic "primary goal of this scenario..." boilerplate opener
[ ] Overall Preference + decisive dimension(s) explicitly explained
[ ] Every consequential dimension rating has selection + observable evidence + why it supports the rating
[ ] Trade-off explained when dimension results point in different directions
[ ] Every Task Success Partial/Fail explicitly explained with evidence
[ ] Every selected Error Cluster explicitly explained with evidence + why it meets the cluster definition
[ ] Tie (both good), Pass Task Success, and unflagged clusters omitted/brief unless needed for clarity
[ ] Repeated issue 1–3x → all occurrences listed; many repeats → approximate total + at least 3 representative examples
[ ] No unnecessary Major / Moderate / Minor labels in final rationale prose
[ ] Prior QA feedback re-read and applicable corrections carried forward
```

---

### Latest critical turn-count rule

> **Minimum turns = evaluator/user turns only. Model replies never count toward the scenario minimum.**

Before ending either conversation:

```text
A user turns completed >= scenario minimum
B user turns completed >= scenario minimum
```

## End of Official-Aligned Definitive Playbook



## Sep 30, 2026 — Client Calibration v3

Added/updated:
- rationale evidence must be **specific and verifiable**;
- valid evidence types explicitly include **Turn, Timeline timestamp, brief quote, or specific model behavior**;
- **1–3 occurrences → identify all cases**;
- **>3 occurrences → approximate total + at least 3 clear examples**;
- mandatory rationale coverage for **Overall Preference, decisive dimensions, every Task Success Partial/Fail, and every selected Error Cluster**;
- severity remains required where applicable in the UI, but **does not need to be repeated in the prose rationale**;
- pre-submit parity check expanded to **turn count + every scenario step + equal/equivalent A/B inputs**;
- **QA feedback carryover** added as an explicit operating rule;
- current client quality-focus areas highlighted: **Justification Quality, Audio Quality, Scenario Adherence**.




## Sep 30, 2026 — v4 Natural-Turn + Rationale-Formatting Update

Added:
- explicit **Natural Human Turns** standard for all generated evaluator prompts;
- light, irregular use of real spoken markers such as `ehm`, `ok`, `sai`, `cioè`, `aspetta`, `mmm`, `ahaha` when contextually appropriate;
- rule that evaluator prompts should be written **for speaking, not for reading**;
- examples converting polished/scripted prompts into natural spoken Italian;
- explicit protection against overusing fillers or turning them into a new scripted pattern;
- reinforced **same evaluation burden, not identical wording** for A/B parity;
- new default rationale presentation under `###### ✍️ Final Rationale`;
- default **3–4 paragraph rationale structure**:
  1. Overall + core task / Utility / Task Success;
  2. Timeline dimensions + shared/non-decisive issues;
  3. decisive differentiator;
  4. optional concise conclusion;
- preferred connective language such as `Both models...`, `On Timeline View...`, `The decisive differentiator was...`, `In contrast...`, and `Because...`;
- all Sep 30 evidence, frequency, Task Success, Error Cluster, Timeline, and scenario-adherence requirements remain unchanged.

## Oct 2, 2026 — v5 Justification Quality (JQ) Calibration Update

Integrated the **Oct 1 client-provided “Clear and Evidence-Based Rationale” calibration**.

Added/updated:

- new definition of a **clear, concise, evidence-based rationale**: another reviewer should be able to understand and verify the selections without guessing;
- new **minimum verifiable coverage**:
  1. Overall Preference + supporting dimension rating(s);
  2. every Task Success = Partial / Fail;
  3. every flagged Error Cluster;
- explicit rule that **Tie (both good)** dimensions, **Pass** Task Success, and **unflagged Error Clusters** may be omitted or mentioned briefly;
- dimension explanation standard: **selection + observable evidence + why the evidence supports the rating + A/B comparison**;
- Overall Preference must name the **driver dimension(s)** and explain the **trade-off** when dimensions point in opposite directions;
- Partial/Fail Task Success must state the affected model, what was completed/missed, evidence, and why Partial/Fail is justified;
- every flagged Error Cluster must identify the affected model, exact cluster, evidence, and why it meets the cluster definition;
- evidence guidance refined by dimension:
  - AQ generally benefits from Timeline turn/timestamp evidence;
  - NEA may be supported by specific phrases and consistent vocal/behavioral patterns;
- repeated-issue guidance retained and harmonized:
  - 1–3 occurrences → identify all when used as evidence;
  - many repeated issues → approximate total + at least 3 representative examples;
- explicit rule that a cluster already fully explained under a directly impacted dimension can be summarized/cross-referenced rather than duplicated;
- **Major / Moderate / Minor do not need to be written in the final rationale**, while any required severity selection still belongs in the live UI;
- the **client-recommended labeled rationale template** is now the default assistant output for Phase 2;
- the Sep 30 multi-paragraph rationale style is retained only as an **acceptable alternative** when it covers the same required JQ elements;
- Phase 2 output template, anti-error checklist, rationale construction protocol, golden rules, and final alignment audit updated accordingly.

All prior rules remain active unless superseded, including:

- scenario-specific Overall Preference weighting;
- Timeline View as the sole final evidence source for **AQ / Conversational Dynamics / Latency**;
- user/evaluator-turn-only minimum counting;
- A/B parity and anti-defensive-scripting rules;
- Utility vs Task Success separation;
- current/rolling Error Cluster taxonomy;
- natural human evaluator-turn style;
- evidence must never contain invented timestamps, turns, quotes, counts, or artifacts.


## Oct 2, 2026 — v6 Direct QA Anti-Defensive-Scripting Update

Integrated the evaluator's Oct 2 QA review that applied a full **Defensive Scripting** deduction.

Added/changed:

- replaced the single shared conversation script with a **Shared Intent Spine + two separate A/B conversation paths**;
- each A/B plan now preserves the same **user-turn functions, scenario coverage, difficulty, and challenge**, while using different wording, syntax, discourse markers, examples, and rhetorical angles;
- exact same opener is no longer the default; use **equivalent opener function, distinct wording**;
- strengthened rule that **superficial paraphrasing / synonym swapping is still defensive scripting**;
- added a **phrase-overlap rule**: required technical terms may repeat, but conversational scaffolding, unusual metaphors, filler sequences, and memorable phrases should not;
- added **mandatory adaptive hooks from U2 onward** so follow-ups react to each model's actual answer;
- introduced `A-U# / B-U#` planned user-step labels, separate from actual Timeline turn numbering;
- added interruption/detour guidance: preserve **functional parity**, not same-turn script matching;
- expanded natural spoken markers to include `praticamente`, `ci sta`, and `insomma`, with explicit anti-mirroring guidance;
- rebuilt the scenario-plan framework and examples in a dual-path format;
- updated the Master Prompt, daily cheat sheet, Phase 1 standard output, and pre-submit audit to enforce the new workflow;
- retained all Oct 1 JQ, Sep 30, Sep 25 Timeline, Task Success, Utility, taxonomy, severity, and evidence rules.

> **v6 North Star for scenario construction:** **same skill test, same burden, two genuinely different live conversations.**

## Oct 2, 2026 — v8 Second QA Review: Live-State Adaptation + Rationale Grounding

Integrated the second Oct 2 QA review, which applied **Defensive Scripting -100%** because pre-planned evaluator lines were followed even when they conflicted with the models' decisions.

Added/changed:

- added **Adaptation Levels L0 / L1 / L2**;
- Creative & Playful / improv / stateful roleplay defaults to **L2**;
- in L2, **only the opener is fully fixed by default**; U2+ are generated from the live model state;
- replaced the old assumption “full planned USER lines everywhere” with a **mode-sensitive Agent-Ready export**;
- L1/L2 exports preserve the exact parser-friendly `Turn N (...)` format but use `ADAPT LIVE` instructions + compatibility-only fallbacks for later user turns;
- downstream logging must save the **actual spoken line**, not the stale planned fallback;
- added the **Live State Ledger** and mandatory execution loop: `LISTEN → STATE → FUNCTION → REACTION → NEXT MOVE`;
- added a **continuity gate** to prevent ignoring model-established location, objects, actions, decisions, and constraints;
- added a **reaction-first** rule so U2+ visibly grow from the immediately preceding model reply;
- added **evaluator slip recovery** for repeated/wrong lines instead of continuing the script;
- added examples directly addressing the QA patterns: “stay inside,” “nothing to throw,” detached acknowledgements, and repeated lines;
- clarified that A/B fairness is **functional parity**, not matching local fictional plot events;
- added **rationale grounding**: final rationale must use the actual conversation / notes / Timeline, never pre-conversation plans;
- prohibited unsupported evaluator-process claims such as “the interaction was unscripted/spontaneous” or generic “primary goal...” boilerplate;
- added **evaluator-caused error quarantine** so user mistakes are not turned into model faults;
- updated the Master Prompt, daily cheat sheet, Phase 1 export, final audit, and rationale protocol accordingly.

> **v8 North Star:** **the live model state outranks the script. Plan functions before the conversation; choose actual words only after hearing what the model just did.**

