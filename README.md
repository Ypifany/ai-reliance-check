# AI Reliance Check

**What can I delegate to AI—and still stand behind the result?**

AI Reliance Check is a task-specific decision aid for calibrating human reliance on AI. It evaluates the working arrangement—not the model name—across five dimensions:

- Capability Fit
- Behavioral Fit
- Human Assurance
- Workflow Control
- Outcome Testability

The check produces a transparent Reliance Score, evidence confidence, validation status, authorization boundary, hard gates, and practical actions that can strengthen the arrangement now, within 24 hours, within days, or within weeks.

## Current status

This repository contains the v0.1 public prototype. It is a transparent, practice-based working method, not a certification, guarantee, legal conclusion, general model rating, probability of accuracy, or independently validated scientific instrument.

The prototype:

- Runs entirely in the browser
- Stores project data locally on the device
- Supports Plan, Release, and Outcome checks
- Exports and imports project JSON
- Prints a task-specific Reliance Card
- Creates a separate Human–AI Creation Record

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

Each assessment answer uses a published rubric value. Evidence changes how much credit the answer receives:

- Confirmed: 100% of the rubric value
- Reported: 75% of the rubric value
- Unknown: no evidence credit

The five dimension scores contribute equally to the public score, which is rounded to the nearest five. Stakes and proposed authority determine how much assurance is required; they do not manipulate the score. Hard gates can limit authorization even when the average is high.

See the in-product **Method** page for the full v0.1 explanation.

## License and reuse

No open-source license has been assigned yet. Until one is added, all rights are reserved by the repository owner.
