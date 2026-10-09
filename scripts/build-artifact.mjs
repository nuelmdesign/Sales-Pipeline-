/**
 * Turns the single-file build into the page body a Claude artifact expects.
 * The artifact host adds its own <!doctype>, <html>, <head> and <body>, so this
 * keeps only the title, styles, scripts and app root.
 *
 * Run with: npm run build:artifact  (writes artifact/prospect-crm.html)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"

const src = readFileSync("dist-single/index.html", "utf8")
const head = src.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? ""
const body = src.match(/<body[^>]*>([\s\S]*?)<\/body>/)?.[1] ?? ""
const cleanHead = head
  .replace(/<meta[^>]*>\s*/g, "")
  .replace(/<link[^>]*>\s*/g, "")
  .replace(/<title>[\s\S]*?<\/title>\s*/g, "")
  .trim()

mkdirSync("artifact", { recursive: true })
const out = `<title>Prospect CRM</title>\n${cleanHead}\n${body.trim()}\n`
writeFileSync("artifact/prospect-crm.html", out)
console.log(`artifact/prospect-crm.html (${(out.length / 1024).toFixed(0)} KB)`)
