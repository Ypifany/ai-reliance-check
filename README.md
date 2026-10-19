# evAIdence

**See how your work with AI changes.**

evAIdence is a browser-based prototype from Ypifany. It turns records that already exist, such as an AI conversation, source material, and version history, into a snapshot of what the person did, what AI did, and what remains unknown. A later snapshot shows what changed.

The name is pronounced “evidence.” AI appears inside the word because AI is part of the work, not the whole work.

## The v0.4 experience

The main path is intentionally short:

1. **Add your records.** Name the work and AI tools, describe what AI already had, and add the relevant conversation, source material, finished work, or public GitHub repository that you have.
2. **Check the picture.** Confirm when AI entered, what AI materially did, and what you materially did.
3. **Save the snapshot.** The first snapshot becomes a baseline. Later comparable snapshots show which parts of the working relationship moved.

The change view is descriptive. It does not treat more AI as automatically bad, call a person dependent, or produce a human-versus-AI percentage. It asks whether the change was intentional and leaves the decision with the person.

## Connected tools

- **Snapshot:** Creates a short record of one human and AI arrangement.
- **My Changes:** Compares the latest snapshot with earlier comparable work and preserves a private timeline in the current browser.
- **Detailed Work Record:** Preserves the earlier six-step tool for detailed credits, claims, selected evidence, review, and a specific work version.
- **Load Test:** Remains an optional deeper check when an AI role, access level, consequence, or change deserves closer examination.

**Before You Ship** is planned as a separate, focused companion for nondevelopers releasing software made with AI. It can share the evAIdence snapshot and comparison foundation without adding software due-diligence questions to the simpler evAIdence path.

## Current status

This repository contains the v0.4 public prototype. It is a transparent, practice-based working method. It is not a certification, guarantee, legal conclusion, AI-model rating, probability of accuracy, or independently validated scientific instrument.

The prototype:

- Runs entirely in the browser
- Stores snapshots and drafts locally on the device
- Saves references, short summaries, and file fingerprints instead of raw pasted conversations or uploaded file contents
- Labels findings as **Shown in records**, **Confirmed by creator**, or **Unknown**
- Compares snapshots for the same named project or compatible work type and stage
- Exports and imports private snapshot history as JSON
- Keeps the detailed Work Record and Load Test available
- Supports public, private, and redacted evidence in the detailed Work Record
- Produces a privacy-safe public HTML record and private JSON backup from the detailed Work Record

A supplied link is recorded as a reference. The browser prototype does not inspect the linked conversation, repository, or finished work. A fingerprint can show that the same file or pasted text was supplied again, but it does not prove authorship or establish when the source was created.

Browser storage can be cleared and does not automatically move between devices. Export the private history if it matters. Do not enter confidential, regulated, or sensitive information.

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

evAIdence follows the work instead of guessing from the surface of a finished product. A snapshot records the AI setup, when AI entered, the material roles of the person and AI, the person’s authorization decision, and the basis for each finding. A later snapshot reports movement in those recorded areas without grading the change as good or bad.

This is not an AI detector. It does not scan writing style, classify a finished product as human or AI, help someone bypass detection, or assign authorship from a percentage.

The detailed Work Record remains available when one project needs formal credits and evidence links. The optional Load Test asks what an assigned AI role requires from the person and workflow, whether the current setup can carry that load, and what could happen if the person continues as-is.

- The **operational result** describes what the person’s answers say the setup can carry.
- The **record-backed conclusion** is limited to the role-critical records the person identified. The tool records those references but does not inspect them.
- **Evidence Strength** describes which answers have supporting records identified and whether an independent review was recorded.
- A serious gap in knowledge, access, authority, time, attention, or the ability to correct or stop the work can leave part of the load uncovered.
- Multiple AI systems and models can be recorded, but one consequential system-role pair is assessed at a time. Run another Load Test for another consequential role.
- Recommended actions may change the AI role, add qualified human help, strengthen the workflow, or test a different model. A planned action does not change the operational result until it is completed and the Load Test is run again. Evidence Strength changes only when a current supporting record is identified.

See the in-product **How it works** page for the complete explanation.

## License and reuse

© 2026 Cheryl Abram. All rights reserved. No open-source license has been granted. See [COPYRIGHT.md](COPYRIGHT.md) for the scope of the copyright claim and reuse notice.
