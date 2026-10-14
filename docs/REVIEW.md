# Learning progression and privacy review

Reviewed main at `f82e2a88f8d3da78e0fa2f0714687607093f761e`.

## Findings and changes

- **Historical early completion, reproduced:** version `c802d4e` used `data.terms.find(t => t.id === queue.shift())`. Every comparison removed another queue entry. After the first answer, searching for the next card drained the queue and ended the session. Main already uses a fixed queue and separate position. That fix is retained and covered by regression tests. The latest main cannot reproduce this historical failure under normal storage conditions. An older downloaded/cached copy may still contain it.
- **Storage failures, reproduced on main:** `localStorage.setItem` could throw before `next()`, leaving the same revealed card active after a rating. Writes now fail visibly without blocking progression. In-memory progress can be exported. Failed reads or invalid saved data show a warning and preserve the existing saved content; explicitly confirming a valid restore permits replacement. Successful writes clear transient write warnings.
- **Malformed state and imports:** validate terms, progress and history before use; reject malformed rows, duplicate case-insensitive IDs and reserved object-property IDs before mutating the deck. Use own-property progress lookup and a null-prototype progress dictionary. Invalid pasted input displays an error. Case-only acronym updates preserve the original ID, so progress and active session references survive.
- **Restoring during a session:** clear the previous queue/current card to prevent recording answers from the old deck against the restored deck.
- **Directions:** changing direction refreshes the same card and hides the previous answer, without advancing or rating it.
- **Hints:** add missing Resilience (Domain 3) and Fundamentals (Domain 1) mappings. Every starter category now has an explicit domain and topic. First-letter masks now hide repeated occurrences of a word's first letter and subsequent digits. Domain mappings remain category-based study guidance, not authoritative per-term exam-objective classification.
- **Privacy copy:** clarify that persistence belongs to a browser profile and site origin, not a user login. Shared profiles share progress; backups include review history.

## Validation

Actual headless Chromium 154 with Playwright 1.62.1 against a local HTTP server. `node tests/learning.cjs`: **13 checks passed**.

1. Two consecutive new batches complete 16 distinct cards each.
2. A further 16-card session completes through visible buttons and keyboard shortcuts.
3. Instant Recall increments streak/reviews and schedules 1, 3, 6, 10 and 14 days; Hesitated reduces streak and schedules three days at higher streaks; Missed resets streak and schedules tomorrow. Both lower ratings mark terms introduced.
4. Missed Terms and Due Reviews complete their initial snapshot queues.
5. Random Drill completes every loaded term exactly once.
6. All three directions display/reveal the expected answer; hints include domain/topic; all starter categories have mappings; repeated first letters are masked.
7. Progress survives reload; a separate browser context starts with independent progress.
8. Injected quota/write failure still permits all 16 answers and displays an export warning.
9. Case-only term edits retain progress.
10. Invalid/duplicate/reserved imports are rejected atomically; imported HTML is rendered as text.
11. JSON restore removes the stale session; a two-card final batch and an exhausted deck behave correctly.
12. Corrupt saved data and denied storage reads boot safely, allow study and preserve corrupt stored content.
13. No uncaught browser errors in the primary test page.

`git diff --check` also passes. There is no build, dependency manifest, backend or existing test suite in the original repository. No production deployment was tested or changed. Tests use synthetic browser data, not anyone's real study history.

## Privacy/security scope and remaining limitations

- No application fetch/XHR, remote scripts, analytics, authentication, server-side database or embedded credentials found in this single-file app. Hosting providers can still log normal page requests. Host configuration and account permissions were not audited.
- Browser storage is isolated by profile and origin, **not by person**. Anyone with access to the same browser profile/site can view or modify progress. Pages on the same origin can also access the key. There is no encrypted storage or cross-device account sync.
- Simultaneous tabs can overwrite one another's saves. Use one study tab at a time; cross-tab conflict handling remains future work.
- JSON/CSV exports are unencrypted. CSV fields imported from untrusted sources could be interpreted as spreadsheet formulas when opened in spreadsheet software; HTML escaping does not protect that separate use case. Do not open untrusted deck exports as active spreadsheet content.
- The CSV parser handles quotes within one line, but not multiline quoted fields; exported explanations containing newlines may not round-trip. JSON is the reliable full-backup format.
- Random Drill uses the existing biased random-sort shuffle. Tests verify coverage, not a uniform statistical distribution.
- The November 1 goal is hard-coded to 2026. Daily 16 is a batch/plan target; additional batches are intentionally allowed. Sessions are not resumed after reload, but completed ratings persist.
- This is a targeted code and browser review, not a comprehensive penetration test. Safari, Firefox, mobile and production caching were not tested.

## Reproduce

Serve the repository from one terminal:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

With Node.js, Playwright and Chromium available, in another terminal from the repository:

```sh
node tests/learning.cjs
```

`CHROMIUM_PATH` overrides the default `/usr/bin/chromium`; `APP_URL` overrides the primary test page URL (keep the local server running for the additional contexts). If Playwright is not installed, install it outside the checkout and set `NODE_PATH`, for example `npm install --prefix /tmp/recall-test-tools --no-save playwright@1.62.1`, then `NODE_PATH=/tmp/recall-test-tools/node_modules node tests/learning.cjs`. Application runtime has no npm dependencies.
