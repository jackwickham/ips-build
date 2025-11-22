import {XmlObject} from "xml";

/* eslint-disable @typescript-eslint/naming-convention */

// Types that represent has has to be serialised into the XML file

export type Hook = {
  hook: {
    _attr: {
      type: string;
      class: string;
      filename: string;
    };
    _cdata: string;
  };
} & XmlObject;

export type Setting = {
  setting: [
    {
      key: string;
    },
    {
      default: string;
    },
  ];
} & XmlObject;

export type Task = {
  task: {
    _attr: {
      key: string;
      frequency: string;
    };
    _cdata: string;
  };
} & XmlObject;

export type Widget = {
  widget: {
    _attr: {
      key: string;
      [key: string]: unknown;
    };
    _cdata: string;
  };
} & XmlObject;

export type ResourceContents = [
  {
    _attr: {
      filename: string;
    };
  },
  string,
] &
  XmlObject;

export type HtmlFile = {
  html: ResourceContents;
} & XmlObject;

export type CssFile = {
  css: ResourceContents;
} & XmlObject;

export type JsFile = {
  js: ResourceContents;
} & XmlObject;

export type ResourceFile = {
  resources: ResourceContents;
} & XmlObject;

export type LangWord = {
  word: [
    {
      _attr: {
        key: string;
        js: 0 | 1;
      };
    },
    string,
  ];
} & XmlObject;

export type Version = {
  version: {
    _attr: {
      human: string;
      long: number | string;
    };
    _cdata?: string;
  };
} & XmlObject;

export type CmsTemplates = {
  _cdata: string;
} & XmlObject;

type CData = {
  _cdata: string;
} & XmlObject;

export type Uninstall = CData;
export type SettingsCode = CData;

export type XmlPrecursor = Record<string, XmlObject | XmlObject[] | undefined>;

export interface PluginData extends XmlPrecursor {
  _attr: {
    name: string;
    author?: string;
    website?: string;
    version_human: string;
    version_long: number;
  };

  hooks: Hook[];
  settings?: Setting[];
  settingsCode?: SettingsCode;
  uninstall?: Uninstall;
  tasks?: Task[];
  widgets?: Widget[];
  htmlFiles: HtmlFile[];
  cssFiles: CssFile[];
  jsFiles: JsFile[];
  resourcesFiles: ResourceFile[];
  lang?: LangWord[];
  versions: Version[];
  cmsTemplates?: CmsTemplates;
}

// IPS json file types

export type HooksFile = Record<
  string,
  {
    type: string;
    class: string;
  }
>;

export type SettingsFile = {
  key: string;
  default: string;
}[];

export type TasksFile = Record<string, string>;

export type WidgetsFile = Record<
  string,
  {
    class: string;
    restrict: string[];
    default_area: string;
    allow_reuse: boolean;
    menu_style: string;
    embeddable: boolean;
  }
>;

export type VersionsFile = Record<string, string>;
