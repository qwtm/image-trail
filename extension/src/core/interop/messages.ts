import * as v from 'valibot';
import {
  interopConflictActionSchema,
  interopErrorCodeSchema,
  interopHeaderSchema,
  interopNonNegativeIntegerSchema,
  interopPositiveIntegerSchema,
  interopReviewCategorySchema,
  interopTransferPhaseSchema,
  interopUuidSchema,
} from './contract.js';
import { interopAlbumSchema, interopBlobReferenceSchema, interopRecordSchema } from './records.js';

const nonEmptyStringSchema = v.pipe(v.string(), v.minLength(1));

export const interopCountsSchema = v.strictObject({
  total: interopNonNegativeIntegerSchema,
  eligible: interopNonNegativeIntegerSchema,
  duplicate: interopNonNegativeIntegerSchema,
  conflict: interopNonNegativeIntegerSchema,
  metadataOnly: interopNonNegativeIntegerSchema,
  unsupported: interopNonNegativeIntegerSchema,
  skipped: interopNonNegativeIntegerSchema,
  failed: interopNonNegativeIntegerSchema,
  acknowledged: interopNonNegativeIntegerSchema,
  finalized: interopNonNegativeIntegerSchema,
});

export const interopErrorSchema = v.strictObject({
  code: interopErrorCodeSchema,
  message: nonEmptyStringSchema,
  retryable: v.boolean(),
  recordInteropId: v.nullable(interopUuidSchema),
});

const manifestPayloadSchema = v.strictObject({
  kind: v.literal('manifest'),
  schemaVersion: v.literal(1),
  recordInteropIds: v.array(interopUuidSchema),
  albumInteropIds: v.array(interopUuidSchema),
  blobCount: interopNonNegativeIntegerSchema,
  counts: interopCountsSchema,
});

const recordPayloadSchema = v.strictObject({
  kind: v.literal('record'),
  schemaVersion: v.literal(1),
  record: interopRecordSchema,
  albums: v.array(interopAlbumSchema),
  reviewCategory: interopReviewCategorySchema,
});

const safeRelativePathSchema = v.pipe(
  nonEmptyStringSchema,
  v.check(
    (relativePath) =>
      !relativePath.startsWith('/') &&
      !relativePath.includes('\\') &&
      !relativePath.includes(':') &&
      relativePath.split('/').every((segment) => segment !== '' && segment !== '..'),
    'Path must be provider-relative and traversal-free.',
  ),
);

const blobPayloadSchema = v.pipe(
  v.strictObject({
    kind: v.literal('blob'),
    schemaVersion: v.literal(1),
    recordInteropId: interopUuidSchema,
    role: v.picklist(['original', 'thumbnail']),
    blob: interopBlobReferenceSchema,
    encryptedPath: safeRelativePathSchema,
    chunkIndex: interopNonNegativeIntegerSchema,
    chunkCount: interopPositiveIntegerSchema,
  }),
  v.check((payload) => payload.chunkIndex < payload.chunkCount, 'Chunk index must be less than chunk count.'),
);

const acknowledgementPayloadSchema = v.strictObject({
  kind: v.literal('acknowledgement'),
  schemaVersion: v.literal(1),
  status: v.picklist(['accepted', 'rejected']),
  recordInteropId: interopUuidSchema,
  targetLocalId: v.nullable(nonEmptyStringSchema),
  metadataPersisted: v.boolean(),
  originalVerification: v.picklist(['verified', 'metadata-only', 'unavailable']),
  acknowledgedMessageIds: v.pipe(v.array(interopUuidSchema), v.minLength(1)),
  errors: v.array(interopErrorSchema),
});

const journalPayloadSchema = v.strictObject({
  kind: v.literal('journal'),
  schemaVersion: v.literal(1),
  phase: interopTransferPhaseSchema,
  counts: interopCountsSchema,
  lastSequence: interopNonNegativeIntegerSchema,
  conflictDecisions: v.record(interopUuidSchema, interopConflictActionSchema),
  reviewedDeleteInteropIds: v.array(interopUuidSchema),
  errors: v.array(interopErrorSchema),
});

const errorPayloadSchema = v.strictObject({
  kind: v.literal('error'),
  schemaVersion: v.literal(1),
  error: interopErrorSchema,
});

export const interopPayloadSchema = v.variant('kind', [
  manifestPayloadSchema,
  recordPayloadSchema,
  blobPayloadSchema,
  acknowledgementPayloadSchema,
  journalPayloadSchema,
  errorPayloadSchema,
]);

export const interopEnvelopeSchema = v.pipe(
  v.strictObject({
    header: interopHeaderSchema,
    payload: interopPayloadSchema,
  }),
  v.check((envelope) => envelope.header.kind === envelope.payload.kind, 'Header and payload kinds must match.'),
);

export type InteropCounts = v.InferOutput<typeof interopCountsSchema>;
export type InteropError = v.InferOutput<typeof interopErrorSchema>;
export type InteropPayload = v.InferOutput<typeof interopPayloadSchema>;
export type InteropEnvelope = v.InferOutput<typeof interopEnvelopeSchema>;

export function parseInteropEnvelope(value: unknown): InteropEnvelope {
  return v.parse(interopEnvelopeSchema, value);
}
