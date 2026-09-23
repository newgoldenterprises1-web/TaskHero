const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
function collectFiles(dir,ext){const out=[];for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())out.push(...collectFiles(full,ext));else if(entry.isFile()&&entry.name.endsWith(ext))out.push(full)}return out}
const jsFiles=collectFiles(root,".js").filter(file=>path.basename(file)!=="smoke.js");
const htmlFiles=collectFiles(root,".html");
const functions=new Set();
for(const file of jsFiles){const source=fs.readFileSync(file,"utf8");const rel=path.relative(root,file);try{new Function(source)}catch(err){throw new Error(rel+" syntax error: "+err.message)}for(const match of source.matchAll(/(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/g))functions.add(match[1])}
const handlers=new Set();
for(const file of htmlFiles){const source=fs.readFileSync(file,"utf8");for(const match of source.matchAll(/\bon[a-z]+\s*=\s*["']([A-Za-z0-9_]+)\s*\(/gi))handlers.add(match[1])}
const missing=[...handlers].filter(name=>!functions.has(name)&&!["alert","confirm"].includes(name));
if(missing.length)throw new Error("Missing inline handlers: "+missing.join(", "));
console.log("Near Family customer smoke check passed.");
console.log("JS files checked:",jsFiles.length);
console.log("HTML fragments checked:",htmlFiles.length);
console.log("Inline handlers checked:",handlers.size);