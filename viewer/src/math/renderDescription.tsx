import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { renderDescriptionHtml } from "./renderDescription";

export { renderDescriptionHtml } from "./renderDescription";

export function DescriptionText({
  text,
  className,
}: {
  text: string;
  className?: string;
}): ReactNode {
  return (
    <div
      className={cn(
        "summary-md min-w-0 break-words text-xs/relaxed [overflow-wrap:anywhere]",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: renderDescriptionHtml(text) }}
    />
  );
}
