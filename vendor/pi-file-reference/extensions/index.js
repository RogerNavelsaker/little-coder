// @bun
import*as c from"fs";import*as r from"path";import*as d from"os";function I(t){let n=[],e=0;while(e<t.length){let i=t.indexOf("@",e);if(i===-1)break;if(i>0&&t[i-1]!==" "&&t[i-1]!=="\t"){e=i+1;continue}e=i+1;let o;if(t[e]==='"'){let s=t.indexOf('"',e+1);o=s===-1?t.slice(e+1):t.slice(e+1,s),e=s===-1?t.length:s+1}else{let s=e;while(e<t.length&&!/\s/.test(t[e]))e++;o=t.slice(s,e)}if(o&&(o.includes("/")||o.includes("."))){let s=o.split("/").pop(),a=s.lastIndexOf(".");if(a!==-1){let h=s.slice(a);if(h!==".md"&&h!==".mdc")continue}n.push(o)}}return n}function P(t,n){if(t.startsWith("/"))return t;if(t.startsWith("~")){let e=t.indexOf("/");if(e===-1)return r.join(d.homedir(),t.slice(1));let i=t.slice(1,e);if(!i)return r.join(d.homedir(),t.slice(e+1));return r.join(d.homedir(),i,t.slice(e+1))}return r.resolve(n,t)}var w=102400;function R(t){let n=new Set,e=[];for(let{path:i,content:o}of t){let s=r.dirname(i),a=[];for(let f of o.split(`
`))a.push(...I(f));let h=a.filter((f)=>{if(n.has(f))return!1;return n.add(f),!0});for(let f of h){let j=f.endsWith("/")?f.slice(0,-1):f,l=P(j,s);if(!c.existsSync(l)){console.warn(`[pi-file-reference] @${j} -> ${l} not found, skipping`);continue}let S=c.statSync(l);if(S.isDirectory()){let y=c.readdirSync(l,{withFileTypes:!0}).filter((p)=>{if(!p.isFile())return!1;if(p.name.startsWith("."))return!1;let u=r.extname(p.name);return u===".md"||u===".mdc"}).map((p)=>p.name).sort();for(let p of y){let u=r.join(l,p);if(c.statSync(u).size>w){console.warn(`[pi-file-reference] ${u} exceeds 100KB limit, skipping`);continue}e.push(u)}}else{if(S.size>w){console.warn(`[pi-file-reference] ${l} exceeds 100KB limit, skipping`);continue}e.push(l)}}}return e}function _(t){return t.map((n)=>({path:n,content:c.readFileSync(n,"utf-8")}))}function F(t,n){if(!t.length)return n;let e=t.map((s)=>`<project_references path="${s.path}">
${s.content}
</project_references>`).join(`

`),i="</project_context>",o=n.lastIndexOf(i);if(o!==-1){let s=n.slice(0,o),a=n.slice(o);return s+e+`

`+a}return n+`

<project_context>

${e}

</project_context>`}var g=[],x=[],m=!1;function C(t){t.on("session_start",()=>{g=[],x=[],m=!1}),t.on("before_agent_start",(n)=>{if(!m)g=R(n.systemPromptOptions.contextFiles??[]),x=_(g),m=!0;let e=F(x,n.systemPrompt);if(e!==n.systemPrompt)return{systemPrompt:e}})}export{C as default,R as getAllFilePathFromContextFiles,F as inject,_ as parseFileAndContent,I as parseRefs,P as resolveRef};
