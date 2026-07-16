import * as v from 'valibot';
import {
  interopConflictActionSchema,
  interopProductSchema,
  interopRevisionVectorSchema,
  interopTimestampSchema,
  interopUuidSchema,
  type InteropConflictAction,
  type InteropProduct,
} from '../../core/interop/contract.js';
import { interopEnvelopeSchema, type InteropEnvelope } from '../../core/interop/messages.js';
import { interopRecordSchema, type InteropRecord } from '../../core/interop/records.js';
import { SYNC_FIELDS, type SyncAnalysis, type SyncField } from '../../core/interop/sync-resolution.js';

export const syncDirectionSchema = v.picklist(['image-trail-to-overlook', 'overlook-to-image-trail', 'two-way']);
export const syncSessionPhaseSchema = v.picklist(['reviewing', 'transferring', 'paused', 'completed', 'cancelled', 'failed']);
export const syncItemStateSchema = v.picklist([
  'eligible',
  'duplicate',
  'conflict',
  'delete-review',
  'ready',
  'applied',
  'skipped',
  'failed',
]);
export const syncDeleteDecisionSchema = v.picklist(['apply', 'keep']);
export const syncScopeSchema = v.pipe(
  v.strictObject({
    kind: v.picklist(['all', 'selected', 'album']),
    localIds: v.pipe(v.array(v.pipe(v.string(), v.minLength(1))), v.readonly()),
  }),
  v.check((scope) => new Set(scope.localIds).size === scope.localIds.length, 'Sync scope ids must be unique.'),
  v.check(
    (scope) =>
      (scope.kind === 'all' && scope.localIds.length === 0) ||
      (scope.kind === 'selected' && scope.localIds.length > 0) ||
      (scope.kind === 'album' && scope.localIds.length === 1),
    'Sync scope ids do not match the selected scope kind.',
  ),
);

export type SyncDirection = v.InferOutput<typeof syncDirectionSchema>;
export type SyncSessionPhase = v.InferOutput<typeof syncSessionPhaseSchema>;
export type SyncItemState = v.InferOutput<typeof syncItemStateSchema>;
export type SyncDeleteDecision = v.InferOutput<typeof syncDeleteDecisionSchema>;
export type SyncScope = v.InferOutput<typeof syncScopeSchema>;

export interface SyncSessionRecord {
  readonly sessionId: string;
  readonly pairingId: string;
  readonly sourceProduct: InteropProduct;
  readonly targetProduct: InteropProduct;
  readonly direction: SyncDirection;
  readonly scope: SyncScope;
  readonly phase: SyncSessionPhase;
  readonly connected: boolean;
  readonly checkpoints: Readonly<Record<InteropProduct, number>>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SyncItemRecord {
  readonly id: string;
  readonly sessionId: string;
  readonly interopId: string;
  readonly imageTrailRecord: InteropRecord | null;
  readonly overlookRecord: InteropRecord | null;
  readonly analysis: SyncAnalysis;
  readonly decisions: Readonly<Partial<Record<SyncField, InteropConflictAction>>>;
  readonly deleteDecision: SyncDeleteDecision | null;
  readonly state: SyncItemState;
  readonly error: unknown;
  readonly receivedAt: string;
  readonly appliedAt: string | null;
}

export interface SyncReceiptRecord {
  readonly id: string;
  readonly pairingId: string;
  readonly messageId: string;
  readonly sessionId: string;
  readonly interopId: string;
  readonly envelope: InteropEnvelope;
  readonly receivedAt: string;
}

export interface SyncAuditRecord {
  readonly eventKey: string;
  readonly sessionId: string;
  readonly interopId: string | null;
  readonly event: string;
  readonly details: unknown;
  readonly createdAt: string;
}

export interface SyncProgressCounts {
  total: number;
  eligible: number;
  duplicate: number;
  conflict: number;
  deleteReview: number;
  ready: number;
  applied: number;
  skipped: number;
  failed: number;
}

const syncConflictSchema = v.strictObject({
  field: v.picklist(SYNC_FIELDS),
  imageTrailRevision: interopRevisionVectorSchema,
  overlookRevision: interopRevisionVectorSchema,
});

export const syncAnalysisSchema = v.strictObject({
  category: v.picklist(['eligible', 'duplicate', 'conflict', 'delete-review']),
  merged: interopRecordSchema,
  conflicts: v.pipe(v.array(syncConflictSchema), v.readonly()),
}) as v.GenericSchema<unknown, SyncAnalysis>;

export const syncSessionRecordSchema = v.strictObject({
  sessionId: interopUuidSchema,
  pairingId: interopUuidSchema,
  sourceProduct: interopProductSchema,
  targetProduct: interopProductSchema,
  direction: syncDirectionSchema,
  scope: syncScopeSchema,
  phase: syncSessionPhaseSchema,
  connected: v.boolean(),
  checkpoints: v.strictObject({
    'image-trail': v.pipe(v.number(), v.integer(), v.minValue(0)),
    overlook: v.pipe(v.number(), v.integer(), v.minValue(0)),
  }),
  createdAt: interopTimestampSchema,
  updatedAt: interopTimestampSchema,
}) as v.GenericSchema<unknown, SyncSessionRecord>;

export const syncItemRecordSchema = v.strictObject({
  id: v.string(),
  sessionId: interopUuidSchema,
  interopId: interopUuidSchema,
  imageTrailRecord: v.nullable(interopRecordSchema),
  overlookRecord: v.nullable(interopRecordSchema),
  analysis: syncAnalysisSchema,
  decisions: v.record(v.picklist(SYNC_FIELDS), interopConflictActionSchema),
  deleteDecision: v.nullable(syncDeleteDecisionSchema),
  state: syncItemStateSchema,
  error: v.unknown(),
  receivedAt: interopTimestampSchema,
  appliedAt: v.nullable(interopTimestampSchema),
}) as v.GenericSchema<unknown, SyncItemRecord>;

export const syncReceiptRecordSchema = v.strictObject({
  id: v.string(),
  pairingId: interopUuidSchema,
  messageId: interopUuidSchema,
  sessionId: interopUuidSchema,
  interopId: interopUuidSchema,
  envelope: interopEnvelopeSchema,
  receivedAt: interopTimestampSchema,
}) as v.GenericSchema<unknown, SyncReceiptRecord>;

export const syncAuditRecordSchema = v.strictObject({
  eventKey: v.string(),
  sessionId: interopUuidSchema,
  interopId: v.nullable(interopUuidSchema),
  event: v.pipe(v.string(), v.minLength(1)),
  details: v.unknown(),
  createdAt: interopTimestampSchema,
}) as v.GenericSchema<unknown, SyncAuditRecord>;

export function syncItemId(sessionId: string, interopId: string): string {
  return `${sessionId}:${interopId}`;
}

export function syncReceiptId(pairingId: string, messageId: string): string {
  return `${pairingId}:${messageId}`;
}

export function emptySyncCounts(): SyncProgressCounts {
  return { total: 0, eligible: 0, duplicate: 0, conflict: 0, deleteReview: 0, ready: 0, applied: 0, skipped: 0, failed: 0 };
}
