# Human + AI Work Check

**Your credibility is being questioned. Show how the work was made.**

Human + AI Work Check is a provenance-first public prototype. Its primary tool creates an evidence-backed Work Record for one artifact version. Its optional Work Check examines whether a person’s capacity, an AI system and role, the workflow, and the stakes support relying on AI in that role.

The site provides two connected tools:

- **Work Record:** Documents the exact artifact, human and AI contributions, claims, evidence, contribution handling, review, and final release decision.
- **Work Check:** Shows whether the current relationship supports relying on AI in its proposed role, the largest role supported now, and what could strengthen the arrangement.

The Work Check produces a transparent project result, a separate evidence-strength result, supported roles and limits, problems that need to be fixed first, and practical actions that can strengthen the relationship now, within 24 hours, within days, or within weeks.

## Current status

This repository contains the v0.3 public prototype. It is a transparent, practice-based working method, not a certification, guarantee, legal conclusion, general model rating, probability of accuracy, or independently validated scientific instrument.

The prototype:

- Runs entirely in the browser
- Stores project data locally on the device
- Creates a six-step Work Record with structured claims and evidence
- Separates claim support, evidence integrity, and review status
- Supports public, private, and redacted evidence
- Produces a privacy-safe public HTML record and a private JSON backup
- Preserves and migrates earlier Work Record data without invalidating v0.2 Work Checks
- Supports planning, ready-to-launch, and current-use Work Checks
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

The Work Check asks whether the person's current capacity, the AI setup and assigned role, the workflow and controls, and what is at stake support the trust being placed in the relationship.

- **Reliance Support** describes the largest AI role the current arrangement supports.
- **Evidence Strength** describes how well the available records support that conclusion.
- A serious gap in knowledge, access, authority, time, attention, or the ability to correct or stop the work can limit the supported AI role.
- Multiple AI systems and models can be recorded, but one consequential system-role pair is assessed at a time. Run another Work Check for another consequential role.
- Recommended actions may change the AI role, add qualified human help, strengthen the workflow, or test a different model. Planned actions do not change the current result until they are completed and supported by evidence.

See the in-product **How it works** page for the complete explanation.

## License and reuse

No open-source license has been assigned yet. Until one is added, all rights are reserved by the repository owner.
