const noop = () => {};

const TEXT_NODE = "TEXT_NODE";

const isHel = (x) => x && x.type && x.props;

export function z(type, props_children = {}, children = []) {
  if (Array.isArray(type)) return h(h, {}, type);

  const ch = Array.isArray(props_children) ? props_children : children;
  const props = Array.isArray(props_children) ? {} : props_children;
  if (typeof type !== "string") return h(type, props, ...ch);

  const [t, ...cns] = type.split(".");
  const finalProps = cns.length
    ? { ...props, className: cns.join(" ") }
    : props;
  return h(t, finalProps, ...ch);
}

export function mount(hel_parent, parent_hel) {
  const hel = isHel(hel_parent)
    ? hel_parent
    : isHel(parent_hel)
    ? parent_hel
    : undefined;
  const p =
    hel_parent instanceof Node
      ? hel_parent
      : parent_hel instanceof Node
      ? parent_hel
      : undefined;

  if (!hel || !p) throw new Error("bad arguments");

  if (p.hasChildNodes()) {
    console.warn("parent has child nodes. they will be deleted!");
    p.innerHTML = "";
  }

  return hmount(hel, p);
}

export function h(type, props = {}, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map(normalizeHel),
    },
  };
}

const ROOT_INSTANCE = "@dhmk/h/ROOT_INSTANCE";

function hmount(hel, p) {
  const prevInstance = p[ROOT_INSTANCE];
  if (prevInstance)
    throw new Error("already mounted. unmount first. " + prevInstance);

  if (p.hasChildNodes()) throw new Error("parent has child nodes.");

  p[ROOT_INSTANCE] = rEnter(p, null, hel);
  return () => rExit(p, p[ROOT_INSTANCE]);
}

function getStart(dom) {
  return dom instanceof DocumentFragment ? getStart(dom.getStart()) : dom;
}

function getEnd(dom) {
  return dom instanceof DocumentFragment ? getEnd(dom.getEnd()) : dom;
}

function unref(inst) {
  const ref = inst.subs && inst.subs.ref;
  ref && ref();
  inst.childInstances.forEach(unref);
}

//
function hinsertBefore(p, ref, dom) {
  p.insertBefore(dom, getStart(ref));
}
function hremove(p, dom) {
  if (p instanceof DocumentFragment || !(dom instanceof DocumentFragment)) {
    p.removeChild(dom);
  } else {
    dom.remove();
  }
}
//

//
function henter(inst) {
  inst.childInstances.forEach(henter);
  inst.enter && inst.enter();
  inst.afterRender && inst.afterRender();
}
function hexit(inst) {
  inst.childInstances.forEach(hexit);
  inst.exit && inst.exit();
}
//

//
function rEnter(p, ref, hel) {
  const newInstance = instantiate(hel);
  hinsertBefore(p, ref, newInstance.dom);
  henter(newInstance);
  return newInstance;
}

function rExit(p, instance) {
  hexit(instance);
  for (const k in instance.subs) instance.subs[k]();
  hremove(p, instance.dom);
  unref(instance);
  return undefined;
}

function rUpdate(instance, hel) {
  if (instance.element.type !== hel.type)
    throw new Error(`types mismatch: ${instance.element.type} vs ${hel.type}`);

  if (hel.type === null) {
    // null, false, undefined
    return instance;
  } else if (typeof hel.type === "string") {
    // div, span, etc..
    updateDomProperties(
      instance.dom,
      instance.element.props,
      hel.props,
      instance.subs
    );
    instance.childInstances = diffChildren(instance, hel);
    instance.element = hel;
    return instance;
  } else if (hel.type === h) {
    // <>
    instance.childInstances = diffChildren(instance, hel);
    instance.element = hel;
    return instance;
  } else {
    // Component
    const prevProps = instance.publicInstance.props;
    instance.publicInstance.props = hel.props;
    const shouldUpdate = !(
      arePropsShallowlyEqual(prevProps, hel.props) &&
      instance.prevState === instance.publicInstance.state
    );
    instance.prevState = instance.publicInstance.state;
    if (shouldUpdate) {
      const childElement = normalizeHel(
        instance.publicInstance.__render(prevProps)
      );
      const [oldChildInstance] = instance.childInstances;
      let parent; // a small optimization
      if (oldChildInstance.element.type !== childElement.type) {
        parent = getParent(oldChildInstance.dom);
      }
      const childInstance = _update(parent, oldChildInstance, childElement);
      instance.dom = childInstance.dom;
      instance.childInstances = [childInstance];
      instance.element = hel;
      instance.afterRender && instance.afterRender();
    }
    return instance;
  }
}
//

function getParent(dom) {
  return dom instanceof DocumentFragment ? dom.getParent() : dom.parentNode;
}

function arePropsShallowlyEqual(prevProps, nextProps) {
  if (Object.keys(prevProps).length !== Object.keys(nextProps).length)
    return false;

  for (const k in prevProps) {
    if (k === "children") {
      if (
        prevProps.children.length === 1 &&
        nextProps.children.length === 1 &&
        prevProps.children[0] === nextProps.children[0]
      )
        continue;

      if (prevProps.children.length > 0 || nextProps.children.length > 0)
        return false;

      continue;
    }

    if (prevProps[k] !== nextProps[k]) return false;
  }

  return true;
}

function _insert(parent, dom, ref) {
  if (dom instanceof DocumentFragment) {
    for (const n of dom.nodes) {
      _insert(parent, n, ref);
    }
  } else {
    parent.insertBefore(dom, ref);
  }
}

function _update(parent, oldInstance, newHel) {
  if (oldInstance.element.type !== newHel.type) {
    const ref = getEnd(oldInstance.dom).nextSibling;
    rExit(parent, oldInstance);
    return rEnter(parent, ref, newHel);
  } else {
    return rUpdate(oldInstance, newHel);
  }
}

const getMapKey = (hel) =>
  hel.props.key === undefined ? hel.type : hel.props.key;

function diffChildren(instance, hel) {
  const oldInstances = instance.childInstances;
  const oldCount = oldInstances.length;

  const newHels = hel.props.children;
  const newCount = newHels.length;

  const parent = instance.dom;

  const oldMap = new Map();
  const newMap = new Map();
  const cache = new Map();

  for (let i = 0; i < oldCount; i++) {
    const key = getMapKey(oldInstances[i].element);
    let q = oldMap.get(key);
    if (!q) {
      q = new FIFO();
      oldMap.set(key, q);
    }
    q.add(i);
  }

  for (let i = 0; i < newCount; i++) {
    const key = getMapKey(newHels[i]);
    let q = newMap.get(key);
    if (!q) {
      q = new FIFO();
      newMap.set(key, q);
    }
    q.add(i);
  }

  const newChildInstances = [];

  let oldi = 0;
  let newi = 0;

  while (true) {
    if (oldi === oldCount) {
      for (; newi < newCount; newi++) {
        const hel = newHels[newi];
        const q = cache.get(getMapKey(hel));
        const i = q ? q.peek() : undefined;
        if (i !== undefined) {
          q.remove();
          const inst = _update(parent, oldInstances[i], hel);
          newChildInstances.push(inst);
          _insert(parent, inst.dom, null);
        } else {
          newChildInstances.push(rEnter(parent, null, hel));
        }
      }
      break;
    }

    if (newi === newCount) {
      for (; oldi < oldCount; oldi++) {
        const inst = oldInstances[oldi];
        const q = oldMap.get(getMapKey(inst.element));
        const i = q ? q.peek() : undefined;
        if (i !== undefined) {
          q.remove(); // necessary?
          rExit(parent, inst);
        }
      }
      break;
    }

    const oldInstance = oldInstances[oldi];
    const newHel = newHels[newi];

    const oldKey = oldInstance.element.props.key;
    const newKey = newHel.props.key;

    const oldType = oldInstance.element.type;
    const newType = newHel.type;

    const _oq = oldMap.get(getMapKey(oldInstance.element));
    const _oi = _oq ? _oq.peek() : undefined;
    if (_oi === undefined || _oi > oldi) {
      // already used; no-op;
      oldi++;
      continue;
    }

    if (
      (oldKey === newKey && oldType === newType) ||
      (oldKey === newKey && oldKey !== undefined && oldType !== newType) ||
      oldType === null ||
      newType === null
    ) {
      oldMap.get(getMapKey(oldInstance.element)).remove();
      newMap.get(getMapKey(newHel)).remove();
      oldi++;
      newi++;

      newChildInstances.push(_update(parent, oldInstance, newHel));
    } else {
      const oldInstance_newQ = newMap.get(getMapKey(oldInstance.element));
      const oldInstance_newIndex =
        oldInstance_newQ === undefined ? undefined : oldInstance_newQ.peek();

      if (oldInstance_newIndex === undefined) {
        const oq = oldMap.get(getMapKey(oldInstance.element));
        const oi = oq ? oq.peek() : undefined;
        if (oi === undefined) {
          // no-op
          // it means, that INSERT came first
          // and used oldMap, but not cacheMap
          continue;
        }

        oq.remove(); // necessary?
        rExit(parent, oldInstance);
        oldi++;
        continue;
      }

      const newHel_oldQ = oldMap.get(getMapKey(newHel));
      const newHel_oldIndex =
        newHel_oldQ === undefined ? undefined : newHel_oldQ.peek();

      if (newHel_oldIndex === undefined) {
        // not necessary: remove newHel from newQ

        const cacheQ = cache.get(getMapKey(newHel));
        const cacheI = cacheQ ? cacheQ.peek() : undefined;

        if (cacheI !== undefined) {
          cacheQ.remove();
          const inst = _update(parent, oldInstances[cacheI], newHel);
          newChildInstances.push(inst);
          _insert(parent, inst.dom, getStart(oldInstance.dom));
          newi++;
          continue;
        } else {
          newChildInstances.push(
            rEnter(parent, getStart(oldInstance.dom), newHel)
          );
          newi++;
          continue;
        }
      }

      const removeCost = newHel_oldIndex - oldi;
      const insertCost = oldInstance_newIndex - newi;

      if (insertCost < removeCost) {
        const inst = _update(parent, oldInstances[newHel_oldIndex], newHel);
        newChildInstances.push(inst);
        _insert(parent, inst.dom, getStart(oldInstance.dom));
        newi++;
        newMap.get(getMapKey(newHel)).remove();
        oldMap.get(getMapKey(newHel)).remove();
        continue;
      } else {
        const key = getMapKey(oldInstance.element);
        oldMap.get(key).remove();
        let q = cache.get(key);
        if (!q) {
          q = new FIFO();
          cache.set(key, q);
        }
        q.add(oldi);

        oldi++;
        continue;
      }
    }
  }

  for (const [_, q] of cache) {
    const i = q.peek();
    if (i !== undefined) {
      rExit(parent, oldInstances[i]);
    }
  }

  return newChildInstances;
}

function createDF() {
  const beacon = document.createComment("");
  // although, an array is not the best choice for random insert/remove,
  // in tests custom linked list shows the same performance, so stick with an array
  const nodes = [beacon];
  const dom = document.createDocumentFragment();
  const _insertBefore = dom.insertBefore.bind(dom);
  _insertBefore(beacon, null);

  dom.insertBefore = (node, ref) => {
    if (node === ref) return;

    const p = dom.getParent();
    const atEnd = ref === null;
    ref = getStart(ref || getEnd(nodes[nodes.length - 1]).nextSibling);

    if (p === dom) _insertBefore(node, ref);
    else p.insertBefore(node, ref);

    const ei = nodes.indexOf(node);
    if (ei > -1) nodes.splice(ei, 1);

    if (atEnd) {
      nodes.push(node);
    } else {
      const i = nodes.indexOf(ref);
      if (i === -1) throw new Error("ref is not my child: " + ref);

      nodes.splice(i, 0, node);
    }

    if (nodes[0] === beacon) {
      beacon.remove();
      nodes.shift();
    }
  };

  dom.removeChild = (c) => {
    const i = nodes.indexOf(c);
    if (i === -1) throw new Error("not my child: " + c);

    const p = dom.getParent();

    if (nodes.length === 1) {
      const ref = getStart(c);

      if (p === dom) _insertBefore(beacon, ref);
      else p.insertBefore(beacon, ref);

      nodes[0] = beacon;
    } else {
      nodes.splice(i, 1);
    }

    if (p === dom || c instanceof DocumentFragment) c.remove();
    else hremove(p, c);
  };

  dom.remove = () => {
    const p = dom.getParent();
    nodes.forEach((n) => hremove(p, n));
  };

  dom.getParent = () => {
    const p = nodes[0].parentNode;
    if (!p) {
      // !p means p should be an exhausted DF
      if (!(nodes[0] instanceof DocumentFragment))
        throw new Error(`${nodes[0]} has no parent and is not a DF`);

      return nodes[0].getParent();
    } else return p;
  };

  dom.getStart = () => nodes[0];
  dom.getEnd = () => nodes[nodes.length - 1];
  dom.nodes = nodes;

  return dom;
}

function instantiate(hel) {
  const { type, props } = hel;

  if (type === null) {
    return {
      dom: document.createComment(""),
      element: hel,
      childInstances: [],
    };
  }

  if (type === h) {
    const dom = createDF();
    const childInstances = props.children.map(instantiate);
    childInstances.forEach((ci) => dom.insertBefore(ci.dom, null));

    return {
      dom,
      element: hel,
      childInstances,
    };
  }

  if (Component.isPrototypeOf(type)) {
    // if (type && type.prototype instanceof Component) {
    const instance = {};
    const publicInstance = createPublicInstance(hel, instance);
    const childElement = normalizeHel(publicInstance.__render(props));
    const childInstance = instantiate(childElement);
    const { dom } = childInstance;
    Object.assign(instance, {
      dom,
      element: hel,
      childInstances: [childInstance],
      publicInstance,
    });
    return instance;
  }

  if (typeof type === "function") {
    return instantiate(normalizeHel(type(props)));
  }

  const dom =
    type === TEXT_NODE ? document.createTextNode("") : createElement(type);

  const subs = {};

  updateDomProperties(dom, {}, props, subs);

  const childInstances = props.children.map(instantiate);
  childInstances.forEach((ci) => dom.appendChild(ci.dom));

  return { dom, element: hel, childInstances, subs };
}

const svgNS = "http://www.w3.org/2000/svg";
const svgTypes = new Set([
  "animate",
  "animateMotion",
  "animateTransform",
  "circle",
  "clipPath",
  "color-profile",
  "defs",
  "desc",
  "discard",
  "ellipse",
  "feBlend",
  "feColorMatrix",
  "feComponentTransfer",
  "feComposite",
  "feConvolveMatrix",
  "feDiffuseLighting",
  "feDisplacementMap",
  "feDistantLight",
  "feDropShadow",
  "feFlood",
  "feFuncA",
  "feFuncB",
  "feFuncG",
  "feFuncR",
  "feGaussianBlur",
  "feImage",
  "feMerge",
  "feMergeNode",
  "feMorphology",
  "feOffset",
  "fePointLight",
  "feSpecularLighting",
  "feSpotLight",
  "feTile",
  "feTurbulence",
  "filter",
  "foreignObject",
  "g",
  "hatch",
  "hatchpath",
  "image",
  "line",
  "linearGradient",
  "marker",
  "mask",
  "mesh",
  "meshgradient",
  "meshpatch",
  "meshrow",
  "metadata",
  "mpath",
  "path",
  "pattern",
  "polygon",
  "polyline",
  "radialGradient",
  "rect",
  "set",
  "solidcolor",
  "stop",
  "svg",
  "switch",
  "symbol",
  "text",
  "textPath",
  "title",
  "tspan",
  "unknown",
  "use",
  "view",
]);

function createElement(type) {
  return svgTypes.has(type)
    ? document.createElementNS(svgNS, type)
    : document.createElement(type);
}

const skipProps = ["__source", "__self"];
const specialProps = ["children", "key", "ref"];
const forceProp = ["nodeValue", "value", "checked", "disabled"];
const propAttrNameMap = {
  className: "class",
  htmlFor: "for",
};
const getAttrName = (propName) => propAttrNameMap[propName] || propName;

const isEvent = (name) => name.startsWith("on");
const isAttribute = (name) => !isEvent(name) && !specialProps.includes(name);

const isCell = (x) =>
  typeof x === "function" && typeof x.observe === "function";

function applyProp(dom, propName, value) {
  if (forceProp.includes(propName)) dom[propName] = value;
  else dom.setAttribute(getAttrName(propName), value);
}

function updateDomProperties(dom, prevProps, nextProps, subs) {
  for (const name in prevProps) {
    if (!(name in nextProps)) {
      if (isEvent(name)) {
        const eventType = name.toLowerCase().substring(2);
        dom.removeEventListener(eventType, prevProps[name]);
      } else if (isAttribute(name)) {
        if (name === "style" && typeof prevProps.style === "object") {
          for (const k in prevProps.style) {
            dom.style[k] = "";
          }
          continue;
        }

        if (forceProp.includes(name)) dom[name] = null;
        else dom.removeAttribute(getAttrName(name));

        if (subs[name]) {
          subs[name]();
          subs[name] = undefined;
        }
      }
    }
  }

  for (const name in nextProps) {
    if (skipProps.includes(name)) continue;

    if (prevProps[name] !== nextProps[name]) {
      if (isEvent(name)) {
        const eventType = name.toLowerCase().substring(2);
        if (prevProps[name])
          dom.removeEventListener(eventType, prevProps[name]);
        dom.addEventListener(eventType, nextProps[name]);
      } else if (isAttribute(name)) {
        let value = nextProps[name];

        if (isCell(value)) {
          subs[name] = value.observe((value) => {
            applyProp(dom, name, value);
          });
          value = value();
        }

        if (name === "style" && typeof value === "object") {
          if (value === null) {
            for (const k in prevProps.style) {
              dom.style[k] = "";
            }
          }

          for (const k in value) {
            dom.style[k] = value[k];
          }
          continue;
        }

        applyProp(dom, name, value);
      }
    }
  }

  if (prevProps.ref !== nextProps.ref) {
    subs.ref && subs.ref();
    subs.ref = nextProps.ref && nextProps.ref(dom);
  }
}

// prettier-ignore
function normalizeHel(hel) {
  if (isHel(hel)) return hel
  if (isCell(hel)) return { type: CellManualComponent, props: { src: hel, children: [] } }
  if (hel === null || hel === false || hel === undefined) return { type: null, props: { children: [] } }
  if (Array.isArray(hel)) return { type: h, props: { children: hel } }
  if (typeof hel === 'function') return hel

  return { type: TEXT_NODE, props: { nodeValue: hel.toString(), children: [] } };
}

export class Component {
  constructor(props) {
    this.props = props;
  }

  setState(partialState, async = true) {
    this.state = { ...this.state, ...partialState };

    if (async) {
      if (this.__updatePending) return;

      this.__updatePending = true;
      setTimeout(() => {
        if (!this.__updatePending) return;

        this.__updatePending = false;
        updateInstance(this.__inst);
      });
    } else {
      this.__updatePending = false;
      updateInstance(this.__inst);
    }
  }

  effect(test, sideEffect) {
    if (!this.__effects) {
      this.__effects = new Set();
    }

    const entry = {
      test,
      sideEffect,
      dispose: noop,
      initial: true,
    };
    this.__effects.add(entry);

    return () => {
      entry.dispose();
      entry.dispose = noop;
      this.__effects.delete(entry);
    };
  }

  __render(prevProps) {
    if (this.__effects) {
      for (const entry of this.__effects) {
        if (entry.initial || !entry.test(prevProps)) {
          entry.initial = false;
          entry.dispose();
          entry.dispose = entry.sideEffect(prevProps) || noop;
        }
      }
    }

    return this.render(prevProps);
  }

  __enter() {
    this.__dispose = (this.mount && this.mount()) || noop;
  }

  __exit() {
    this.__dispose();

    if (this.__effects) {
      for (const entry of this.__effects) {
        entry.dispose();
      }
    }
  }
}

// function areValuesDiff(prevValues, nextValues) {
//   if (prevValues.length !== nextValues.length) return true;
//   for (let i = 0; i < prevValues.length; i++) {
//     if (prevValues[i] !== nextValues[i]) return true;
//   }
//   return false;
// }

function createPublicInstance(hel, __inst) {
  const { type, props } = hel;
  const publicInstance = new type(props);
  __inst.enter = () => publicInstance.__enter();
  __inst.exit = () => publicInstance.__exit();
  if (publicInstance.afterRender)
    __inst.afterRender = () => publicInstance.afterRender();
  publicInstance.__inst = __inst;
  return publicInstance;
}

function updateInstance(__inst) {
  rUpdate(__inst, __inst.element);
}

class CellManualComponent extends Component {
  constructor(...args) {
    super(...args);

    this.effect(
      (prevProps) => this.props.src === prevProps.src,
      () => this.props.src.observe(() => this.setState())
    );
  }

  render() {
    return this.props.src();
  }
}

class FIFO_Node {
  constructor(value) {
    this.value = value;
    this.next = undefined;
  }
}

class FIFO {
  constructor() {
    this.head = this.tail = new FIFO_Node();
  }

  add(x) {
    this.tail.value = x;
    this.tail = this.tail.next = new FIFO_Node();
  }

  remove() {
    this.head = this.head.next;
    if (!this.head) {
      this.head = this.tail = new FIFO_Node();
    }
  }

  peek() {
    return this.head.value;
  }
}
