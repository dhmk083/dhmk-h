import { observe } from "@dhmk/atom";

import { Component } from "./index";

const noop = () => {};

export function observer(C) {
  const Base = Component.isPrototypeOf(C) ? C : Component;

  return class AtomObserver extends Base {
    constructor(...args) {
      super(...args);

      const C_render = Base === C ? this.render : C;

      let renderResult = null;
      let runEffect = noop;
      let prevProps = this.props;
      let effect = null;
      let isRendering = false;

      this.render = (_prevProps) => {
        prevProps = _prevProps;
        isRendering = true;

        if (!effect) {
          // A bug workaround :)
          // If put this code in `mount()`, where it should be, it will cause empty DF bugs sometimes.
          // Usually, it happens when you render an array of <FC /> and then add items to it later.

          let run = noop;

          effect = observe(
            () => {
              const props = Base === C ? prevProps : this.props;
              renderResult = C_render.call(this, props);
            },
            {
              attachToParent: false,
              checkStale: false,
              scheduler: (_run) => {
                run = _run;
                !isRendering && this.setState();
              },
            }
          );

          runEffect = () => {
            effect.invalidate(false);
            run();
          };

          // cleanup
          this.effect(
            () => true,
            () => effect
          );
        }

        runEffect();
        isRendering = false;
        return renderResult;
      };
    }
  };
}
