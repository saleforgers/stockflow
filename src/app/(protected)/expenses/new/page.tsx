import { randomUUID } from "node:crypto";

import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { currentBusinessDate } from "@/lib/format";
import { createExpenseAction } from "@/modules/expenses/actions";
import { ExpenseForm } from "@/modules/expenses/forms";
import { getExpenseFormOptions } from "@/modules/expenses/queries";

export default async function NewExpensePage() {
  await requireRole(["ADMIN", "MANAGER"]);
  const options = await getExpenseFormOptions();
  return (
    <>
      <PageHeader
        title="Add Expense"
        description="Record a paid operating expense. This does not affect inventory cost."
      />
      <ExpenseForm
        action={createExpenseAction}
        categories={options.categories}
        date={currentBusinessDate()}
        paymentMethods={options.paymentMethods}
        requestKey={randomUUID()}
      />
    </>
  );
}
