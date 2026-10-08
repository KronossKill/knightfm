// Knight FM — `admincfg` i18n namespace registration (Task 21).
// Import this module once (the Control Center does) to register all four languages.

import { registerNamespaces } from "../../index";
import { dict as es } from "./es";
import { dict as en } from "./en";
import { dict as fr } from "./fr";
import { dict as pt } from "./pt";

registerNamespaces({ es, en, fr, pt });
