import type { HTMLAttributes } from "react";

import { cx } from "../lib/cx";
import styles from "./card.module.scss";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx(styles.card, className)} {...rest} />;
}
