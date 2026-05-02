import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[2px] border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-accent/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-danger aria-invalid:ring-danger/20 dark:aria-invalid:ring-danger/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-surface-2 text-primary [a]:hover:bg-surface-3 border-border-subtle",
        secondary:
          "bg-surface-3 text-secondary [a]:hover:bg-surface-3/80",
        destructive:
          "bg-danger text-white focus-visible:ring-danger/20 dark:bg-danger dark:focus-visible:ring-danger/40 [a]:hover:bg-danger/80",
        success:
          "bg-success text-white [a]:hover:bg-success/80",
        warning:
          "bg-warning text-white [a]:hover:bg-warning/80",
        info:
          "bg-info text-white [a]:hover:bg-info/80",
        outline:
          "border-border-subtle text-primary [a]:hover:bg-surface-3 [a]:hover:text-muted",
        ghost:
          "hover:bg-surface-3 hover:text-muted dark:hover:bg-surface-3/50",
        link: "text-accent underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
