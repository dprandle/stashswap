import fs from "fs";

// If an entry is in this list it won't be removed from public
const exclusion_list = ["profile_pics"];
console.log("Removing all files/dirs from public except:", exclusion_list.join(", "));
const public_files = fs.readdirSync("public", { withFileTypes: true});
for (const file of public_files) {
    if (!exclusion_list.includes(file.name)) {
        fs.rmSync(file.parentPath + "/" + file.name, {"recursive": true});
    }
}

console.log("Removing output dist dir");
fs.rmSync("dist", {recursive: true, force: true});
