/** @jsx h */
/** @jsxFrag h */

import { h, mount, Component } from "../../index";
import { cell, Cell, carray, batch, map, reduce } from "@dhmk/cell";

type Todo = Readonly<{
  text: Cell<string>;
  completed: Cell<boolean>;
  setText(x: string): void;
  setCompleted(x: boolean): void;
}>;

type TodoFilter = "all" | "completed" | "active";

function filterItem(filter: TodoFilter) {
  return (x: Todo) =>
    filter === "completed"
      ? x.completed()
      : filter === "active"
      ? !x.completed()
      : true;
}

class NewTodo extends Component<{ onSubmit(todo: string): void }> {
  render() {
    return (
      <input
        className="new-todo"
        placeholder="What needs to be done?"
        autofocus
        onKeyDown={this.handleKeyDown}
        value={this.newTodo}
        onInput={this.editNewTodo}
      />
    );
  }

  newTodo = cell("");
  editNewTodo = (ev: any) => this.newTodo.set(ev.target.value);

  handleKeyDown = (ev: any) => {
    if (ev.keyCode === 13) {
      const newText = this.newTodo().trim();
      if (!newText) return;

      this.newTodo.set("");
      this.props.onSubmit(newText);
    }
  };
}

class TodoItem extends Component<
  { item: Todo; deleteItem(item: Todo): void },
  { editing: boolean }
> {
  state = {
    editing: false,
  };

  render() {
    const { item } = this.props;

    return (
      <li
        className={map(item.completed, () =>
          [
            item.completed() ? "completed" : "",
            this.state.editing ? "editing" : "",
          ].join(" ")
        )}
      >
        <div className="view">
          <input
            className="toggle"
            type="checkbox"
            checked={item.completed}
            onChange={this.toggleChecked}
          />
          <label onDblClick={this.handleDoubleClick}>{item.text()}</label>
          <button
            className="destroy"
            onClick={() => this.props.deleteItem(this.props.item)}
          ></button>
        </div>
        <input
          ref={(x) => {
            this._input = x as HTMLInputElement;
          }}
          className="edit"
          onKeyDown={this.handleKeyDown}
          onBlur={this.handleCommit}
        />
      </li>
    );
  }

  _input!: HTMLInputElement;

  handleDoubleClick = () => {
    this._input.value = this.props.item.text();
    this.setState({ editing: true }, false);
    this._input.focus();
  };

  handleKeyDown = (ev: any) => {
    if (ev.keyCode === 13) {
      this.handleCommit();
    } else if (ev.keyCode === 27) {
      this.setState({ editing: false });
    }
  };

  handleCommit = () => {
    if (this._input!.value) {
      this.props.item.setText(this._input.value);
    } else {
      this.props.deleteItem(this.props.item);
    }
    this.setState({ editing: false });
  };

  toggleChecked = (ev: any) => this.props.item.setCompleted(ev.target.checked);
}

class TodosList extends Component<{
  items: Cell<ReadonlyArray<Todo>>;
  toggleItems(checked: boolean): void;
  deleteItem(item: Todo): void;
}> {
  render() {
    const { items, deleteItem } = this.props;

    return (
      <section className="main">
        {/* <!-- This section should be hidden by default and shown when there are todos --> */}
        {map(items, (values) =>
          values.length === 0 ? null : (
            <>
              <input
                id="toggle-all"
                className="toggle-all"
                type="checkbox"
                checked={map(items, (items) =>
                  items.every((x) => x.completed())
                )}
                onChange={this.toggleItems}
              />
              <label htmlFor="toggle-all">Mark all as complete</label>
            </>
          )
        )}
        <ul className="todo-list">
          {/* <!-- List items should get the class `editing` when editing and `completed` when marked as completed --> */}
          {map(items, (items) =>
            items.map((x) => <TodoItem item={x} deleteItem={deleteItem} />)
          )}
        </ul>
      </section>
    );
  }

  toggleItems = (ev: any) => {
    const checked = ev.target.checked;
    this.props.toggleItems(checked);
  };
}

class TodosOptions extends Component<{
  itemsCount: Cell<number>;
  remainingCount: Cell<number>;
  completedCount: Cell<number>;
  clearCompleted(): void;
  filter: Cell<TodoFilter>;
  setFilter(x: TodoFilter): void;
}> {
  render() {
    return map(this.props.itemsCount, (count) =>
      //   /* <!-- This footer should hidden by default and shown when there are todos --> */
      !count ? null : (
        <footer className="footer">
          {/* <!-- This should be `0 items left` by default --> */}
          {map(this.props.remainingCount, (count) => (
            <span className="todo-count">
              <strong>{count}</strong> item{count === 1 ? "" : "s"} left
            </span>
          ))}
          {/* <!-- Remove this if you don't implement routing --> */}
          <ul className="filters">
            <li>
              <a
                href="#"
                className={map(this.props.filter, (filter) =>
                  filter === "all" ? "selected" : ""
                )}
                onClick={() => this.props.setFilter("all")}
              >
                All
              </a>
            </li>
            <li>
              <a
                href="#"
                className={map(this.props.filter, (filter) =>
                  filter === "active" ? "selected" : ""
                )}
                onClick={() => this.props.setFilter("active")}
              >
                Active
              </a>
            </li>
            <li>
              <a
                href="#"
                className={map(this.props.filter, (filter) =>
                  filter === "completed" ? "selected" : ""
                )}
                onClick={() => this.props.setFilter("completed")}
              >
                Completed
              </a>
            </li>
          </ul>
          {/* <!-- Hidden if no completed items are left ↓ --> */}
          {map(this.props.completedCount, (count) =>
            !count ? null : (
              <button
                className="clear-completed"
                onClick={this.props.clearCompleted}
              >
                Clear completed
              </button>
            )
          )}
        </footer>
      )
    );
  }
}

class App extends Component {
  render() {
    return (
      <div>
        <section className="todoapp">
          <header className="header">
            <h1>todos</h1>
            <NewTodo onSubmit={this.addTodo} />
          </header>

          <TodosList
            items={this.filteredTodos}
            toggleItems={this.toggleItems}
            deleteItem={this.deleteTodo}
          />

          <TodosOptions
            itemsCount={map(this.todos, (todos) => todos.length)}
            remainingCount={this.remainingCount}
            completedCount={this.completedCount}
            clearCompleted={this.clearCompleted}
            filter={this.filter}
            setFilter={this.setFilter}
          />
        </section>

        <footer className="info">
          <p>Double-click to edit a todo</p>
          <p>
            Created by <a href="https://github.com/dhmk083">dhmk083</a>
          </p>
          <p>
            Part of <a href="http://todomvc.com">TodoMVC</a>
          </p>
        </footer>
      </div>
    );
  }

  todos = carray<Todo>();

  filter = cell<TodoFilter>("all");
  setFilter = (x: TodoFilter) => this.filter.set(x);

  filteredTodos = map(
    [
      this.filter,
      reduce(
        this.todos,
        (todos) => todos,
        (x) => x.completed,
        { eq: () => false }
      ),
    ],
    (filter, todos) => todos.filter(filterItem(filter))
  );

  remainingCount = reduce(
    this.todos,
    (todos) => todos.filter(filterItem("active")).length,
    (x) => x.completed
  );

  completedCount = reduce(
    this.todos,
    (todos) => todos.filter(filterItem("completed")).length,
    (x) => x.completed
  );

  mount() {
    this.todos.set(
      JSON.parse(localStorage.getItem("todos") || "[]").map((x: any) =>
        this.makeTodo(x.text, x.completed)
      )
    );

    (window as any).api = this;

    return reduce(
      this.todos,
      (todos) => JSON.stringify(todos),
      (x) => map([x.text, x.completed], () => NaN)
    ).observe((x) => {
      localStorage.setItem("todos", x);
    });
  }

  makeTodo(text: string, completed: boolean) {
    return {
      text: cell(text),
      completed: cell(completed),
      setText(x: string) {
        this.text.set(x);
      },
      setCompleted(x: boolean) {
        this.completed.set(x);
      },
    };
  }

  addTodo = (text: string) => {
    this.todos.push(this.makeTodo(text, false));
  };

  deleteTodo = (todo: Todo) => {
    this.todos.remove(todo);
  };

  toggleItems = (checked: boolean) => {
    batch(() => {
      this.todos.forEach((x) => x.setCompleted(checked));
    });
  };

  clearCompleted = () => {
    this.todos.remove((x) => x.completed());
  };
}

mount(<App />, document.getElementById("root"));
