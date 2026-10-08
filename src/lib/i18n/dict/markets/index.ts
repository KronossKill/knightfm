// Knight FM — markets i18n namespace registration (Task 4-c).
// Side-effect import: `import "@/lib/i18n/dict/markets"` from any market/finance view.
import { registerNamespaces } from "../../index";
import { dict as es } from "./es";
import { dict as en } from "./en";
import { dict as fr } from "./fr";
import { dict as pt } from "./pt";

registerNamespaces({ es, en, fr, pt });
