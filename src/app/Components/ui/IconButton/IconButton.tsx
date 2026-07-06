"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import Button, { type ButtonVariant } from "../Button";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: ReactNode;
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
};

export default function IconButton({
  icon,
  label,
  variant = "secondary",
  loading = false,
  ...props
}: IconButtonProps) {
  return (
    <Button
      {...props}
      size="icon"
      variant={variant}
      loading={loading}
      aria-label={props["aria-label"] || label}
      title={props.title || label}
    >
      {!loading ? icon : null}
    </Button>
  );
}
