# evAIdence

**AI can help with the work. It should not cost you your credibility.**

evAIdence is a browser-based prototype from Ypifany. It combines the creator’s account of the work with records that already exist, such as AI conversations, source material, current work, and version history. The result is a dated Work Receipt that shows what the person did, what AI did, which records were provided, and what remains unknown. A later Work Receipt shows what changed.

The name is pronounced “evidence.” AI appears inside the word because AI is part of the work, not the whole work.

## The v0.5 experience

The main path is intentionally short:

1. **Name the work and describe the setup.** Identify the creator and AI tools, what AI already had, what you added during the project, the highest access or action level AI had, and when your approval was required.
2. **Add the records you have.** Add multiple conversation links or exports, source links or files, the current work, repository or version history, and other useful records. The review separates your account of the work from the records you actually provided.
3. **Check the picture and save the Work Receipt.** Confirm when AI entered, what AI materially did, and what you materially did. The receipt presents human-first work credits and gives you controls to edit the information or add records without creating a duplicate receipt.

The first Work Receipt for each project becomes its baseline. Later comparable receipts for that project show which parts of the working relationship moved.

The change view is descriptive. It does not treat more AI as automatically bad, call a person dependent, or produce a human-versus-AI percentage. It asks whether the change was intentional and leaves the decision with the person.

## Connected tools

- **Work Receipt:** Creates a dated, human-first record of one human and AI arrangement. The application stores this internally as a Snapshot.
- **My Changes:** Compares the latest Work Receipt with earlier comparable work and preserves a private timeline in the current browser.
- **Detailed Work Record:** Preserves the earlier six-step tool for detailed credits, claims, selected evidence, review, and a specific work version.
- **Load Test:** Remains an optional deeper check when an AI role, access level, consequence, or change deserves closer examination.

**Before You Ship** is planned as a separate, focused companion for nondevelopers releasing software made with AI. It can share the evAIdence receipt and comparison foundation without adding software due-diligence questions to the simpler evAIdence path.

## Current status

This repository contains the v0.5 Founding Preview. It is a transparent, practice-based working method. It is not a certification, guarantee, legal conclusion, AI-model rating, probability of accuracy, or independently validated scientific instrument.

The prototype:

- Runs entirely in the browser
- Stores Work Receipts and drafts locally on the device
- Saves references, short summaries, and file fingerprints instead of raw pasted conversations or uploaded file contents
- Labels findings as **Record provided**, **Confirmed by creator**, or **Unknown**
- Separates creator statements about the working arrangement from records that were actually provided
- Accepts multiple AI conversation records and multiple source files
- Records starting context, context added during the work, AI access or action level, connected tools, and the approval boundary as separate fields
- Presents the creator first in concise work credits, followed by the recorded AI assistance
- Lets the person edit receipt information or add and remove records while preserving the same receipt identity
- Gives each project a stable identity, so its Work Receipts remain comparable after a rename
- Starts a Detailed Work Record from a Work Receipt without overwriting a different saved record unless the person confirms it
- Exports and imports private Work Receipt history as JSON
- Keeps the detailed Work Record and Load Test available
- Supports public, private, and redacted evidence in the detailed Work Record
- Produces a privacy-safe public HTML record and private JSON backup from the detailed Work Record

A supplied link is recorded as a reference. The browser prototype does not inspect the linked conversation, repository, or finished work. A fingerprint can show that the same file or pasted text was supplied again, but it does not prove authorship or establish when the source was created. Link access, permission-aware retrieval, and content review are planned for a later connected version, not this browser preview.

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

evAIdence follows the work instead of guessing from the surface of a finished product. A Work Receipt records what AI started with, what the person added, what AI could access or do, when approval was required, when AI entered, the material roles of the person and AI, and the basis for each finding. It clearly separates the creator’s account from supplied records. A later Work Receipt reports movement in those recorded areas without grading the change as good or bad.

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
