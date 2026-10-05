---
name: systematic-debugging
type: workflow
triggers: ["/debug", "fix bug", "diagnose bug", "test failure", "reproduce issue"]
keywords: ["debug", "debugging", "systematic", "hypothesis", "reproduce", "test failure", "root cause"]
when_to_use: when diagnosing bugs, test failures, unexpected behavior, or regressions
context: inline
token_cost: 160
user_invocable: true
---
## Systematic Debugging Protocol

Do NOT guess and patch. Follow this 4-step discipline to isolate and fix the root cause:

1. **Reproduction Before Mutation**:
   - Construct the smallest reproducible invocation or test case before modifying any source code.
   - Confirm it fails in the exact expected manner.

2. **Formulate Explicit Hypotheses**:
   - List 2–3 competing hypotheses explaining the observed failure.
   - For each hypothesis, identify a check or inspection that can definitively falsify it.

3. **Verify Root Cause**:
   - Inspect code, traces, or runtime output to falsify hypotheses one by one.
   - Do not begin editing until the underlying mechanism of failure is confirmed.

4. **Surgical Fix & Regression Check**:
   - Apply the minimal, targeted correction.
   - Verify the reproduction case now passes.
   - Run the broader test suite to ensure no collateral regression.
