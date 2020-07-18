import {convertForXml, serialise} from "../src/xml";

test("convertForXml should indent all entries", () => {
  const input = {
    a: 1,
    b: [2],
  };
  expect(convertForXml(input)).toEqual([{a: 1}, {b: [2]}]);
});

test("convertForXml should drop undefined and empty entries", () => {
  const input = {
    a: 1,
    b: [],
    c: undefined,
  };
  expect(convertForXml(input)).toEqual([{a: 1}]);
});

test("should produce the expected xml", () => {
  const input = {
    a: [
      {
        b: {
          _attr: {
            attribute: 1,
          },
          _cdata: "bdata",
        },
      },
    ],
    c: [
      {
        d: [
          {
            _attr: {
              attribute: 2,
            },
          },
          "value",
        ],
      },
      {
        e: "e",
      },
    ],
    f: {
      _cdata: "f",
    },
  };
  const expected =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<root><a><b attribute="1"><![CDATA[bdata]]></b></a><c><d attribute="2">value</d><e>e</e></c><f><![CDATA[f]]></f></root>';
  const actual = serialise({
    root: convertForXml(input),
  });
  expect(actual).toEqual(expected);
});
