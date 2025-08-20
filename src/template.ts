import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_DIR = path.join(__dirname, "./views");

function load_fragment(rel_path: string) {
  const fpath = path.join(BASE_DIR, rel_path);
  return fs.readFileSync(fpath, "utf8");
}

export function render_fragment(
  template_path: string,
  vars: Record<string, string> = {},
) {
  let html = load_fragment(template_path);

  // Handle includes like {{> fragments/nav.html }}
  html = html.replace(/{{>\s*([^}]+)\s*}}/g, (_, include_path) => {
    return render_fragment(include_path.trim(), vars);
  });

  // Handle variables {{name}}
  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    html = html.replace(regex, value);
  }

  return html;
}

const template = {
  render_fragment,
};

export default template;
