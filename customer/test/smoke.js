const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");

const jsFiles=[
  "js/app.js","js/catalog.js","js/auth.js","js/navigation.js",
  "js/booking.js","js/family.js","js/profile.js","js/location.js",
  "js/notifications.js","js/shell-loader.js"
];
const htmlFiles=[
  "pages/header.html","pages/home.html","pages/bookings.html",
  "pages/family.html","pages/profile.html","pages/navigation.html",
  "pages/modals.html","pages/auth.html","pages/splash.html"
];

const functions=new Set();
for(const rel of jsFiles){
  const file=path.join(root,rel);
  const source=fs.readFileSync(file,"utf8");
  try{new Function(source)}catch(err){throw new Error(rel+" syntax error: "+err.message)}
  for(const match of source.matchAll(/(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/g))functions.add(match[1]);
}

const handlers=new Set();
for(const rel of htmlFiles){
  const source=fs.readFileSync(path.join(root,rel),"utf8");
  for(const match of source.matchAll(/\bon[a-z]+\s*=\s*"([A-Za-z0-9_]+)\s*\(/gi))handlers.add(match[1]);
}

const missing=[...handlers].filter(name=>!functions.has(name)&&!["alert","confirm"].includes(name));
if(missing.length)throw new Error("Missing inline handlers: "+missing.join(", "));

console.log("Near Family customer smoke check passed.");
console.log("JS files checked:",jsFiles.length);
console.log("HTML fragments checked:",htmlFiles.length);
console.log("Inline handlers checked:",handlers.size);
