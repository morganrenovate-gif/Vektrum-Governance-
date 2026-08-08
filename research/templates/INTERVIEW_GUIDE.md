# Interview Guide — <SEGMENT / ROLE>

**Date:** YYYY-MM-DD · **Target role:** <...> · **Duration:** 30–40 minutes · **Format:** call

> **The agent never contacts anyone.** It produces this guide and a target list. A human sends outreach, with explicit authorization, and conducts the interview.

---

## Ground rules

1. **Do not describe Vektrum until the last third.** Once you describe the product, everything the interviewee says afterwards is contaminated by politeness and pattern-matching. Get the workflow first.
2. **Ask about the last real incident, never about hypothetical interest.** "Walk me through the last draw you held up" produces evidence. "Would enforcement be valuable?" produces agreement, and agreement is not evidence.
3. **Never ask a question that contains its own answer.** If the interviewee can tell what you want to hear, you have stopped learning.
4. **Follow the specific over the general.** When they say "sometimes there are issues," ask "when was the last one?"
5. **Silence is a tool.** After an answer, wait. The second thing they say is usually the true thing.
6. **Record who decides, who executes, who gets blamed, and who signs.** These are often four different people, and the map is the point.
7. **Log the interview as a source** with its own ID immediately afterwards.

---

## Opening (2 min)

> "Thanks for the time. I'm researching how construction draws actually get processed and paid — not selling anything today. I'd mostly like to understand your workflow and where it gets painful. Anything you'd rather not discuss, just say so. Mind if I take notes?"

- Confirm role, tenure, and scope of responsibility.
- Confirm organization type and approximate volume (projects or draws per year).

---

## Section 1 — The workflow as it actually runs (10 min)

1. Walk me through what happens from the moment a draw request arrives until money leaves.
2. Who touches it along the way?
3. What tools are involved at each step? *(Let them name systems. Never name a vendor first.)*
4. How long does the whole thing usually take? What's the longest it's taken recently?
5. What documentation has to be in place before you'll fund?
6. Who checks that documentation, and how do they check it?
7. What happens when something's missing?

---

## Section 2 — Conditions and enforcement (8 min)

8. Are there conditions that must be satisfied before a draw is released? How are they tracked?
9. Is that a checklist someone works through, or does a system stop the payment?
10. **Has anyone ever funded a draw with a condition unmet?** What happened?
11. When there's time pressure — a contractor needs payroll — what gives?
12. Who has the authority to say "fund it anyway"?
13. How would you know, after the fact, that a condition was skipped?

> Q10 and Q11 are the two most important questions in the guide. They test whether existing controls are advisory or enforced (A-12, A-19). Do not rush them, and do not accept a general answer — get an instance.

---

## Section 3 — Failure and cost (6 min)

14. Tell me about a draw that went wrong. What happened?
15. What did it cost — money, time, relationship, examiner attention?
16. Who absorbed that cost?
17. Has an auditor, examiner, or investor ever asked about your disbursement controls? What did they want to see?
18. How often does something like that happen?

---

## Section 4 — Buying and authority (6 min)

19. If you wanted to change something about this process, who would you have to convince?
20. Who owns the budget for tools in this area?
21. What's the last piece of software your team bought for this workflow? How did that go?
22. What does a vendor have to clear before you can use them — security review, SOC 2, legal?
23. How long does that usually take?
24. **Who actually decides whether a specific draw gets released?** Is that your organization, or someone else's?

> Q24 tests A-5/A-6 — whether the interviewee's organization holds release authority at all. For developer interviews, this is the single decisive question in the entire program.

---

## Section 5 — Reaction (5 min, last)

> Only now describe Vektrum, in one neutral sentence, using approved language:
>
> *"Some teams are looking at a layer that sits before payment and checks release conditions server-side — it authorizes or blocks, and the existing payment process still executes the payment."*

25. Does that solve a problem you actually have, or not really?
26. What would worry you about it?
27. What would have to be true for you to try it on one project?
28. Who else should I be asking about this?

> **Listen for hesitation more carefully than for enthusiasm.** Enthusiasm in an interview is cheap and predicts nothing. Hesitation is where the real objection lives, and it's the more useful data.

---

## Close (1 min)

- Ask for two referrals.
- Ask if you may follow up with clarifying questions.
- Do **not** pitch, do **not** ask for a pilot commitment in a research interview. Mixing research and selling corrupts both.

---

## Post-interview capture — complete within 30 minutes

| Field | Entry |
|-------|-------|
| Source ID | S-INT-xxx |
| Date, role, org type, volume | |
| **Release authority: theirs or someone else's?** | |
| Conditions enforced or advisory? | |
| Documented failure incident? | |
| Named economic buyer | |
| Named blocker | |
| Procurement bar (SOC 2 etc.) | |
| Current tooling | |
| Strongest quote (verbatim) | |
| **Evidence against our thesis** | |
| Assumptions this validates or kills | A-xx |
| Referrals offered | |

> The "evidence against our thesis" field is mandatory. If it is empty after an interview, you probably asked leading questions — review the transcript before logging.

---

## Non-leading phrasing reference

| Don't ask | Do ask |
|-----------|--------|
| "Would you value enforced release conditions?" | "Has a draw ever gone out with something missing? Tell me about it." |
| "Is manual approval a problem for you?" | "Walk me through how the last draw got approved." |
| "Would you pay for an audit trail?" | "Has anyone ever asked you to prove why a draw was released? What did you show them?" |
| "Do you trust AI for draw review?" | "What does your team do with the documents when they arrive?" |
| "Is this better than Built?" | "What are you using today, and what made you choose it?" |
| "How much would you pay?" | "How is this budgeted today, and what do comparable tools cost you?" |
