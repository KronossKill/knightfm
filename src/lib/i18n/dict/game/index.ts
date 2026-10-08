// Knight FM — `game` i18n namespace registration (Task 4-a).
// Import this module once (app-root does) to register all four languages.
// Spanish is primary; every language has full key parity.

import { registerNamespaces } from "../../index";
import { dict as es } from "./es";
import { dict as en } from "./en";
import { dict as fr } from "./fr";
import { dict as pt } from "./pt";

registerNamespaces({ es, en, fr, pt });
