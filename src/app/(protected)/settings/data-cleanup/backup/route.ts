import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { inspectDemoFixtures } from "@/modules/maintenance/services";
import { parseIdentifier } from "@/lib/validation/identifier";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function GET(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return new Response("Authentication required", { status: 401 });
  if (actor.role !== "ADMIN") return new Response("Admin access required", { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  let backup;
  if (id) {
    const saved = await prisma.demoCleanupArchive.findUnique({
      where: { id: parseIdentifier(id, "Backup") },
      select: { backup: true },
    });
    if (!saved) return new Response("Backup not found", { status: 404 });
    backup = saved.backup;
  } else {
    const plan = await inspectDemoFixtures(actor);
    backup = {
      version: 1,
      fingerprint: plan.fingerprint,
      blockers: plan.blockers,
      rows: plan.rows,
    };
  }
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="StockFlow-demo-backup.json"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
