import { AccountPage } from "@/modules/accounts/account-page";

export default async function SupplierAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <AccountPage id={(await params).id} kind="supplier" query={await searchParams} />;
}
