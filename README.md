# Release Commander

> An AI-powered release-readiness agent that investigates software releases, detects deterministic blockers, proposes minimal remediation, and places a human approval gate between diagnosis and modification.

Built with the **TrueForge Agent Harness**, **GitHub MCP**, deterministic sandbox verification, and a dedicated **Release Control Room**.

---

## The Problem

Software releases often involve a fragmented sequence of manual checks:

- Inspect repository state
- Verify release configuration
- Run tests
- Identify blockers
- Determine the safest remediation
- Obtain human approval
- Apply the change
- Verify the release again

AI agents can automate much of this workflow, but allowing an autonomous agent to modify production software without oversight introduces significant risk.

**Release Commander separates autonomous investigation from human-authorised execution.**

The agent can inspect, reason, and verify automatically. State-changing remediation remains behind an explicit human checkpoint.

---

## How It Works

Release Commander follows a five-stage workflow:

### 1. Discover

The agent examines the target repository and release candidate.

It identifies repository structure, configuration, branch state, and verification mechanisms.

### 2. Verify

The candidate is evaluated using deterministic verification inside the TrueForge sandbox.

For the demo fixture:

```bash
python3 scripts/release_verify.py
```

A blocked candidate returns:

```text
RELEASE BLOCKED
```

with a non-zero exit status.

### 3. Diagnose

Release Commander isolates the root cause and proposes the smallest remediation.

Demo blocker:

```json
"allowProductionRelease": false
```

Proposed remediation:

```diff
- "allowProductionRelease": false
+ "allowProductionRelease": true
```

No remediation is applied during the investigation phase.

### 4. Human Safety Gate

The Release Control Room presents the detected blocker and proposed diff.

Execution stops until the operator explicitly chooses whether to approve the change.

```text
APPROVE & APPLY PATCH
```

This creates a clear human-in-the-loop boundary between autonomous investigation and state-changing remediation.

### 5. Remediate & Re-Verify

After explicit approval, Release Commander is instructed to apply only the approved remediation inside the sandbox and run deterministic verification again.

Expected successful verification:

```text
SAFE TO SHIP
```

Remote GitHub mutation, deployment, tagging, and pushing are intentionally outside the demo remediation path.

---

## Architecture

```text
                  Developer / Release Operator
                             |
                             v
                +---------------------------+
                |   Release Control Room    |
                |       Next.js UI          |
                +-------------+-------------+
                              |
                       Server-side API
                              |
                              v
                +---------------------------+
                |      TrueForge API        |
                |     localhost:8790        |
                +-------------+-------------+
                              |
                              v
                +---------------------------+
                |    Release Commander      |
                |       Saved Agent         |
                +------+-------------+------+
                       |             |
                       v             v
                  GitHub MCP     Sandbox Exec
                       |             |
                       v             v
                 Repository      Deterministic
                 Inspection       Verification
                       \             /
                        \           /
                         v         v
                        Release Plan
                             |
                             v
                      HUMAN APPROVAL
                             |
                             v
                    Sandbox Remediation
                             |
                             v
                       Re-Verification
                             |
                             v
                       SAFE TO SHIP
```

---

## TrueForge Integration

The Release Control Room communicates with the local TrueForge server through server-side Next.js API routes.

```text
POST /api/trueforge-session
POST /api/trueforge-turn
POST /api/trueforge-approve
```

The browser does not communicate directly with the configured model provider.

A TrueForge session is created using the saved agent:

```text
release-commander
```

The agent configuration includes:

- TrueForge sandbox execution
- GitHub MCP integration
- Dynamic sub-agent capability
- Generative UI capability
- Human-question capability
- Approval requirements for GitHub write/destructive tools

TrueForge turn responses are streamed using **Server-Sent Events (SSE)**.

The Control Room also detects failed TrueForge turns. If the underlying agent execution fails, the UI does not present a successful release verdict or open the remediation approval gate.

---

## Human-in-the-Loop Safety Model

Release Commander separates actions into three categories:

| Tier | Action Type | Examples | Approval |
|---|---|---|---|
| 1 | Read | Repository inspection, configuration reading, Git history | Automatic |
| 2 | Validate | Tests, deterministic verification, static checks | Automatic |
| 3 | Modify / Release | File modification, Git writes, remote release actions | Human approval |

Core invariant:

> **Investigation may be autonomous. State-changing remediation must be explicitly authorised.**

For the hackathon demonstration, approved remediation is restricted to the sandbox.

The workflow does not automatically push the remediation to the remote GitHub repository.

---

## Deterministic Demo Fixture

The repository contains a deliberately broken demonstration branch:

```text
demo/broken-release
```

Its release configuration contains:

```json
{
  "environment": "production",
  "allowProductionRelease": false,
  "requiredTests": [
    "release configuration"
  ]
}
```

Running:

```bash
python3 scripts/release_verify.py
```

produces:

```text
RELEASE BLOCKED
```

The healthy `main` branch uses:

```json
"allowProductionRelease": true
```

This creates a deterministic demonstration:

```text
Broken Candidate
      |
      v
RELEASE BLOCKED
      |
      v
Agent Diagnosis
      |
      v
Exact Remediation Diff
      |
      v
Human Approval
      |
      v
Sandbox Patch
      |
      v
Re-Verification
      |
      v
SAFE TO SHIP
```

---

## Release Control Room

Release Commander includes a dedicated operator interface built with Next.js.

The Control Room visualises:

- Repository mapping
- Agent investigation
- Sandbox verification
- Release readiness
- Detected blockers
- Proposed remediation diff
- Human approval checkpoint
- TrueForge workflow output
- Final release verdict

The UI is not intended to replace TrueForge. It acts as a specialised release-engineering interface on top of the TrueForge agent workflow.

---

## Repository Structure

```text
release-commander/
|
|-- .github/
|   `-- workflows/
|       `-- ci.yml
|
|-- scripts/
|   `-- release_verify.py
|
|-- src/
|   `-- release-check.js
|
|-- tests/
|   `-- release-check.test.js
|
|-- control-room/
|   |-- pages/
|   |   |-- api/
|   |   |   |-- trueforge-session.ts
|   |   |   |-- trueforge-turn.ts
|   |   |   `-- trueforge-approve.ts
|   |   |
|   |   `-- index.tsx
|   |
|   |-- styles/
|   |-- public/
|   |-- package.json
|   `-- package-lock.json
|
|-- release.config.json
|-- package.json
`-- README.md
```

---

## Run the Verification Fixture

Clone the repository and enter the project:

```bash
git clone https://github.com/priyanshap/release-commander.git
cd release-commander
```

Run the existing Node test:

```bash
npm test
```

Run the deterministic release verifier:

```bash
python3 scripts/release_verify.py
```

On the healthy `main` branch, the verifier should return:

```text
SAFE TO SHIP
```

---

## Run the Broken Release Demo

Switch to the deliberately broken candidate:

```bash
git switch demo/broken-release
```

Run:

```bash
python3 scripts/release_verify.py
```

Expected result:

```text
RELEASE BLOCKED
```

Return to the healthy branch when required:

```bash
git switch main
```

---

## Run the Release Control Room

The Control Room now lives inside this repository.

From the repository root:

```bash
cd control-room
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

The Control Room expects the local TrueForge standalone server at:

```text
http://localhost:8790
```

The server location can be overridden server-side using the environment variable:

```text
TRUEFORGE_URL
```

---

## TrueForge Agent

The saved TrueForge agent is:

```text
release-commander
```

Its workflow has two major responsibilities.

### Investigator Stage

- Inspect the repository through GitHub MCP
- Examine release configuration
- Execute verification in the sandbox
- Detect deterministic release blockers
- Explain the root cause
- Produce the exact remediation diff

### Remediator & Approval Stage

- Stop before state-changing remediation
- Require explicit human approval
- Apply only the approved remediation
- Re-run verification
- Produce the final release verdict

---

## GitHub CI and Code Review Evidence

The repository contains a GitHub Actions workflow under:

```text
.github/workflows/ci.yml
```

The project has also been reviewed through Qodo Merge during development, providing additional code-review evidence alongside the deterministic release checks.

These signals complement the Release Commander workflow rather than replacing its sandbox verification.

---

## Failure-Aware UI

The Control Room distinguishes between a genuine release verdict and an infrastructure/model failure.

For example, if a TrueForge turn fails because the configured model provider is unavailable or rate-limited, the UI treats that as an execution failure.

It does **not** convert an agent failure into:

```text
RELEASE BLOCKED
```

or:

```text
SAFE TO SHIP
```

and it does not open the remediation gate without a valid investigation result.

This prevents the dashboard from presenting a synthetic release verdict when the underlying agent did not complete its work.

---

## Demo Flow

### 0:00–0:20 — The Problem

A release candidate appears ready, but a production policy setting prevents shipment.

The candidate branch is:

```text
demo/broken-release
```

### 0:20–0:55 — Autonomous Investigation

Launch Release Commander from the Control Room.

The application creates a TrueForge session and instructs the Release Commander agent to inspect the exact release candidate.

### 0:55–1:25 — Deterministic Blocker

The sandbox verifier executes:

```bash
python3 scripts/release_verify.py
```

and returns:

```text
RELEASE BLOCKED
```

Release Commander identifies:

```text
allowProductionRelease = false
```

### 1:25–1:55 — Human Safety Gate

The Control Room displays the minimal remediation:

```diff
- "allowProductionRelease": false
+ "allowProductionRelease": true
```

The workflow stops.

Nothing is modified until the operator explicitly approves the patch.

### 1:55–2:35 — Approved Remediation

The operator selects:

```text
APPROVE & APPLY PATCH
```

Release Commander continues the workflow and applies only the approved sandbox remediation.

The deterministic verifier is executed again.

### 2:35–3:00 — Release Verdict

Successful verification produces:

```text
SAFE TO SHIP
```

The release candidate has moved from a deterministic blocker to a verified state while preserving human control over the modification boundary.

---

## Why TrueForge

Release Commander uses TrueForge as the actual execution and orchestration layer rather than treating the harness as a wrapper around a chatbot.

TrueForge provides the runtime for:

- Agent sessions
- Model execution
- MCP tool access
- Sandbox execution
- Streamed turn events
- Human-controlled agent workflows

The Release Control Room consumes the TrueForge API and transforms those primitives into a purpose-built release-engineering experience.

---

## Why Release Commander

Traditional CI tells engineers:

> **Something failed.**

Release Commander is designed to go further:

> **What failed? Why is the release blocked? What is the smallest remediation? Can it be verified safely? And has a human authorised the change?**

The goal is not unrestricted autonomous deployment.

The goal is **controlled agentic release engineering**.

---

## Current Scope

This hackathon implementation focuses on a deterministic release-readiness workflow.

The current demonstration intentionally does not perform production deployment or automatically push remediation to GitHub.

Future extensions could include:

- Release tagging
- GitHub Release creation
- Deployment-provider integrations
- Migration safety checks
- Dependency-risk analysis
- Rollback orchestration
- Multi-service release coordination
- Release policy engines
- Production observability checks

---

## Built For

**The Agent Harness Hackathon**

Release Commander demonstrates how an agent harness can be used for a high-consequence engineering workflow where autonomous investigation is valuable, deterministic verification provides evidence, and human control remains mandatory around state-changing operations.
