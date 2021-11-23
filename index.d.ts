export type HelType = string | Function | null;
export type HelProps = {};

export type Hel = {
  type: HelType;
  props: {};
};

export function h(type: HelType, props?: HelProps, ...children: Hel[]): Hel;

export function z(fragment: ReadonlyArray<Hel>): Hel;
export function z(type: HelType, props: HelProps): Hel;
export function z(type: HelType, children: ReadonlyArray<Hel>): Hel;
export function z(
  type: HelType,
  props: HelProps,
  children: ReadonlyArray<Hel>
): Hel;

export function mount(parent: Node | null, hel: Hel): () => void;
export function mount(hel: Hel, parent: Node | null): () => void;

export abstract class Component<P = {}, S = undefined> {
  constructor(props: Readonly<P>);

  protected readonly props: Readonly<P>;
  protected readonly state: Readonly<S>;

  setState(partialState?: Partial<S>, async?: boolean): void;

  effect(
    test: (prevProps: Readonly<P>) => boolean,
    sideEffect: (prevProps: Readonly<P>) => Function | void
  ): Function;

  mount?(): Function | void;

  abstract render(prevProps: P): any;

  afterRender?();
}

export type ComponentType<P, S = undefined> = {
  new (props: Readonly<P>): Component<P, S>;
};

export type FC<P extends object> = (props: Readonly<P>) => any;

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: {
        ref?: (node: Element) => (() => void) | void;
        [prop: string]: any;
      };
    }

    interface ElementAttributesProperty {
      props;
    }

    interface ElementChildrenAttribute {
      children;
    }
  }
}
