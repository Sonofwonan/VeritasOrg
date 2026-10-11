import { useFundsAccess } from "@/hooks/use-funds-access";
import { fundsActionFeedback } from "@shared/funds-access";
export function FundsAccessNotice() {
  const access = useFundsAccess();
  const feedback = fundsActionFeedback(access.blocked, access.data, access.isError);
  if (!feedback) return null;
  return <p role="alert" className="mb-4 border border-red-300 bg-red-50 p-4 text-sm text-red-950">
    {feedback.message}
    {feedback.retry && <button className="ml-2 underline" onClick={() => void access.refetch()}>Retry</button>}
  </p>;
}
