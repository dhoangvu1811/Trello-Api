<!--
PR title: <type>(<scope>): <short imperative summary>
Types: feat, fix, refactor, test, docs, build, ci, chore, perf, security
Example: security(auth): rotate refresh tokens atomically

Keep this PR focused. Remove sections that are genuinely not applicable.
-->

## Summary

<!-- Explain the user or business problem and the outcome of this PR. -->

## Related work

<!-- Use "Closes #123", "Fixes #123", or link the relevant task/design. -->

- Closes: <!-- #issue -->
- Depends on: <!-- PR, Web change, or infrastructure change -->

## Change type

- [ ] Feature
- [ ] Bug fix
- [ ] Refactor
- [ ] Performance
- [ ] Security
- [ ] Test or documentation
- [ ] Build, CI, or dependency update
- [ ] Breaking change

## What changed

<!-- List the important implementation and behavior changes. -->

-

## API contract

<!-- Complete one row per affected endpoint. Write "None" when no endpoint changes. -->

| Method | Endpoint | Auth/role | Contract change | Compatibility |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

- Validation or error-response changes: <!-- None, or describe status codes/messages -->
- Compatible Web PR/deployment required: <!-- No, or link -->

## Data and persistence

- MongoDB collections affected: <!-- None, or list -->
- Schema or document-shape changes: <!-- None, or describe -->
- Indexes added, removed, or changed: <!-- None, or describe -->
- Migration/backfill required: <!-- No, or provide an idempotent plan -->
- Existing-data compatibility verified: <!-- Yes / No / N/A -->

## Security and realtime impact

- Authentication/session/cookie behavior affected: <!-- No, or describe -->
- Authorization or board-role behavior affected: <!-- No, or describe -->
- Rate limits or abuse controls affected: <!-- No, or describe -->
- Sensitive data exposure reviewed: <!-- Yes / N/A -->
- Socket.IO authentication, rooms, or events affected: <!-- No, or describe -->

## Configuration and deployment

- New or changed environment variables: <!-- None, or list names only -->
- Railway/build/start configuration changed: <!-- No, or describe -->
- Required deployment order: <!-- None, API first, Web first, or coordinated -->
- Operational actions: <!-- None, create indexes, rotate secrets, backfill, etc. -->

## Verification

<!-- Record commands and results. Use a disposable database for integration tests. -->

- [ ] `yarn lint`
- [ ] `yarn test`
- [ ] Required integration suite with `MONGODB_TEST_URI`
- [ ] Relevant Web/Playwright E2E tests
- [ ] Production build/start smoke test

### Test evidence

```text
Command:
Result:
```

### Scenarios verified

- [ ] Happy path
- [ ] Validation and malformed input
- [ ] Unauthenticated and unauthorized access
- [ ] Owner/admin/member/viewer role boundaries, when applicable
- [ ] Concurrent writes, refresh rotation, or replay behavior, when applicable
- [ ] Socket reconnect and room isolation, when applicable
- [ ] Legacy/existing data behavior

## Risk and rollback

- Risk level: <!-- Low / Medium / High -->
- Main risks: <!-- Describe likely failure modes and affected data -->
- Monitoring or validation after deployment: <!-- Logs, health checks, metrics, smoke tests -->
- Rollback plan: <!-- Revert PR, restore env, compatible schema rollback, etc. -->
- Data rollback plan: <!-- N/A, or describe without destructive assumptions -->

## Final checklist

- [ ] The PR has a focused scope and a clear title.
- [ ] No secrets, tokens, credentials, or production data are included.
- [ ] Inputs are validated and authorization is enforced server-side.
- [ ] Logs and client-facing errors do not expose sensitive information.
- [ ] Database changes are backward-compatible or include a safe migration plan.
- [ ] Tests cover the regression or new behavior.
- [ ] Documentation and `.env.example` are updated when required.
- [ ] Breaking changes and required deployment order are clearly identified.

## Reviewer notes

<!-- Point reviewers to the highest-risk files, invariants, or tradeoffs. -->

