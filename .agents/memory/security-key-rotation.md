---
name: Authenticator encryption key rotation
description: Operational constraints for changing the authenticator encryption root without locking out clients
---

Treat authenticator encryption-key rotation as a migration of encrypted data,
not a routine configuration replacement. Preserve access to the old key until
all active and pending authenticator secrets have been re-encrypted. Never
silently disable two-factor protection or force clients to re-enroll to hide a
missing key.

**Why:** Authenticator seeds must be recoverable by the verifier. Replacing the
encryption root before migrating ciphertext makes otherwise valid
authenticators impossible to verify and can lock clients out. Session-signing
key rotation must remain independent from this lifecycle.

**How to apply:** When changing security configuration, establish whether
authenticator ciphertext exists, plan and authorize the re-encryption first,
and use only the approved secure configuration flow for keys. Never expose keys
or decrypted seeds in migration output.
