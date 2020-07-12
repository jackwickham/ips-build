import xml, {XmlObject} from "xml";
import _ from "lodash";
import {XmlPrecursor} from "./ips-types";

export function serialise(obj: XmlObject): string {
  return xml(obj, {declaration: true});
}

export function convertForXml(obj: XmlPrecursor): XmlObject[] {
  return _.filter(
    _.map(obj, (val: XmlObject | XmlObject[] | undefined, key) => {
      if ((_.isArray(val) && val.length === 0) || val === undefined) {
        return null;
      }
      return {
        [key]: val,
      };
    }),
    (v) => v !== null
  );
}
