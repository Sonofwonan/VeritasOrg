---
name: Authenticator grace policy
description: User-approved timing tolerance and constraints for authenticator-code acceptance
---

The user chose a 60-second server timing tolerance while retaining standard 30-second authenticator-code rotation and existing single-use protections.

**Why:** They wanted more time to enter codes and approved the wider acceptance window after being told it slightly increases the opportunity to misuse an intercepted code.

**How to apply:** Preserve this policy in future security changes unless the user requests otherwise. Describe it as timing tolerance, not a changed Google Authenticator countdown or a guaranteed fixed code lifetime. Never clear consumed-code history, force re-enrollment, or extend login-session/challenge lifetimes merely to accommodate the wider window.
