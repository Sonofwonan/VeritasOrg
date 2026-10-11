import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type FundsActionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  retry?: () => void;
  onCloseAutoFocus?: (event: Event) => void;
};

export function FundsActionDialog({
  open,
  onOpenChange,
  title,
  message,
  retry,
  onCloseAutoFocus,
}: FundsActionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="funds-action-dialog"
        onCloseAutoFocus={onCloseAutoFocus}
        className="w-[calc(100%_-_2rem)] max-w-md gap-0 rounded-sm border-border bg-card p-0 shadow-xl sm:w-full"
      >
        <DialogHeader className="space-y-2 border-b border-border/70 px-5 py-5 text-left sm:px-6 sm:py-6">
          <DialogTitle className="pr-8 text-lg font-semibold leading-snug text-foreground sm:text-xl">
            {title}
          </DialogTitle>
          <DialogDescription className="max-w-prose text-sm leading-relaxed text-muted-foreground sm:text-base">
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col-reverse gap-2 px-5 py-4 sm:flex-row sm:gap-3 sm:px-6 sm:py-5">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto sm:min-w-24"
          >
            Close
          </Button>
          {retry && (
            <Button
              type="button"
              onClick={retry}
              className="w-full sm:w-auto sm:min-w-24"
            >
              Retry
            </Button>
          )}
          {!retry && message.includes("advisor") && (
            <Button asChild className="w-full sm:w-auto">
              <a href="mailto:veritaswealth@accountant.com">Contact advisor</a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
