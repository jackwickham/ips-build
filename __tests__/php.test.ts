import {parsePhpArray, parsePhpAssociativeArray} from "../src/php";

const preamble = "<?php\n\n$var =";

test("Parses empty regular arrays using [", () => {
  const input = `${preamble} [];`;
  expect(parsePhpArray(input)).toEqual([]);
});

test("Parses empty regular arrays using array(", () => {
  const input = `${preamble} array();`;
  expect(parsePhpArray(input)).toEqual([]);
});

test("Parses empty associative arrays using [", () => {
  const input = `${preamble} [];`;
  expect(parsePhpAssociativeArray(input)).toEqual({});
});

test("Parses empty associative arrays using array(", () => {
  const input = `${preamble} array();`;
  expect(parsePhpAssociativeArray(input)).toEqual({});
});

test("Parses regular arrays", () => {
  const input = `${preamble} ["a", "b", "c"];`;
  expect(parsePhpArray(input)).toEqual(["a", "b", "c"]);
});

test("Parses associative arrays", () => {
  const input = `${preamble} ["a" => "1", "b" => "2", "c" => "3"];`;
  expect(parsePhpAssociativeArray(input)).toEqual({a: "1", b: "2", c: "3"});
});

test("Ignores single line comments", () => {
  const input = `${preamble} [\n\t// this "should" be // ignored\n\t"a" // /\\/\n ,#!!! ] \n\t"b" // a\n];`;
  expect(parsePhpArray(input)).toEqual(["a", "b"]);
});

test("Ignores block comments", () => {
  const input = `${preamble} [\n\t/* this "should" be // ignored */ "a"/*\n*/,"b", /* ] * /* "c"\n */ "d" /**/];`;
  expect(parsePhpArray(input)).toEqual(["a", "b", "d"]);
});

test("Supports multiline strings", () => {
  const input = `${preamble} ["this string\n spans multiple lines", "\nand\n\tso\ndoes\nthis\n"];`;
  expect(parsePhpArray(input)).toEqual([
    "this string\n spans multiple lines",
    "\nand\n\tso\ndoes\nthis\n",
  ]);
});

test("Supports string concatenation", () => {
  const input = `${preamble} ["string" . "One", "str"."ing"\n./*comment*/" two"];`;
  expect(parsePhpArray(input)).toEqual(["stringOne", "string two"]);
});

test("Supports escaped characters in double-quoted strings", () => {
  const input = `${preamble} ["n\\nn", "r\\rn", "t\\tn", "v\\vn", "e\\en", "f\\fn", "s\\\\n", "d\\$n", "q\\"n"];`;
  expect(parsePhpArray(input)).toEqual([
    "n\nn",
    "r\rn",
    "t\tn",
    "v\vn",
    "e\u{001B}n",
    "f\fn",
    "s\\n",
    "d$n",
    'q"n',
  ]);
});

test("Ignores unrecognised escape sequences in double-quoted strings", () => {
  const input = `${preamble} ["a\\bc"];`;
  expect(parsePhpArray(input)).toEqual(["a\\bc"]);
});

test("Supports codepoint escape codes in double-quoted strings", () => {
  const input = `${preamble} ["a\\142c", "a\\x62c", "a\\u{62}c", "\\u{1F4A9}"];`;
  expect(parsePhpArray(input)).toEqual(["abc", "abc", "abc", "💩"]);
});

test("Supports escapes in single-quoted strings", () => {
  const input = `${preamble} ['a\\'b', 'a\\\\b', 'a\\\\\\'', 'a\\n'];`;
  expect(parsePhpArray(input)).toEqual(["a'b", "a\\b", "a\\'", "a\\n"]);
});
