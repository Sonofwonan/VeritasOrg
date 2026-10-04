---
name: Application password retention
description: Handling of password hashes left on legacy application records.
---

Retain password hashes already stored on application records; they are not used for login or account approval. Do not erase them without explicit approval.

**Why:** Clearing stored hashes is irreversible, and explicit consent to erase them was not given.

**How to apply:** When changing application migrations, approval/rejection handling, or cleanup jobs, preserve existing hashes while ensuring they are never treated as credentials.