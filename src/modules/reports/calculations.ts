import { decimal, roundMoney } from "@/lib/decimal/decimal";
export function profitTotals(input: {
  sales: { toString(): string };
  returns: { toString(): string };
  cost: { toString(): string };
  returnedCost: { toString(): string };
  expenses: { toString(): string };
}) {
  const sales = roundMoney(decimal(input.sales).minus(input.returns.toString()));
  const cost = roundMoney(decimal(input.cost).minus(input.returnedCost.toString()));
  const gross = sales.minus(cost);
  return {
    netSales: sales.toFixed(2),
    cogs: cost.toFixed(2),
    grossProfit: gross.toFixed(2),
    expenses: roundMoney(input.expenses).toFixed(2),
    netProfit: roundMoney(gross.minus(input.expenses.toString())).toFixed(2),
  };
}
