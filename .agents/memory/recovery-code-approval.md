---
name: Administrator-approved recovery codes
description: Client requests and administrator-only issuance of two-factor recovery codes
---

Only administrators may generate recovery codes, after a client submits a request. This includes the first set after authenticator enrollment; enrollment itself must not issue codes.

**Why:** The user explicitly required administrator-only generation after client requests.

**How to apply:** Keep requests separate from issuance. Require documented identity-verification confirmation before an administrator issues codes; show them once for secure delivery, store only their digests, replace old codes atomically and revoke existing client sessions. Do not introduce automatic emailing of codes or a client self-generation path.
