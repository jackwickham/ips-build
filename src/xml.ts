import xml, {XmlObject} from "xml";
import _ from "lodash";

interface Xmlable {
  [key: string]: {
    [key: string]: XmlObject | XmlObject[] | undefined;
  };
}

export function objectToXml<T extends Xmlable, K extends keyof T>(obj: T, root: K): string {
  const xmlified: XmlObject = {
    [root]: _.filter(
      _.map(obj[root], (val: XmlObject | XmlObject[] | undefined, key) => {
        if ((_.isArray(val) && val.length === 0) || val === undefined) {
          return null;
        }
        return {
          [key]: val,
        };
      }),
      (v) => v !== null
    ),
  };

  return xml(xmlified);
}
