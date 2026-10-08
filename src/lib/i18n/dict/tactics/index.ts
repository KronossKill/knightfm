// Knight FM — tactics i18n namespace registration (spec §33).
// Import this module once (side effect) from any tactics component entry.

import type { Dict } from "../../index";
import { registerNamespaces } from "../../index";

import { dict as es } from "./es";
import { dict as en } from "./en";
import { dict as fr } from "./fr";
import { dict as pt } from "./pt";

registerNamespaces({ es, en, fr, pt });
