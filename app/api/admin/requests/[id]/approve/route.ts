import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import {
  ApiError,
  ConflictCodeError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";
import { AdminRequestStatusSchema } from "@/lib/validation/admin";
import { generateInvoiceNumber } from "@/lib/api/invoice";
import { generateReceiptNumber } from "@/lib/api/invoice";
import { dispatch } from "@/lib/notifications/dispatcher";
import { NotFoundError } from "@/lib/errors";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getRequestUser();
  if (!admin) {
    return apiError(new UnauthorizedError());
  }
  if (admin.role === 'INVENTORY_MANAGER') {
    return apiError(new ForbiddenError('Only admins can approve requests.'));
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = AdminRequestStatusSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(new ValidationError("Invalid payload.", parsed.error.flatten()));
  }

  const request = await prisma.request.findUnique({
    where: { id },
    include: {
      items: { include: { item: true } },
      user: true,
    },
  });

  if (!request) {
    return apiError(new NotFoundError("Request not found."));
  }

  if (request.status !== "REQUESTED" && request.status !== "PENDING") {
    return apiError(
      new ConflictCodeError("ALREADY_PROCESSED", "Request already processed.")
    );
  }

  const invoiceNumber = generateInvoiceNumber(request.sessionYear);

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of request.items) {
        const effectiveQty = item.quantityAllocated ?? item.quantityReq

        const [row] = await tx.$queryRaw<
          { id: string; availableQty: number; name: string }[]
        >`SELECT id, "availableQty", name FROM "InventoryItem" WHERE id = ${item.itemId} FOR UPDATE`;

        if (!row || row.availableQty < effectiveQty) {
          throw new ConflictCodeError("INSUFFICIENT_STOCK", "Insufficient stock.", {
            itemId: item.itemId,
            available: row?.availableQty ?? 0,
          });
        }

        const newQty = row.availableQty - effectiveQty;
        await tx.inventoryItem.update({
          where: { id: item.itemId },
          data: { availableQty: newQty },
        });

        await tx.stockHistory.create({
          data: {
            itemId: item.itemId,
            changeType: "FULFILLED",
            quantityDelta: -effectiveQty,
            quantityAfter: newQty,
            changedBy: admin.id,
            requestId: request.id,
            notes: "Request approved",
          },
        });

        await tx.requestItem.update({ where: { id: item.id }, data: { quantityFul: effectiveQty } });

        // Create ExpenditureRecord if item has unitPrice
        const inv = await tx.inventoryItem.findUnique({ where: { id: item.itemId }, select: { unitPrice: true, name: true, category: true } })
        if (inv && inv.unitPrice !== null) {
          const unitPriceNum = Number(inv.unitPrice)
          const totalAmount = Number((unitPriceNum * effectiveQty).toFixed(2))
          await tx.expenditureRecord.create({
            data: {
              requestId: request.id,
              requestItemId: item.id,
              itemId: item.itemId,
              itemName: inv.name,
              category: inv.category,
              unitPrice: inv.unitPrice.toString(),
              quantityFulfilled: effectiveQty,
              totalAmount: totalAmount.toString(),
              sessionYear: request.sessionYear,
              approvedAt: new Date(),
              approvedBy: admin.id,
              department: request.user.department,
            },
          })
        }
      }

      const receiptNumber = generateReceiptNumber(request.sessionYear);

      await tx.request.update({
        where: { id },
        data: {
          status: "APPROVED",
          adminId: admin.id,
          adminNotes: parsed.data.adminNotes,
          processedAt: new Date(),
          invoiceNumber,
          receiptNumber,
        },
      });

      await tx.requestStatusHistory.create({
        data: {
          requestId: id,
          fromStatus: request.status,
          toStatus: "APPROVED",
          changedBy: admin.id,
          notes: parsed.data.adminNotes,
        },
      });
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return apiError(error);
    }
    throw error;
  }

  const requestOrigin = new URL(req.url);
  const invoiceDownloadUrl = new URL(`/api/user/requests/${id}/invoice-download`, requestOrigin).toString();
  const receiptDownloadUrl = new URL(`/api/user/requests/${id}/receipt-download`, requestOrigin).toString();

  await dispatch({
    userId: request.userId,
    type: "REQUEST_APPROVED",
    title: "Request approved",
    message: "Your request was approved.",
    requestId: id,
    sendEmail: true,
    emailTo: request.user.email,
    emailData: {
      invoiceNumber,
      recipientName: request.user.name,
      downloadUrl: invoiceDownloadUrl,
    },
  });

  return apiSuccess({
    id,
    status: "APPROVED",
    invoiceNumber,
    invoiceUrl: invoiceDownloadUrl,
    receiptUrl: receiptDownloadUrl,
  });
}

export const dynamic = "force-dynamic";
