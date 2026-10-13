# Human + AI Work Check

**Is the trust I am placing in this human and AI work arrangement supported?**

Human + AI Work Check examines the relationship among the person doing the work, one consequential AI system and role, the workflow, and what is at stake. It looks at one real project, not the model name alone.

The site provides two connected tools:

- **Work Check:** Shows whether the current relationship supports relying on AI in its proposed role, the largest role supported now, and what could strengthen the arrangement.
- **Work Record:** Documents how the work was made, what the person did, what each AI system contributed, and what evidence supports that account.

The Work Check produces a transparent project result, a separate evidence-strength result, supported roles and limits, problems that need to be fixed first, and practical actions that can strengthen the relationship now, within 24 hours, within days, or within weeks.

## Current status

This repository contains the v0.2 public prototype. It is a transparent, practice-based working method, not a certification, guarantee, legal conclusion, general model rating, probability of accuracy, or independently validated scientific instrument.

The prototype:

- Runs entirely in the browser
- Stores project data locally on the device
- Supports planning, ready-to-launch, and current-use checks
- Exports and imports project JSON
- Prints a task-specific project card
- Creates a separate Work Record showing how the work was made

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
```

## Deployment

The included GitHub Actions workflow builds and deploys the `dist` directory to GitHub Pages when changes reach `main`. In the repository settings, set **Pages → Source** to **GitHub Actions** if it is not already selected.

## Method summary

The Work Check asks whether the person's current capacity, the AI setup and assigned role, the workflow and controls, and what is at stake support the trust being placed in the relationship.

- **Reliance Support** describes the largest AI role the current arrangement supports.
- **Evidence Strength** describes how well the available records support that conclusion.
- A serious gap in knowledge, access, authority, time, attention, or the ability to correct or stop the work can limit the supported AI role.
- Multiple AI systems and models can be recorded, but one consequential system-role pair is assessed at a time. Run another Work Check for another consequential role.
- Recommended actions may change the AI role, add qualified human help, strengthen the workflow, or test a different model. Planned actions do not change the current result until they are completed and supported by evidence.

See the in-product **How it works** page for the complete explanation.

## License and reuse

No open-source license has been assigned yet. Until one is added, all rights are reserved by the repository owner.
