// @bun
import*as U from"fs";import*as Q from"path";import*as N from"os";function D(B){let J=[],G=0;while(G<B.length){let L=B.indexOf("@",G);if(L===-1)break;if(L>0&&B[L-1]!==" "&&B[L-1]!=="\t"){G=L+1;continue}G=L+1;let O;if(B[G]==='"'){let K=B.indexOf('"',G+1);O=K===-1?B.slice(G+1):B.slice(G+1,K),G=K===-1?B.length:K+1}else{let K=G;while(G<B.length&&!/\s/.test(B[G]))G++;O=B.slice(K,G)}if(O&&(O.includes("/")||O.includes("."))){let K=O.split("/").pop(),W=K.lastIndexOf(".");if(W!==-1){let H=K.slice(W);if(H!==".md"&&H!==".mdc")continue}J.push(O)}}return J}function A(B,J){if(B.startsWith("/"))return B;if(B.startsWith("~")){let G=B.indexOf("/");if(G===-1)return Q.join(N.homedir(),B.slice(1));let L=B.slice(1,G);if(!L)return Q.join(N.homedir(),B.slice(G+1));return Q.join(N.homedir(),L,B.slice(G+1))}return Q.resolve(J,B)}var w=102400;function S(B){let J=new Set,G=[];for(let{path:L,content:O}of B){let K=Q.dirname(L),W=[];for(let V of O.split(`
`))W.push(...D(V));let H=W.filter((V)=>{if(J.has(V))return!1;return J.add(V),!0});for(let V of H){let X=V.endsWith("/")?V.slice(0,-1):V,Y=A(X,K);if(!U.existsSync(Y)){console.warn(`[pi-file-reference] @${X} -> ${Y} not found, skipping`);continue}let Z=U.statSync(Y);if(Z.isDirectory()){let z=U.readdirSync(Y,{withFileTypes:!0}).filter(($)=>{if(!$.isFile())return!1;if($.name.startsWith("."))return!1;let q=Q.extname($.name);return q===".md"||q===".mdc"}).map(($)=>$.name).sort();for(let $ of z){let q=Q.join(Y,$);if(U.statSync(q).size>w){console.warn(`[pi-file-reference] ${q} exceeds 100KB limit, skipping`);continue}G.push(q)}}else{if(Z.size>w){console.warn(`[pi-file-reference] ${Y} exceeds 100KB limit, skipping`);continue}G.push(Y)}}}return G}function j(B){return B.map((J)=>({path:J,content:U.readFileSync(J,"utf-8")}))}function u(B,J){if(!B.length)return J;let G=B.map((K)=>`<project_references path="${K.path}">
${K.content}
</project_references>`).join(`

`),L="</project_context>",O=J.lastIndexOf(L);if(O!==-1){let K=J.slice(0,O),W=J.slice(O);return K+G+`

`+W}return J+`

<project_context>

${G}

</project_context>`}var T=[],E=[],M=!1;function C(B){B.on("session_start",()=>{T=[],E=[],M=!1}),B.on("before_agent_start",(J)=>{if(!M)T=S(J.systemPromptOptions.contextFiles??[]),E=j(T),M=!0;let G=u(E,J.systemPrompt);if(G!==J.systemPrompt)return{systemPrompt:G}})}export{A as resolveRef,D as parseRefs,j as parseFileAndContent,u as inject,S as getAllFilePathFromContextFiles,C as default};
