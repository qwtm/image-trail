# data/ — Claude Code context

Persistence layer: IndexedDB (`db.ts`, `migrations.ts`), repositories
(`repositories/`), and crypto envelopes (`crypto/`). Read `AGENTS.md` →
"Storage Rules" for the product invariants; this stub records the crypto/IDB
traps that are easy to get wrong.

- **Never reseal encrypted metadata just to reorder.** `sealJsonEnvelope`
  (`crypto/envelope.ts`) mints a fresh IV per seal and binds `key` /
  `authenticatedMetadata` into AES-GCM AAD, which must round-trip byte-for-byte
  (`repositories/hydration.ts` returns stored rows, never reconstructed copies).
  Reordering rewrites only the plaintext `queueUpdatedAt` column via
  `updateQueueUpdatedAt` (`repositories/bookmarks-repository.ts`,
  `repositories/encrypted-pins-repository.ts`) — never a decrypt → reseal.
- **Queue order is `queueUpdatedAt`,** not the envelope's `updatedAt`. Pages
  read the `queueUpdatedAt` IndexedDB index newest-first
  (`openCursor(null, 'prev')`); `moveToFront` (`bookmarks-controller.ts`)
  reorders by writing later timestamps, not by moving array elements.
- **Blob reference counts gate deletion.** `blobs-repository.ts` `remove()`
  decrements `referenceCount` and only deletes the blob once it would drop to
  zero (`<= 1`); new blobs start at `1`. `deleteMany()` is a separate, explicit
  hard-delete path. Do not delete original-photo blobs outside these rules.
