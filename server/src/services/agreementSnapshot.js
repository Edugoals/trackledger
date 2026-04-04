import { buildAgreementPreviewData } from './agreementPreview.js';

const FINALIZED = 'finalized';

/**
 * Creates a new immutable agreement row with a full JSON snapshot (live data at this moment).
 */
export async function createAgreementSnapshot(prisma, { userId, trackId }) {
  const data = await buildAgreementPreviewData(prisma, { userId, trackId });
  if (!data) return null;

  const agg = await prisma.agreement.aggregate({
    where: { trackId, userId },
    _max: { version: true },
  });
  const nextVersion = (agg._max.version ?? 0) + 1;

  return prisma.agreement.create({
    data: {
      trackId,
      userId,
      version: nextVersion,
      status: FINALIZED,
      data,
    },
  });
}
