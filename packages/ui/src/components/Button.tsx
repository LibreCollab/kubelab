import type { ButtonHTMLAttributes } from "react";

import { cx } from "../lib/cx";
import styles from "./button.module.scss";

type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "md" | "sm";
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(styles.button, styles[variant], size === "sm" && styles.sm, className)}
      {...rest}
    />
  );
}
