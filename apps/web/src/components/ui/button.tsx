import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-semibold whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground shadow-primary hover:bg-primary-hover disabled:shadow-none',
        secondary: 'border border-border-strong bg-surface text-foreground hover:bg-hover-soft',
        ghost:
          'text-foreground hover:bg-hover-soft active:bg-primary-soft active:text-primary-soft-foreground',
        danger: 'bg-danger-soft text-danger hover:opacity-80',
      },
      size: {
        sm: 'h-10 px-4 max-md:min-h-11',
        md: 'h-11 px-5',
        icon: 'size-10 max-md:size-11',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...(asChild ? {} : { type: type ?? 'button' })}
      {...props}
    />
  );
}
