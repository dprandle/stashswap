import { readFileSync, writeFileSync } from "fs";
import { createHash } from "crypto";

const file = "assets/icons.svg";
const buf  = readFileSync(file);
const hash = createHash("md5").update(buf).digest("hex").slice(0, 8);

writeFileSync("public/asset-manifest.json", JSON.stringify({ "icons.svg": hash }, null, 2));
console.log("icons.svg hash:", hash);
