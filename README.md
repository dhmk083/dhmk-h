# @dhmk/h

Another virtual DOM with JSX support.

## Usage

```tsx
/** @jsx h */
/** @jsxFrag h */

import { h, mount, Component } from "../../index";

// class component
class Counter extends Component {
  state = {
    counter: 0,
  };

  mount() {
    console.log("i have been mounted");
    return () => console.log("now i am about to unmount");
  }

  render() {
    return (
      <div>
        <p>{this.state.counter}</p>
        <button onClick={this.increment}>Increment</button>
      </div>
    );
  }

  increment = () => this.setState({ counter: this.state.counter + 1 });
}

// functional component
const App = () => <Counter />;

mount(<App />, document.getElementById("root"));
```

## API

### `mount(what, where): UnmountFunction`

### `h(type, props = {}, ...children)`

### `z(type, props_children = {}, children = [])`

Wrapper around `h()` for use without JSX. Example: `z('div.classA.classB', {onClick: fn}, [...])`.

### `class Component {`

```
mount(): OnUnmountCallback

render(): JSX

setState(partialState, async = true): void

effect(test, sideEffect): Dispose
```

### `}`
