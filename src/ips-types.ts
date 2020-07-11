import {XmlObject} from "xml";

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
  setting: {
    key: string;
    default: string;
  };
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
  string
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
        js: boolean;
      };
    },
    string
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

export type XmlString = {
  _cdata: string;
} & XmlObject;

export type Uninstall = XmlString;
export type SettingsCode = XmlString;

export interface XmlPrecursor {
  [key: string]: XmlObject | XmlObject[] | undefined;
}

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

export interface HooksFile {
  [key: string]: {
    type: string;
    class: string;
  };
}

export type SettingsFile = {
  key: string;
  default: string;
}[];

export interface TasksFile {
  [key: string]: string;
}

export interface WidgetsFile {
  [key: string]: {
    class: string;
    restrict: string[];
    default_area: string;
    allow_reuse: boolean;
    menu_style: string;
    embeddable: boolean;
  };
}

export interface VersionsFile {
  [key: string]: string;
}
