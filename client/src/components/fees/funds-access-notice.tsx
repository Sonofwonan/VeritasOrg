import { useFundsAccess } from "@/hooks/use-funds-access";
export function FundsAccessNotice() {
  const access = useFundsAccess();
  if (!access.blocked) return null;
  return <p role="alert" className="mb-4 border border-red-300 bg-red-50 p-4 text-sm text-red-950">
    Payment must be recorded in the Brokerage Account and the debt cleared before access to funds can be granted.
    {access.isError && <button className="ml-2 underline" onClick={() => void access.refetch()}>Retry payment status</button>}
  </p>;
}
