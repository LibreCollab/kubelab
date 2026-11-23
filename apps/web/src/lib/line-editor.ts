const WORD_CHARACTER = /[A-Za-z0-9_]/;

function isWordCharacter(value: string | undefined): boolean {
  return value !== undefined && WORD_CHARACTER.test(value);
}

/**
 * A minimal readline-style line editor. The terminal renders from this state on
 * every keystroke instead of letting the terminal cursor edit the line.
 */
export class LineEditor {
  #value = "";
  #cursor = 0;

  get value(): string {
    return this.#value;
  }

  get cursor(): number {
    return this.#cursor;
  }

  reset(value = ""): void {
    this.#value = value;
    this.#cursor = value.length;
  }

  insert(fragment: string): void {
    if (fragment.length === 0) {
      return;
    }

    this.#value = this.#value.slice(0, this.#cursor) + fragment + this.#value.slice(this.#cursor);
    this.#cursor += fragment.length;
  }

  backspace(): void {
    if (this.#cursor === 0) {
      return;
    }

    this.#value = this.#value.slice(0, this.#cursor - 1) + this.#value.slice(this.#cursor);
    this.#cursor -= 1;
  }

  deleteForward(): void {
    if (this.#cursor >= this.#value.length) {
      return;
    }

    this.#value = this.#value.slice(0, this.#cursor) + this.#value.slice(this.#cursor + 1);
  }

  moveLeft(): void {
    if (this.#cursor > 0) {
      this.#cursor -= 1;
    }
  }

  moveRight(): void {
    if (this.#cursor < this.#value.length) {
      this.#cursor += 1;
    }
  }

  moveWordLeft(): void {
    let cursor = this.#cursor;

    while (cursor > 0 && !isWordCharacter(this.#value[cursor - 1])) {
      cursor -= 1;
    }
    while (cursor > 0 && isWordCharacter(this.#value[cursor - 1])) {
      cursor -= 1;
    }

    this.#cursor = cursor;
  }

  moveWordRight(): void {
    let cursor = this.#cursor;

    while (cursor < this.#value.length && !isWordCharacter(this.#value[cursor])) {
      cursor += 1;
    }
    while (cursor < this.#value.length && isWordCharacter(this.#value[cursor])) {
      cursor += 1;
    }

    this.#cursor = cursor;
  }

  moveHome(): void {
    this.#cursor = 0;
  }

  moveEnd(): void {
    this.#cursor = this.#value.length;
  }

  deleteToStart(): void {
    this.#value = this.#value.slice(this.#cursor);
    this.#cursor = 0;
  }

  deleteToEnd(): void {
    this.#value = this.#value.slice(0, this.#cursor);
  }

  deleteWordBefore(): void {
    let cursor = this.#cursor;

    while (cursor > 0 && !isWordCharacter(this.#value[cursor - 1])) {
      cursor -= 1;
    }
    while (cursor > 0 && isWordCharacter(this.#value[cursor - 1])) {
      cursor -= 1;
    }

    this.#value = this.#value.slice(0, cursor) + this.#value.slice(this.#cursor);
    this.#cursor = cursor;
  }
}
