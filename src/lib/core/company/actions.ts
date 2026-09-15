"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/current-session";
import { recordAudit } from "@/lib/core/audit";
import { type FormActionState, firstFieldErrors, rawValues, nextAttempt, str } from "@/lib/core/form-state";
import { companyProfileFormSchema } from "./schema";

export async function updateCompanyProfileAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  if (session.role !== "OWNER_ADMIN") {
    return { error: "Only Owner/Admin can change the company profile." };
  }

  const parsed = companyProfileFormSchema.safeParse({
    gstin: str(formData, "gstin"),
    pan: str(formData, "pan"),
    addressLine1: str(formData, "addressLine1"),
    addressLine2: str(formData, "addressLine2"),
    city: str(formData, "city"),
    state: str(formData, "state"),
    pincode: str(formData, "pincode"),
    phone: str(formData, "phone"),
    email: str(formData, "email"),
    bankAccountName: str(formData, "bankAccountName"),
    bankName: str(formData, "bankName"),
    bankAccountNumber: str(formData, "bankAccountNumber"),
    bankIfsc: str(formData, "bankIfsc"),
  });
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }

  await prisma.company.update({
    where: { id: session.companyId },
    data: parsed.data,
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "COMPANY_PROFILE_UPDATED",
    entityType: "Company",
    entityId: session.companyId,
  });

  revalidatePath("/settings");
  return { attempt: nextAttempt(_prevState) };
}
