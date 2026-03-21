# App UX Rules (Fintech)

**Purpose**
Create a trustworthy, low‑anxiety money experience with clear actions, strong feedback, and minimal user error.

**Core Principles**
- Clarity before speed. Always show what will happen next and what it costs.
- Trust is a feature. Use explicit confirmation, transparent fees, and reversible actions.
- Reduce cognitive load. Prefer guided flows over dense forms.
- Make errors recoverable. Provide undo, edit, or cancel paths for critical actions.

**UX Do**
- Confirm high‑risk actions (send, export keys, large transfers).
- Show destination identity and address preview before sending.
- Use progressive disclosure for advanced settings.
- Provide clear system status for network calls and blockchain confirmations.
- Use haptics for touch confirmation on primary actions.
- Keep empty states instructive and action‑oriented.
- Validate inputs inline with actionable error messages.
- Provide a clear “Back” path in multistep flows.

**UX Don’t**
- Hide fees or network status.
- Surprise the user with irreversible actions.
- Force long forms without saving progress.
- Use ambiguous labels like “Continue” without context.

**Security & Trust**
- Highlight security‑sensitive actions with extra confirmation.
- Avoid auto‑filling sensitive data without explicit user intent.
- Provide guidance for safe recovery and backups.

**Accessibility**
- Minimum touch target size 44x44.
- High contrast for primary actions and error states.
- No critical info conveyed by color alone.

**Fintech-Specific Patterns**
- Show “Recipient + Amount + Fees + Network” together before send.
- Use “Review” screens to reduce errors.
- Provide local currency + base currency when relevant.
