import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";

type TxClient = Prisma.TransactionClient | PrismaClient;

// Generic document-number generator — "QTN-0001", and later "SO-0001",
// "EINV-0001", "VPO-0001" reuse the same series mechanism. Must be called
// inside a transaction that also creates the document, so a failed create
// doesn't burn a number (and two concurrent creates never collide).
export async function nextDocumentNumber(
  tx: TxClient,
  params: { companyId: string; series: string; prefix: string; padWidth?: number }
): Promise<string> {
  const { companyId, series, prefix, padWidth = 4 } = params;

  const sequence = await tx.numberSequence.upsert({
    where: { companyId_series: { companyId, series } },
    update: { currentValue: { increment: 1 } },
    create: { companyId, series, currentValue: 1 },
  });

  return `${prefix}-${String(sequence.currentValue).padStart(padWidth, "0")}`;
}
