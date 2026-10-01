/**
 * The brand layer is pure CSS: importing this module loads `brand.css`, the one stylesheet that holds colour
 * values, and the Inter font it names (`--font-sans`). The root layout imports it after `globals.css`, so the brand tokens land after the grammar's own.
 */
import "@fontsource-variable/inter"
import "./brand.css"
