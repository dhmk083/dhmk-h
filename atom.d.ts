import { ComponentType } from "./index";

export function observer<P>(C: (props: P) => any): ComponentType<P>;
export function observer<P, S = undefined>(
  C: ComponentType<P, S>
): ComponentType<P, S>;
