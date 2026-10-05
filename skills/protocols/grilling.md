---
name: grilling
type: workflow
triggers: ["/grill-me", "grill me", "interview me", "grill"]
keywords: ["grill", "grill-me", "interview", "design tree", "frontier", "stress-test plan"]
when_to_use: when designing, brainstorming, or stress-testing a decision/architecture before execution
context: inline
token_cost: 160
user_invocable: true
---
## Grilling Protocol (Design Tree)

Interview the user relentlessly until shared understanding is reached. Model this as a **design tree**: every decision branches into dependencies.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are settled:
- Ask the whole frontier in one round.
- Number each question and provide your recommended answer (`➡️`).
- Wait for user answers before opening the next round.

Format:
```
❓ **Q1** - **<question title>**: <question body with concrete choices>
➡️ <your recommended answer>
```

Rules:
1. **Facts vs Decisions**: Finding facts is your job (read files, run commands). Never ask the user anything you can look up yourself.
2. **Decisions are the user's**: Put each choice to the user with a concrete recommendation.
3. **Session done**: When the frontier is empty (all branches visited, nothing silently assumed).
