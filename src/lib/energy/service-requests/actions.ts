"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/current-session";
import { recordAudit } from "@/lib/core/audit";
import { nextDocumentNumber } from "@/lib/core/numbering";
import { canManageServiceRequests, canAssignServiceRequests } from "@/lib/core/permissions";
import { type FormActionState, firstFieldErrors, rawValues, nextAttempt, str } from "@/lib/core/form-state";
import { calculateLineItem, calculateDocumentTotals } from "@/lib/energy/shared/pricing";
import { serviceRequestFormSchema, resolveServiceRequestFormSchema } from "./schema";
import { SERVICE_REQUEST_STATUS_TRANSITIONS, type ServiceRequestStatus } from "./types";
import { computeWarrantyStatus } from "@/lib/energy/warranties/types";
import { computeAmcStatus } from "@/lib/energy/amc/types";
import { findActiveWarrantyForEquipment } from "@/lib/energy/warranties/queries";
import { findActiveAmcForCustomer } from "@/lib/energy/amc/queries";

const SERVICE_REQUESTS_PATH = "/service/service-requests";

function requireManager(role: Parameters<typeof canManageServiceRequests>[0]) {
  if (!canManageServiceRequests(role)) {
    throw new Error("You don't have permission to manage service requests.");
  }
}

function readForm(formData: FormData) {
  return {
    customerId: str(formData, "customerId"),
    siteId: str(formData, "siteId"),
    projectId: str(formData, "projectId"),
    installedEquipmentId: str(formData, "installedEquipmentId"),
    source: str(formData, "source"),
    requestDate: str(formData, "requestDate"),
    issue: str(formData, "issue"),
    description: str(formData, "description"),
    priority: str(formData, "priority"),
    serviceType: str(formData, "serviceType"),
    assignedToId: str(formData, "assignedToId"),
    expectedVisitDate: str(formData, "expectedVisitDate"),
  };
}

export async function createServiceRequestAction(_prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  const session = await requireSession();
  requireManager(session.role);

  const parsed = serviceRequestFormSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }
  const values = parsed.data;

  const customer = await prisma.party.findFirst({ where: { id: values.customerId, companyId: session.companyId, type: "CLIENT" } });
  if (!customer) {
    return { error: "Select a valid customer.", values: rawValues(formData), attempt: nextAttempt(_prevState) };
  }

  // Snapshot of coverage at the moment this request is logged (spec section
  // 11/19) — never re-derived later, so a warranty expiring afterward
  // doesn't silently rewrite what staff saw when they created this.
  let warrantyStatusAtRequest: string | null = null;
  let amcStatusAtRequest: string | null = null;
  if (values.installedEquipmentId) {
    const equipment = await prisma.installedEquipment.findFirst({
      where: { id: values.installedEquipmentId, companyId: session.companyId },
    });
    if (!equipment) {
      return { error: "Select a valid installed equipment.", values: rawValues(formData), attempt: nextAttempt(_prevState) };
    }
    const warranty = await findActiveWarrantyForEquipment({ companyId: session.companyId, installedEquipmentId: equipment.id });
    warrantyStatusAtRequest = warranty ? computeWarrantyStatus(warranty) : "EXPIRED";
    const amc = await findActiveAmcForCustomer({ companyId: session.companyId, customerId: values.customerId, siteId: equipment.siteId });
    amcStatusAtRequest = amc ? computeAmcStatus(amc) : "EXPIRED";
  }

  const serviceRequest = await prisma.$transaction(async (tx) => {
    const requestNumber = await nextDocumentNumber(tx, { companyId: session.companyId, series: "SR", prefix: "SR" });
    return tx.serviceRequest.create({
      data: {
        companyId: session.companyId,
        requestNumber,
        customerId: values.customerId,
        siteId: values.siteId,
        projectId: values.projectId,
        installedEquipmentId: values.installedEquipmentId,
        source: values.source,
        requestDate: new Date(values.requestDate),
        issue: values.issue,
        description: values.description,
        priority: values.priority,
        serviceType: values.serviceType,
        warrantyStatusAtRequest,
        amcStatusAtRequest,
        assignedToId: values.assignedToId,
        expectedVisitDate: values.expectedVisitDate ? new Date(values.expectedVisitDate) : undefined,
        status: values.assignedToId ? "ASSIGNED" : "OPEN",
        createdBy: session.userId,
      },
    });
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "SERVICE_REQUEST_CREATED",
    entityType: "ServiceRequest",
    entityId: serviceRequest.id,
    after: { requestNumber: serviceRequest.requestNumber },
  });

  revalidatePath(SERVICE_REQUESTS_PATH);
  redirect(`${SERVICE_REQUESTS_PATH}/${serviceRequest.id}`);
}

export async function assignServiceRequestAction(id: string, assignedToId: string): Promise<void> {
  const session = await requireSession();
  if (!canAssignServiceRequests(session.role)) {
    throw new Error("You don't have permission to assign service requests.");
  }

  const request = await prisma.serviceRequest.findFirst({ where: { id, companyId: session.companyId } });
  if (!request) return;

  const user = await prisma.user.findFirst({ where: { id: assignedToId, companyId: session.companyId } });
  if (!user) throw new Error("Select a valid team member.");

  const nextStatus = request.status === "OPEN" ? "ASSIGNED" : request.status;

  await prisma.serviceRequest.update({ where: { id }, data: { assignedToId, status: nextStatus } });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "SERVICE_REQUEST_ASSIGNED",
    entityType: "ServiceRequest",
    entityId: id,
    after: { assignedToId },
  });

  revalidatePath(SERVICE_REQUESTS_PATH);
  revalidatePath(`${SERVICE_REQUESTS_PATH}/${id}`);
}

export async function setServiceRequestStatusAction(id: string, newStatus: ServiceRequestStatus): Promise<void> {
  const session = await requireSession();
  requireManager(session.role);

  const request = await prisma.serviceRequest.findFirst({ where: { id, companyId: session.companyId } });
  if (!request) return;
  if (newStatus === "RESOLVED") {
    throw new Error("Use the resolve action to mark a request resolved - a resolution note is required.");
  }

  const allowed = SERVICE_REQUEST_STATUS_TRANSITIONS[request.status as ServiceRequestStatus] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot move a ${request.status} request to ${newStatus}.`);
  }

  await prisma.serviceRequest.update({ where: { id }, data: { status: newStatus } });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "SERVICE_REQUEST_STATUS_CHANGED",
    entityType: "ServiceRequest",
    entityId: id,
    before: { status: request.status },
    after: { status: newStatus },
  });

  revalidatePath(SERVICE_REQUESTS_PATH);
  revalidatePath(`${SERVICE_REQUESTS_PATH}/${id}`);
}

export async function resolveServiceRequestAction(
  id: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requireManager(session.role);

  const request = await prisma.serviceRequest.findFirst({ where: { id, companyId: session.companyId } });
  if (!request) return { error: "This service request no longer exists.", attempt: nextAttempt(_prevState) };

  const allowed = SERVICE_REQUEST_STATUS_TRANSITIONS[request.status as ServiceRequestStatus] ?? [];
  if (!allowed.includes("RESOLVED")) {
    return { error: `Cannot resolve a ${request.status.toLowerCase().replaceAll("_", " ")} request.`, attempt: nextAttempt(_prevState) };
  }

  const parsed = resolveServiceRequestFormSchema.safeParse({ resolution: str(formData, "resolution") });
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }

  await prisma.serviceRequest.update({ where: { id }, data: { status: "RESOLVED", resolution: parsed.data.resolution } });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "SERVICE_REQUEST_RESOLVED",
    entityType: "ServiceRequest",
    entityId: id,
  });

  revalidatePath(SERVICE_REQUESTS_PATH);
  revalidatePath(`${SERVICE_REQUESTS_PATH}/${id}`);
  redirect(`${SERVICE_REQUESTS_PATH}/${id}`);
}

// Chargeable service -> existing Energy Invoice, reusing the same
// Invoice/Receivables/Ledger machinery every other invoice goes through
// (spec section 31/32) — never a second "ServiceInvoice" system. Line items
// are built from parts consumed on this request's maintenance visits, plus
// an optional flat service charge the staff enters here.
export async function createInvoiceFromServiceRequestAction(id: string, formData: FormData): Promise<void> {
  const session = await requireSession();
  requireManager(session.role);

  const request = await prisma.serviceRequest.findFirst({
    where: { id, companyId: session.companyId },
    include: { maintenanceVisits: { include: { partsUsed: { include: { product: true } } } } },
  });
  if (!request) throw new Error("This service request no longer exists.");
  if (request.serviceType !== "CHARGEABLE") {
    throw new Error("Only a chargeable service request can be invoiced.");
  }
  if (request.invoiceId) {
    throw new Error("An invoice has already been created for this request.");
  }

  const serviceChargeRaw = str(formData, "serviceCharge");
  const serviceCharge = serviceChargeRaw ? Number(serviceChargeRaw) : 0;
  if (serviceChargeRaw && (Number.isNaN(serviceCharge) || serviceCharge < 0)) {
    throw new Error("Enter a valid service charge amount.");
  }

  const partsByProduct = new Map<string, { productId: string; productName: string; quantity: number; unitPrice: number; taxRate: number | null }>();
  for (const visit of request.maintenanceVisits) {
    for (const part of visit.partsUsed) {
      const key = part.productId;
      const existing = partsByProduct.get(key);
      if (existing) {
        existing.quantity += part.quantity;
      } else {
        partsByProduct.set(key, {
          productId: part.productId,
          productName: part.productName,
          quantity: part.quantity,
          unitPrice: part.product?.sellingPrice ?? 0,
          taxRate: part.product?.taxRate ?? null,
        });
      }
    }
  }

  const lineInputs: { productId: string | null; productName: string; quantity: number; unitPrice: number; taxRate: number | null }[] = [
    ...Array.from(partsByProduct.values()),
  ];
  if (serviceCharge > 0) {
    lineInputs.push({ productId: null, productName: "Service Charge", quantity: 1, unitPrice: serviceCharge, taxRate: null });
  }

  if (lineInputs.length === 0) {
    throw new Error("Add a service charge or record parts used on a maintenance visit before creating an invoice.");
  }

  const lineRows = lineInputs.map((line, index) => {
    const totals = calculateLineItem(line);
    return {
      productId: line.productId,
      productName: line.productName,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxRate: line.taxRate,
      discountAmount: totals.discountAmount,
      taxAmount: totals.taxAmount,
      lineSubtotal: totals.lineSubtotal,
      lineTotal: totals.lineTotal,
      sortOrder: index,
    };
  });
  const totals = calculateDocumentTotals(lineInputs, null, 0);

  const invoice = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await nextDocumentNumber(tx, { companyId: session.companyId, series: "EINV", prefix: "EINV" });
    const created = await tx.invoice.create({
      data: {
        companyId: session.companyId,
        invoiceNumber,
        status: "DRAFT",
        clientId: request.customerId,
        notes: `Service Request ${request.requestNumber}`,
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxableAmount: totals.taxableAmount,
        taxAmount: totals.taxAmount,
        otherCharges: totals.otherCharges,
        grandTotal: totals.grandTotal,
        paidAmount: 0,
        outstandingAmount: totals.grandTotal,
        createdBy: session.userId,
        items: { create: lineRows },
      },
    });
    await tx.serviceRequest.update({ where: { id }, data: { invoiceId: created.id } });
    return created;
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "SERVICE_REQUEST_INVOICE_CREATED",
    entityType: "ServiceRequest",
    entityId: id,
    after: { invoiceNumber: invoice.invoiceNumber, grandTotal: invoice.grandTotal },
  });

  revalidatePath(SERVICE_REQUESTS_PATH);
  revalidatePath(`${SERVICE_REQUESTS_PATH}/${id}`);
  redirect(`/sales/invoices/${invoice.id}`);
}
