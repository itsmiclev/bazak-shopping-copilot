# Conversation storage

`ConversationStore` is a single-process key-value database: a `Map` is the read index, and a JSON snapshot is the durable representation. Each write is serialized, validated, written to a sibling temporary file, flushed, and atomically renamed before the new state becomes readable. Failed commits leave the prior in-memory version intact. Files are created with owner-only permissions.

This keeps local setup independent of Docker and Redis while preserving the requested memory-first design. It is deliberately a small local implementation, not a substitute for Redis or a transactional database in production. Every mutation rewrites the full dataset; the server must throttle streaming checkpoints. Two processes must never open the same path. File flushing protects the contents, but directory metadata is not explicitly flushed, so sudden power loss has weaker durability than a production database.

Reads enforce `ownerId`; unauthorized access looks identical to a missing conversation. Owner IDs are bearer identities supplied by the server's cookie layer, not authenticated accounts. Clearing that cookie severs access to existing history; there is no recovery or cross-device association.

Conversation pages contain at most 20 summaries, ordered by activity time and ID. Their cursor records that ordering boundary. Message pages contain the preceding 20 messages in chronological order; `before` is the first message ID on the already-loaded page. New messages do not shift older-message pagination. A conversation moving during history pagination can be omitted from that session's older pages; refreshing the list restores its current position.

Malformed or unreadable snapshots stop startup without rewriting the file. Recovery requires preserving the damaged file and restoring a known-good backup or explicitly moving it aside to start fresh. Pending and streaming messages become errors on restart, retaining their partial text. This makes an interrupted process visible rather than leaving a spinner running forever. The application can recover disconnected browsers while the process remains running, but cannot resume an LLM request across a process crash.

Storage errors use stable codes: `CORRUPT`, `WRITE_FAILED`, `NOT_FOUND`, and `INVALID_CURSOR`. The API should return a useful error and retain user input on write failure. Data retention, backups, automatic eviction, multi-process locking, and disk quota management are deferred.
