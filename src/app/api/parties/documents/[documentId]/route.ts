import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/current-session";
import { readStoredFile } from "@/lib/core/storage/local-disk";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { documentId } = await params;
  const document = await prisma.document.findFirst({
    where: { id: documentId, companyId: session.companyId },
  });
  if (!document) {
    return new NextResponse("Not found", { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await readStoredFile(document.fileUrl);
  } catch {
    return new NextResponse("File missing", { status: 404 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": document.fileType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(document.fileName)}"`,
      "Content-Length": String(document.fileSize ?? bytes.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}
