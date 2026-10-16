# evAIdence

**Your credibility is being questioned. Show how the work was made.**

evAIdence is a provenance-first public prototype from Ypifany with two connected tools. The Work Record creates an evidence-backed account of how one artifact version was made. The Load Test reveals what an assigned AI role still requires from people and the workflow, whether the current setup can carry that load, and what is at stake if the person proceeds as-is.

The site provides two connected tools:

- **Work Record: Who did what?** Documents the exact artifact, detailed role-based credits, claims, evidence, review, and final release decision.
- **Load Test: Can this setup carry the work?** Shows the load created by an AI role, the role described by the person’s answers, the role backed by identified records, and the wager if the setup remains unchanged.

The Load Test produces a transparent project result, a separate Evidence Strength result, exposed parts of the wager, and practical actions that can reduce the load or strengthen the setup now, within 24 hours, within days, or within weeks. It does not grant or deny permission to proceed.

## Current status

This repository contains the v0.3 public prototype. It is a transparent, practice-based working method, not a certification, guarantee, legal conclusion, general model rating, probability of accuracy, or independently validated scientific instrument.

The prototype:

- Runs entirely in the browser
- Stores project data locally on the device
- Creates a six-step Work Record with structured claims and evidence
- Separates claim support, evidence integrity, and review status
- Supports public, private, and redacted evidence
- Produces a privacy-safe public HTML record and a private JSON backup
- Preserves earlier Load Test setup data and requires reassessment when the scoring method changes
- Supports planning, ready-to-launch, and current-use Load Tests
- Exports and imports project JSON
- Prints a task-specific project card
- Includes a real Work Record for this website

Do not enter confidential, regulated, or sensitive information.

## Run locally

Requirements: Node.js 22 or newer.

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Verify the project

```bash
npm test
npm run validate
npm run build
npm run smoke
```

## Deployment

The included GitHub Actions workflow builds and deploys the `dist` directory to GitHub Pages when changes reach `main`. In the repository settings, set **Pages → Source** to **GitHub Actions** if it is not already selected.

## Method summary

The Work Record follows the work instead of guessing from its surface. It records what the person did, what each AI system did, which evidence supports each claim, how each part was handled, and which artifact version the record describes. It never invents a human-versus-AI percentage.

This is not an AI detector. It does not scan writing style, classify a finished product as human or AI, or help someone bypass detection.

The Load Test asks what the role given to AI requires from the person and workflow, whether the current setup can carry that load, and what could happen if the person continues as-is.

- The **operational result** describes what the person’s answers say the setup can carry.
- The **record-backed conclusion** is limited to the role-critical records the person identified. The tool records those references but does not inspect them.
- **Evidence Strength** describes which answers have supporting records identified and whether an independent review was recorded.
- A serious gap in knowledge, access, authority, time, attention, or the ability to correct or stop the work can leave part of the load uncovered.
- Multiple AI systems and models can be recorded, but one consequential system-role pair is assessed at a time. Run another Load Test for another consequential role.
- Recommended actions may change the AI role, add qualified human help, strengthen the workflow, or test a different model. A planned action does not change the operational result until it is completed and the Load Test is run again. Evidence Strength changes only when a current supporting record is identified.

See the in-product **How it works** page for the complete explanation.

## License and reuse

© 2026 Cheryl Abram. All rights reserved. No open-source license has been granted. See [COPYRIGHT.md](COPYRIGHT.md) for the scope of the copyright claim and reuse notice.
