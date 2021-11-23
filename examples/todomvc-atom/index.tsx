/** @jsx h */
/** @jsxFrag h */

import { h, mount, Component } from "../../index";
import { observer } from "../../atom";
import { atom, Atom, arrayAtom, runInAction, observe } from "@dhmk/atom";

type Todo = Readonly<{
  text: Atom<string>;
  completed: Atom<boolean>;
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

const NewTodo = observer(
  class extends Component<{ onSubmit(todo: string): void }> {
    render() {
      return (
        <input
          className="new-todo"
          placeholder="What needs to be done?"
          autofocus
          onKeyDown={this.handleKeyDown}
          value={this.newTodo()}
          onInput={this.editNewTodo}
        />
      );
    }

    newTodo = atom("");
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
);

const TodoItem = observer(
  class extends Component<
    { item: Todo; deleteItem(item: Todo): void },
    { editing: boolean }
  > {
    state = {
      editing: false,
    };

    render() {
      return (
        <li
          className={[
            this.props.item.completed() ? "completed" : "",
            this.state.editing ? "editing" : "",
          ].join(" ")}
        >
          <div className="observer">
            <input
              className="toggle"
              type="checkbox"
              checked={this.props.item.completed()}
              onChange={this.toggleChecked}
            />
            <label onDblClick={this.handleDoubleClick}>
              {this.props.item.text()}
            </label>
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
      if (this._input.value) {
        this.props.item.setText(this._input.value);
      } else {
        this.props.deleteItem(this.props.item);
      }
      this.setState({ editing: false });
    };

    toggleChecked = (ev: any) =>
      this.props.item.setCompleted(ev.target.checked);
  }
);

const TodosList = observer(
  class extends Component<{
    items: Atom<ReadonlyArray<Todo>>;
    toggleItems(checked: boolean): void;
    deleteItem(item: Todo): void;
  }> {
    render() {
      const { items, deleteItem } = this.props;

      return (
        <section className="main">
          {/* <!-- This section should be hidden by default and shown when there are todos --> */}
          {items().length === 0 ? null : (
            <>
              <input
                id="toggle-all"
                className="toggle-all"
                type="checkbox"
                checked={items().every((x) => x.completed())}
                onChange={this.toggleItems}
              />
              <label htmlFor="toggle-all">Mark all as complete</label>
            </>
          )}
          <ul className="todo-list">
            {/* <!-- List items should get the class `editing` when editing and `completed` when marked as completed --> */}
            {items().map((x) => (
              <TodoItem item={x} deleteItem={deleteItem} />
            ))}
          </ul>
        </section>
      );
    }

    toggleItems = (ev: any) => {
      const checked = ev.target.checked;
      this.props.toggleItems(checked);
    };
  }
);

const TodosOptions = observer(
  class extends Component<{
    itemsCount: Atom<number>;
    remainingCount: Atom<number>;
    completedCount: Atom<number>;
    clearCompleted(): void;
    filter: Atom<TodoFilter>;
    setFilter(x: TodoFilter): void;
  }> {
    render() {
      const { itemsCount, remainingCount, completedCount, filter } = this.props;

      /* <!-- This footer should hidden by default and shown when there are todos --> */
      if (!itemsCount()) return null;

      return (
        <footer className="footer">
          {/* <!-- This should be `0 items left` by default --> */}
          <span className="todo-count">
            <strong>
              {remainingCount()} item{remainingCount() === 1 ? "" : "s"} left
            </strong>
          </span>
          {/* <!-- Remove this if you don't implement routing --> */}
          <ul className="filters">
            <li>
              <a
                href="#"
                className={filter() === "all" ? "selected" : ""}
                onClick={() => this.props.setFilter("all")}
              >
                All
              </a>
            </li>
            <li>
              <a
                href="#"
                className={filter() === "active" ? "selected" : ""}
                onClick={() => this.props.setFilter("active")}
              >
                Active
              </a>
            </li>
            <li>
              <a
                href="#"
                className={filter() === "completed" ? "selected" : ""}
                onClick={() => this.props.setFilter("completed")}
              >
                Completed
              </a>
            </li>
          </ul>
          {/* <!-- Hidden if no completed items are left ↓ --> */}
          {!completedCount() ? null : (
            <button
              className="clear-completed"
              onClick={this.props.clearCompleted}
            >
              Clear completed
            </button>
          )}
        </footer>
      );
    }
  }
);

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
            items={atom(() => this.todos().filter(filterItem(this.filter())))}
            toggleItems={this.toggleItems}
            deleteItem={this.deleteTodo}
          />

          <TodosOptions
            itemsCount={atom(() => this.todos().length)}
            remainingCount={atom(
              () => this.todos().filter(filterItem("active")).length
            )}
            completedCount={atom(
              () => this.todos().filter(filterItem("completed")).length
            )}
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

  todos = arrayAtom<Todo>();

  filter = atom<TodoFilter>("all");
  setFilter = (x: TodoFilter) => this.filter.set(x);

  mount() {
    this.todos.set(
      JSON.parse(localStorage.getItem("todos") || "[]").map((x: any) =>
        this.makeTodo(x.text, x.completed)
      )
    );

    (window as any).api = this;

    return observe(() => {
      localStorage.setItem("todos", JSON.stringify(this.todos()));
    });
  }

  makeTodo(text: string, completed: boolean) {
    return {
      text: atom(text),
      completed: atom(completed),
      setText(x: string) {
        this.text.set(x);
      },
      setCompleted(x: boolean) {
        this.completed.set(x);
      },
    };
  }

  addTodo = (text: string) => {
    this.todos.append(this.makeTodo(text, false));
  };

  deleteTodo = (todo: Todo) => {
    this.todos.remove(todo);
  };

  toggleItems = (checked: boolean) => {
    runInAction(() => {
      this.todos().forEach((x) => x.setCompleted(checked));
    });
  };

  clearCompleted = () => {
    this.todos.remove((x) => x.completed());
  };
}

mount(<App />, document.getElementById("root"));
