# Release Commander

> A human-gated release-readiness control room powered by the TrueForge Agent Harness.

Release Commander investigates a software release, detects deterministic blockers, proposes the smallest remediation, pauses before mutation, and verifies the release again after explicit human approval.

The project combines **TrueForge**, **deterministic verification**, **GitHub MCP**, **Qodo code review**, and a dedicated **Next.js Release Control Room**.

---

## Why Release Commander?

CI can tell a developer that a release failed, but the next steps are often manual:

- identify the actual blocker;
- determine the smallest safe fix;
- decide whether that fix should be applied;
- verify that the release is safe afterwards.

Release Commander turns this into a controlled workflow:

```text
Release Candidate
       ↓
Investigation
       ↓
Deterministic Verification
       ↓
RELEASE BLOCKED
       ↓
Root Cause + Minimal Diff
       ↓
Human Approval
       ↓
Approved Remediation
       ↓
Re-Verification
       ↓
SAFE TO SHIP
```

The key principle is:

> **Investigation can be automated. Mutation requires human authority.**

---

## What It Does

Release Commander provides:

- release-candidate investigation;
- deterministic release verification;
- blocker detection;
- minimal remediation proposals;
- an explicit human approval gate;
- approved remediation in an isolated workspace;
- post-remediation verification;
- visible command and exit-code evidence;
- a final `RELEASE BLOCKED` or `SAFE TO SHIP` verdict.

The demo intentionally does **not** push, merge, tag, deploy, or modify the remote GitHub repository.

---

## Demo Fixture

The repository contains a deliberately broken branch:

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

The verifier runs:

```bash
python3 scripts/release_verify.py
```

and returns:

```text
RELEASE BLOCKED
```

Release Commander identifies the blocker:

```text
allowProductionRelease is false
```

and proposes:

```diff
- "allowProductionRelease": false
+ "allowProductionRelease": true
```

The workflow stops before applying the change.

After explicit human authorisation, the approved remediation is applied in an isolated verification workspace and the verifier runs again.

Successful verification returns:

```text
SAFE TO SHIP
EXIT_CODE: 0
```

---

## TrueForge Integration

Release Commander uses the **TrueForge Agent Harness** for agent sessions, tool configuration and controlled execution.

The development agent is:

```text
release-commander-demo
```

Its configuration includes:

- sandbox capability;
- GitHub MCP;
- dynamic sub-agents;
- generative UI;
- human-question capability;
- approval requirements for GitHub write/destructive tools.

A real TrueForge execution path was validated by executing:

```bash
printf TOOL_CALL_WORKS
```

through the configured execution capability and receiving:

```text
TOOL_CALL_WORKS
```

The release-critical verdict itself remains deterministic: `SAFE TO SHIP` is produced only when executable verification succeeds, rather than because an LLM predicts that the release is safe.

---

## Human Approval Boundary

Release Commander separates operations into three levels:

| Operation | Example | Approval |
|---|---|---|
| Inspect | Repository/configuration inspection | Automatic |
| Verify | Tests and release checks | Automatic |
| Modify | State-changing remediation | Human required |

The Control Room visibly stops at:

```text
HUMAN AUTHORISATION REQUIRED
```

The remediation path continues only after the operator selects:

```text
AUTHORISE MUTATION
```

For the current demo, remediation is limited to the approved configuration change in an isolated workspace.

The remote GitHub repository remains unchanged.

---

## Architecture

```text
Developer / Release Operator
            │
            ▼
┌─────────────────────────┐
│  Release Control Room   │
│        Next.js          │
└────────────┬────────────┘
             │
     ┌───────┴────────┐
     │                │
     ▼                ▼
┌─────────────┐  ┌──────────────────┐
│  TrueForge  │  │  Deterministic   │
│   Harness   │  │    Verifier      │
└──────┬──────┘  └────────┬─────────┘
       │                  │
       ▼                  ▼
 Agent / Tools      RELEASE BLOCKED
                          │
                          ▼
                    Minimal Fix
                          │
                          ▼
                  HUMAN APPROVAL
                          │
                          ▼
                    Remediation
                          │
                          ▼
                   Re-Verification
                          │
                          ▼
                    SAFE TO SHIP
```

TrueForge provides the agent-harness layer.

The deterministic verifier provides the release evidence.

The human operator retains mutation authority.

---

## Release Control Room

The project includes a dedicated Next.js interface for release operations.

The Control Room displays:

- release readiness;
- target repository and branch;
- workflow progress;
- detected blocker;
- proposed remediation diff;
- human approval state;
- verification output;
- exit code;
- remote mutation status;
- final release verdict.

This makes the approval boundary visible rather than hiding it inside an autonomous agent loop.

---

## Getting Started

### Prerequisites

For the core verification workflow:

- Git
- Python 3
- Node.js
- npm

For the complete agent-harness experience:

- TrueForge Agent Harness
- Ollama or another TrueForge-compatible model provider
- Docker if required by the configured sandbox
- GitHub MCP only if you want repository-tool integration

You should connect only accounts and resources that you own or are authorised to use.

### 1. Clone the repository

```bash
git clone https://github.com/priyanshap/release-commander.git
cd release-commander
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run the tests

```bash
npm test
```

### 4. Run the deterministic verifier

```bash
python3 scripts/release_verify.py
```

On the healthy `main` branch:

```text
SAFE TO SHIP
```

### 5. Reproduce the blocked candidate

```bash
git switch demo/broken-release
python3 scripts/release_verify.py
```

Expected result:

```text
RELEASE BLOCKED
```

Return to the main branch:

```bash
git switch main
```

---

## Run the Release Control Room

From the repository root:

```bash
cd control-room
npm install
npm run dev
```

Open the local URL printed by Next.js, normally:

```text
http://localhost:3000
```

If port `3000` is already occupied, use the alternate port printed by Next.js.

The Control Room expects TrueForge at:

```text
http://localhost:8790
```

A different server location can be supplied with:

```text
TRUEFORGE_URL
```

---

## Local Model Setup

Release Commander can use a local Ollama model, so a paid model API is not required for the development configuration.

Verify Ollama:

```bash
ollama --version
```

Pull the model used during development:

```bash
ollama pull qwen3:8b
```

Confirm it is available:

```bash
ollama list
```

Configure your own TrueForge installation to use your local Ollama provider.

A fresh TrueForge installation will not contain the development machine's saved agent. Create an agent named:

```text
release-commander-demo
```

and enable the capabilities required for the workflow, including sandbox execution.

GitHub MCP is optional for reproducing the deterministic fixture. If you enable it, connect only your own GitHub account and repositories you are authorised to access.

---

## API Routes

The Control Room uses server-side Next.js API routes:

```text
POST /api/trueforge-session
POST /api/trueforge-turn
POST /api/release-investigate
POST /api/trueforge-approve
```

`trueforge-session` creates the TrueForge session.

`trueforge-turn` provides the harness-driven agent execution path.

`release-investigate` performs the fast deterministic release investigation and returns the blocker, verification evidence and proposed remediation.

`trueforge-approve` handles the explicitly authorised remediation and re-verification path.

---

## Qodo Code Review Evidence

Qodo was configured as part of the project's pull-request review workflow.

**Reviewed Pull Request:**  
https://github.com/priyanshap/release-commander/pull/1

PR #1 contains both a **PR Summary by Qodo** and a **Code Review by Qodo**.

The public Qodo review reported:

- Bugs: **0**
- Rule violations: **0**
- Requirement gaps: **0**
- No material issues requiring review

This provides public evidence that Qodo was actively used in the project's pull-request workflow.

---

## Security and Privacy

Release Commander does not require credentials to be committed to the repository.

Do not commit:

- API keys;
- GitHub personal access tokens;
- model-provider credentials;
- passwords;
- private keys;
- `.env` secrets;
- billing information;
- personal account information.

Each person running the project should configure their own accounts and credentials locally.

If GitHub MCP is enabled, connect only repositories that you own or are authorised to access.

Secrets and personal data should also be kept out of public demo recordings.

---

## Repository Structure

```text
release-commander/
├── .github/
│   └── workflows/
├── control-room/
│   ├── pages/
│   │   ├── api/
│   │   │   ├── release-investigate.ts
│   │   │   ├── trueforge-session.ts
│   │   │   ├── trueforge-turn.ts
│   │   │   └── trueforge-approve.ts
│   │   └── index.tsx
│   └── styles/
├── scripts/
│   └── release_verify.py
├── src/
├── tests/
├── release.config.json
├── package.json
└── README.md
```

---

## Tech Stack

- **TrueForge Agent Harness** — agent orchestration and execution
- **Next.js** — Release Control Room
- **React + TypeScript** — frontend
- **Python** — deterministic release verification
- **GitHub MCP** — repository tooling
- **Qodo** — pull-request code review
- **Ollama** — local model inference
- **GitHub Actions** — CI

---

## Design Principles

**Deterministic evidence over model confidence**  
A release is safe only when executable verification succeeds.

**Human authority over mutation**  
Investigation may be automated; state-changing remediation requires approval.

**Minimal remediation**  
Only the exact release blocker should be changed.

**No hidden remote mutation**  
The demo does not silently push, merge, tag or deploy.

**Reproducible by others**  
The deterministic release fixture can be reproduced without access to the developer's private accounts or credentials.

---

## Built for The Agent Harness Hackathon

Release Commander demonstrates a controlled approach to agentic release engineering:

```text
TrueForge Agent Harness
        +
Deterministic Verification
        +
Human Approval
        +
Execution Evidence
        =
Controlled Release Automation
```

> **Investigate autonomously. Verify deterministically. Mutate only with human authority.**
