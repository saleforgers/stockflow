import { statementPdf } from "@/modules/accounts/pdf";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return statementPdf(request, (await params).id, "supplier");
}
