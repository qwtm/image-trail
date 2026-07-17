import type { InteropCounts } from '../../core/interop/messages.js';
import { parseInteropEnvelope } from '../../core/interop/messages.js';
import { INTEROP_CONTRACT_VERSION, INTEROP_MAGIC } from '../../core/interop/contract.js';
import { EncryptedInteropTransport, type InteropObjectStore } from '../../core/interop/transport.js';
import { InteropRecordExportStore } from './record-export.js';
import { sealInteropMessage } from './sealed-message.js';
import { SecureMoveOutboxRepository } from './secure-move-outbox-repository.js';
import type { StoredInteropKeyRecord } from '../repositories/interop-keys-repository.js';
import type { StoredMoveJournal } from './move-journal-types.js';

export interface MoveOutboxProgress {
  readonly transferId: string;
  readonly journal: StoredMoveJournal;
  readonly counts: InteropCounts;
  readonly delivered: number;
  readonly pending: number;
}

interface MoveOutboxPublisherOptions {
  readonly now?: (() => string) | undefined;
  readonly createId?: (() => string) | undefined;
}

export class MoveOutboxPublishError extends Error {
  override readonly name = 'MoveOutboxPublishError';

  constructor(
    message: string,
    readonly progress: MoveOutboxProgress,
    readonly sourceError: unknown,
  ) {
    super(message);
  }
}

export async function readMoveOutboxProgress(db: IDBDatabase, transferId: string, total: number): Promise<MoveOutboxProgress | null> {
  const stored = await new SecureMoveOutboxRepository(db).progress(transferId);
  if (!stored) return null;
  return {
    transferId,
    journal: stored.journal,
    counts: withUnsupported(stored.journal.counts, total),
    delivered: Math.max(0, stored.journal.counts.total - stored.pending),
    pending: stored.pending,
  };
}

function withUnsupported(counts: InteropCounts, total: number): InteropCounts {
  const unsupported = Math.max(0, total - counts.total);
  return { ...counts, total, unsupported: counts.unsupported + unsupported };
}

function outboxPath(sequence: number, messageId: string): string {
  return `messages/outbox/${String(sequence).padStart(12, '0')}-${messageId}.json.aesgcm`;
}

export class MoveOutboxPublisher {
  readonly #now: () => string;
  readonly #createId: () => string;

  constructor(
    private readonly db: IDBDatabase,
    private readonly store: InteropObjectStore,
    options: MoveOutboxPublisherOptions = {},
  ) {
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#createId = options.createId ?? (() => crypto.randomUUID());
  }

  async start(input: {
    readonly transferId: string;
    readonly recordIds: readonly string[];
    readonly pairing: StoredInteropKeyRecord;
  }): Promise<MoveOutboxProgress> {
    const reviewed = await new InteropRecordExportStore(this.db, {
      now: this.#now,
      createId: this.#createId,
    }).review(input.recordIds);
    if (reviewed.records.length === 0) throw new Error('No supported Image Trail records were available for Move.');
    const outbox = new SecureMoveOutboxRepository(this.db);
    const createdAt = this.#now();
    let sequence = 0;
    for (const item of reviewed.records) {
      sequence += 1;
      const envelope = parseInteropEnvelope({
        header: {
          magic: INTEROP_MAGIC,
          contractVersion: INTEROP_CONTRACT_VERSION,
          messageId: this.#createId(),
          transferId: input.transferId,
          pairingId: input.pairing.pairingId,
          sourceProduct: 'image-trail',
          targetProduct: 'overlook',
          operation: 'move',
          kind: 'record',
          createdAt,
          sequence,
        },
        payload: {
          kind: 'record',
          schemaVersion: 1,
          record: item.record,
          albums: item.albums,
          reviewCategory: item.reviewCategory,
        },
      });
      const ciphertext = await sealInteropMessage(envelope, input.pairing);
      try {
        await outbox.queue({
          pairingId: input.pairing.pairingId,
          transferId: input.transferId,
          messageId: envelope.header.messageId,
          sequence: envelope.header.sequence,
          interopId: item.record.identity.interopId,
          sourceLocalId: item.localId,
          reviewCategory: item.reviewCategory,
          path: outboxPath(envelope.header.sequence, envelope.header.messageId),
          ciphertext,
          at: createdAt,
        });
      } finally {
        ciphertext.fill(0);
      }
    }
    return this.publish(input.transferId, input.pairing, reviewed.requested);
  }

  async resume(transferId: string, pairing: StoredInteropKeyRecord, total: number): Promise<MoveOutboxProgress> {
    return this.publish(transferId, pairing, total);
  }

  async status(transferId: string, total: number): Promise<MoveOutboxProgress | null> {
    return readMoveOutboxProgress(this.db, transferId, total);
  }

  private async publish(transferId: string, pairing: StoredInteropKeyRecord, total: number): Promise<MoveOutboxProgress> {
    const outbox = new SecureMoveOutboxRepository(this.db);
    const initial = await outbox.progress(transferId);
    if (!initial || initial.journal.pairingId !== pairing.pairingId) {
      throw new Error('Move outbox does not match the selected pairing custody.');
    }
    const transport = new EncryptedInteropTransport(this.store);
    const pending = await outbox.pending(transferId);
    for (const message of pending) {
      try {
        const ciphertext = new Uint8Array(message.ciphertext.slice(0));
        try {
          await transport.upload({ pairingId: pairing.pairingId, transferId }, message.path, ciphertext);
        } finally {
          ciphertext.fill(0);
        }
        await outbox.markDelivered(message.messageId, this.#now());
      } catch (error) {
        const progress = await this.status(transferId, total);
        if (!progress) throw error;
        throw new MoveOutboxPublishError('Move outbox upload is incomplete and can be resumed.', progress, error);
      }
    }
    const progress = await this.status(transferId, total);
    if (!progress) throw new Error('Move journal disappeared after outbox publication.');
    return progress;
  }
}
