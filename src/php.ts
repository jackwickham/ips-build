const preambleRegex = /^.+\$\S+\s*=\s*(\[|\\?array\s*\()/is;
const skipRegex = /^(?:\s+|\/\/.*|#.*|\/\*[^]*?\*\/?)/;
const endRegex = /^(?:\]|\))\s*;/;
const singleQuotedStringRegex = /^((?:[^'\\]|\\.)*)'/;
const doubleQuotedStringRegex = /^((?:[^"\\]|\\.)*)"/;
const escapeSequenceRegex =
  /\\(n|r|t|v|e|f|\\|\$|"|(\d{1,3})|x([0-9a-fA-F]{1,2})|u\{([0-9a-fA-F]+)\})/;

export function parsePhpArray(php: string): string[] {
  return new RegularPhpArrayParser(php).parse();
}

export function parsePhpAssociativeArray(php: string): Record<string, unknown> {
  return new AssociativePhpArrayParser(php).parse();
}

abstract class PhpArrayParser {
  public constructor(private remaining: string) {}

  public parseImpl(): void {
    this.readPreamble();
    this.skip();

    while (!this.atEnd()) {
      this.readEntry();
      this.skip();
      if (this.atEnd()) {
        break;
      }
      this.assertChar(",");
      this.skip();
    }
  }

  protected abstract readEntry(): void;

  protected skip(): void {
    while (this.consume(skipRegex) !== null) {
      // keep going
    }
  }

  protected atEnd(): boolean {
    return this.consume(endRegex) !== null;
  }

  private readPreamble(): void {
    if (this.consume(preambleRegex) === null) {
      throw new Error("Tried to parse a file as a PHP array that doesn't look right");
    }
  }

  private readSingleQuotedString(): string {
    const result = this.consume(singleQuotedStringRegex);
    if (result === null) {
      throw new Error(`String was started but never terminated at ${this.debugSnippet()}`);
    }
    return result[1].replace(/\\'/g, "'").replace(/\\\\/g, "\\");
  }

  protected readString(): string {
    let result;
    const delimiter: string = this.consumeChar();
    if (delimiter === "'") {
      result = this.readSingleQuotedString();
    } else if (delimiter === '"') {
      result = this.readDoubleQuotedString();
    } else {
      throw new Error(
        `Unexpected value while parsing PHP array. Expected ' or ", but found ${delimiter} at ${this.debugSnippet()}`
      );
    }

    this.skip();
    if (this.peekChar() === ".") {
      this.consumeChar();
      this.skip();
      result += this.readString();
    }
    return result;
  }

  private readDoubleQuotedString(): string {
    const result = this.consume(doubleQuotedStringRegex);
    if (result === null) {
      throw new Error(`String was started but never terminated at ${this.debugSnippet()}`);
    }
    // https://www.php.net/manual/en/language.types.string.php#language.types.string.syntax.double
    return result[1].replace(
      escapeSequenceRegex,
      (
        _match: string,
        escaped: string,
        octalEscaped: string,
        hexEscaped: string,
        unicodeEscaped: string
      ) => {
        switch (escaped) {
          case "n":
            return "\n";
          case "r":
            return "\r";
          case "t":
            return "\t";
          case "v":
            return "\v";
          case "e":
            return "\u001B";
          case "f":
            return "\f";
          case "\\":
            return "\\";
          case "$":
            return "$";
          case '"':
            return '"';
        }
        if (hexEscaped !== undefined) {
          return String.fromCodePoint(parseInt(hexEscaped, 16));
        } else if (unicodeEscaped !== undefined) {
          return String.fromCodePoint(parseInt(unicodeEscaped, 16));
        } else if (octalEscaped !== undefined) {
          return String.fromCodePoint(parseInt(escaped, 8));
        } else {
          throw new Error(`Failed to process escape sequence ${escaped} at ${this.debugSnippet()}`);
        }
      }
    );
  }

  protected consume(regex: RegExp): RegExpExecArray | null {
    const matches = regex.exec(this.remaining);
    if (matches !== null) {
      this.remaining = this.remaining.substring(matches[0].length);
    }
    return matches;
  }

  protected consumeChar(): string {
    const result = this.remaining[0];
    if (result === undefined) {
      throw new Error("Unexpected EOF");
    }
    this.remaining = this.remaining.substring(1);
    return result;
  }

  protected peekChar(): string {
    return this.remaining[0];
  }

  protected assertChar(expected: string): void {
    const actual = this.consumeChar();
    if (actual !== expected) {
      throw new Error(`Expected ${expected} but found ${actual} at ${this.debugSnippet()}`);
    }
  }

  protected debugSnippet(): string {
    return this.remaining.substring(0, 30).replace(/\n/g, "\\n");
  }
}

class AssociativePhpArrayParser extends PhpArrayParser {
  private entries: Record<string, string> = {};

  public constructor(remaining: string) {
    super(remaining);
  }

  public parse(): Record<string, string> {
    this.parseImpl();
    return this.entries;
  }

  protected readEntry(): void {
    const key = this.readString();
    this.assertChar("=");
    this.assertChar(">");
    this.skip();
    const value = this.readString();

    this.entries[key] = value;
  }
}

class RegularPhpArrayParser extends PhpArrayParser {
  private entries: string[] = [];

  public constructor(remaining: string) {
    super(remaining);
  }

  public parse(): string[] {
    this.parseImpl();
    return this.entries;
  }

  protected readEntry(): void {
    this.entries.push(this.readString());
  }
}
