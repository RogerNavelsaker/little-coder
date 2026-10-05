---
name: grill-with-docs
type: workflow
triggers: ["/grill-with-docs", "grill with docs"]
keywords: ["grill-with-docs", "domain model", "adr", "glossary", "architectural decision"]
when_to_use: when designing architecture or domain concepts that need recorded decisions and glossary definitions
context: inline
token_cost: 180
user_invocable: true
---
## Grill With Docs Protocol (Domain Modeling & Mulch Records)

Combines relentless design-tree grilling with domain modeling and architectural recording:

1. **Active Domain Modeling**:
   - Challenge fuzzy or overloaded terms immediately. Propose canonical terminology.
   - Cross-reference statements against existing code. Surface contradictions early.
   - Maintain a clean `GLOSSARY.md` (or repo vocabulary) devoid of speculative implementation details.

2. **Architectural Records (Mulch)**:
   Record architectural decisions directly using Mulch (`ml record architecture --name <slug> "<content>"`) ONLY when all 3 criteria are satisfied:
   - **Hard to reverse**: High cost to backtrack later.
   - **Surprising without context**: A future developer would question why this choice was made.
   - **Real trade-off**: Explicit selection made between genuine competing alternatives.

3. **Execution**: Follow the Grilling protocol format for each questioning round. As terms crystallize, update the glossary or record the decision in Mulch inline.
