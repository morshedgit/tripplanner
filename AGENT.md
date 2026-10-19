# AGENT.md — TripPlanner Multi-Agent Workflow

This document defines the multi-agent workflow and operating practices for the **TripPlanner** repository.

---

## 1. Main Session as Manager
- The main session acts strictly as the **Manager** (orchestrator).
- When a chat request requires work to be done on the TripPlanner project, the Manager breaks the request down into discrete tasks.
- The Manager creates GitHub Issues (`gh issue create`) for each task before any implementation begins.

---

## 2. Subagent Creation, Issue Assignment & Model Selection
- The Manager creates worker subagents (`invoke_subagent`) and assigns each GitHub Issue to a subagent.
- When spawning a subagent, the Manager selects a **strong** or **weak** model (`Model: "pro"` vs. `Model: "flash"` / `"flash_lite"`) based on the task requirements:
  - **Strong Model (`pro`)**: Complex architecture, intricate itinerary/chat/plugin logic, multi-file refactors, or difficult debugging.
  - **Weak Model (`flash` / `flash_lite`)**: Simple tasks, straightforward CRUD, minor UI/text updates, boilerplate, or documentation.

---

## 3. Isolated Worktree Execution & Pull Requests
- Every assigned worker subagent must do its work in an **isolated Git worktree** (e.g., `git worktree add` or isolated shared workspace branch) dedicated to its issue.
- When the subagent finishes its task, it pushes its branch, **raises a Pull Request (`gh pr create`)**, and notifies the Manager (`send_message`).

---

## 4. Peer Review & Merge Process
- Once a PR is raised, the Manager assigns the PR to **another subagent** for code review.
- The Reviewer subagent inspects the changes and leaves **inline comments** on the PR.
- **Approval & Merge**: An inline comment stating that the **PR is approved** is sufficient for the Manager to merge the PR into the `main` branch (`gh pr merge`).
- **Conflicts & Change Requests**: If there is a merge conflict or any inline review comment that needs to be resolved, the Manager returns the PR to the **owner subagent of that PR** to address the comments or resolve the conflicts.

---

## 5. Human Communication Protocol
- Subagents never ask the human directly.
- If a subagent needs input or clarification from the human, it asks the **Manager** (`send_message`), and the **Manager** communicates with the human and relays the response back to the subagent.
