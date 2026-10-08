// Knight FM — landing i18n namespace registration.
// Imported once from src/components/landing/index.tsx (side-effect import).
import { registerNamespaces } from "../../index";
import { dict as es } from "./es";
import { dict as en } from "./en";
import { dict as fr } from "./fr";
import { dict as pt } from "./pt";

registerNamespaces({ es, en, fr, pt });
