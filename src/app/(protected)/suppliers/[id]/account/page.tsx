import { AccountPage } from "@/modules/accounts/account-page";
export default async function Page({
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/session";
import { formatDate, formatPkr } from "@/lib/format";
import { getSupplierAccount } from "@/modules/purchases/queries";

export default async function SupplierAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <AccountPage id={(await params).id} kind="supplier" query={await searchParams} />;
}
