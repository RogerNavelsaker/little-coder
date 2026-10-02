// @bun
import{existsSync as v,statSync as E}from"fs";import{resolve as S,basename as A}from"path";var m=new Set(["con","prn","aux","nul","com1","com2","com3","com4","com5","com6","com7","com8","com9","lpt1","lpt2","lpt3","lpt4","lpt5","lpt6","lpt7","lpt8","lpt9"]);function y(n,e=process.cwd(),o=!0,r=!1){if(!n||typeof n!=="string")return{allowed:!1,normalizedPath:"",reason:"Missing or invalid target path"};let t=S(e,n),i=A(t).toLowerCase(),s=i.split(".")[0];if(m.has(s)||m.has(i))return{allowed:!1,normalizedPath:t,reason:`Blocked reserved device filename: '${i}'`};if(t==="/"||t===e)return{allowed:!1,normalizedPath:t,reason:"Cannot overwrite root directory as a file"};if(o&&!r){if(v(t))try{if(E(t).isFile())return{allowed:!1,normalizedPath:t,suggestEdit:!0,reason:`File '${n}' already exists. Refusing full file overwrite. Use 'edit' with linehash anchors instead, or set overwrite=true.`}}catch{}}return{allowed:!0,normalizedPath:t}}var O={maxLines:800,maxChars:40000};function w(n,e=O){if(!n||typeof n!=="string")return{truncated:!1,text:n,originalLines:0,originalChars:0};let o=n.split(`
`),r=o.length,t=n.length;if(r<=e.maxLines&&t<=e.maxChars)return{truncated:!1,text:n,originalLines:r,originalChars:t};let i=o.slice(0,30),s=`
... [Read Guard: Truncated ${r-30} lines / ${t} chars. File is too large for single read. Use 'outline' or read specific line slices: lines:N-M]`;return{truncated:!0,text:i.join(`
`)+s,originalLines:r,originalChars:t}}import{readFileSync as k,writeFileSync as I,existsSync as u}from"fs";import{dirname as C,join as d}from"path";import{fileURLToPath as R}from"url";var x="@earendil-works/pi-coding-agent",P={rel:"dist/modes/interactive/components/assistant-message.js",applied:'little-coder patch: suppress the bare "Operation aborted" marker',find:`                const abortMessage = message.errorMessage && message.errorMessage !== "Request was aborted"
                    ? message.errorMessage
                    : "Operation aborted";
                if (hasVisibleContent) {
                    this.contentContainer.addChild(new Spacer(1));
                }
                else {
                    this.contentContainer.addChild(new Spacer(1));
                }
                this.contentContainer.addChild(new Text(theme.fg("error", abortMessage), 1, 0));`,replace:`                // little-coder patch: suppress the bare "Operation aborted" marker.
                // Harness interventions surface their own single
`+`                // "harness intervention: \u2026" line, and a user ESC is self-evident.
`+`                // A genuine custom errorMessage is still shown.
                const abortMessage = message.errorMessage && message.errorMessage !== "Request was aborted"
                    ? message.errorMessage
                    : null;
                if (abortMessage) {
                    this.contentContainer.addChild(new Spacer(1));
                    this.contentContainer.addChild(new Text(theme.fg("error", abortMessage), 1, 0));
                }`},M={rel:"node_modules/@earendil-works/pi-tui/dist/components/box.js",applied:"little-coder patch: check child.render function existence in box component",find:`        // Render all children
        const childLines = [];
        for (const child of this.children) {
            const lines = child.render(contentWidth);`,replace:`        // Render all children
        // little-coder patch: check child.render function existence in box component
        const childLines = [];
        for (const child of this.children) {
            if (!child || typeof child.render !== "function") continue;
            const lines = child.render(contentWidth);`},N={rel:"dist/modes/interactive/components/tool-execution.js",applied:"little-coder patch: suppress blank spacer lines for grouped tools",find:`    render(width) {
        if (this.hideComponent) {
            return [];
        }
        return super.render(width);
    }`,replace:`    render(width) {
        if (this.hideComponent) {
            return [];
        }
        // little-coder patch: suppress blank spacer lines for grouped tools
        const lines = super.render(width);
        if (this.suppressLeadingSpacer || this.isGrouped) {
            if (lines.length > 0 && lines[0] === "") {
                lines.shift();
            }
        }
        return lines;
    }`},L={rel:"dist/modes/interactive/components/tool-execution.js",applied:"little-coder patch: toolDefinitionOverrides for third-party rendering",find:`    getCallRenderer() {
        if (!this.builtInToolDefinition) {
            return this.toolDefinition?.renderCall;
        }`,replace:`    // little-coder patch: toolDefinitionOverrides for third-party rendering
    getCallRenderer() {
        const override = globalThis.__littleCoderToolOverrides?.get(this.toolName);
        if (override?.renderCall) return override.renderCall;
        if (!this.builtInToolDefinition) {
            return this.toolDefinition?.renderCall;
        }`};function f(n){let e="",o=!1,r=!1;for(let t of n){if(r){e+=t,r=!1;continue}if(t==="\\"){e+=t,r=!0;continue}if(t==='"'){o=!o,e+=t;continue}if(o){if(t===`
`){e+="\\n";continue}if(t==="\r"){e+="\\r";continue}if(t==="\t"){e+="\\t";continue}}e+=t}return e}var T="little-coder patch: repair raw control chars in a JSON-string `edits`";function D(n){let e=" ".repeat(n);return`catch {
${e}    // ${T} (issue #127).
${e}    // Small local models emit literal newlines inside oldText/newText;
${e}    // JSON.parse rejects those as "Bad control character in string
${e}    // literal", and the original empty catch left \`edits\` a string for
${e}    // schema validation to refuse. With write refused for an existing
${e}    // file, that left the model no way to deliver a patch at all.
${e}    try {
${e}        const repair = ${String(f).split(`
`).join(`
${e}        `)};
${e}        const repaired = JSON.parse(repair(args.edits));
${e}        if (Array.isArray(repaired))
${e}            args.edits = repaired;
${e}    }
${e}    catch { }
${e}}`}var j={rel:"dist/core/tools/edit.js",applied:T,find:`            if (Array.isArray(parsed))
                args.edits = parsed;
        }
        catch { }
    }
    const legacy = args;`,replace:`            if (Array.isArray(parsed))
                args.edits = parsed;
        }
        `+D(8)+`
    }
    const legacy = args;`},G=[P,M,N,L,j];function W(n){if(n&&u(d(n,"package.json")))return n;try{let e=Bun.resolveSync(`${x}/package.json`,import.meta.dir);return C(e)}catch{}try{let e=C(R(import.meta.url)),o=d(e,"..","node_modules",...x.split("/"));if(u(d(o,"package.json")))return o}catch{}return null}function U(n){let e=W(n);if(!e)return;for(let o of G)try{let r=d(e,o.rel);if(!u(r))continue;let t=k(r,"utf8");if(t.includes(o.applied))continue;if(!t.includes(o.find))continue;I(r,t.replace(o.find,o.replace))}catch{}}var p=!1;try{p=process.argv[1]!=null&&R(import.meta.url)===process.argv[1]}catch{p=!1}if(p)U();function b(n){let e=n.trim();e=f(e),e=e.replace(/,(\s*[}\]])/g,"$1"),e=e.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g,'"$1"');let o=(e.match(/\{/g)||[]).length,r=(e.match(/\}/g)||[]).length;if(o>r)e+="}".repeat(o-r);let t=(e.match(/\[/g)||[]).length,i=(e.match(/\]/g)||[]).length;if(t>i)e+="]".repeat(t-i);return e}function _(n){if(!n||typeof n!=="string")return[];let e=[],o=/```(?:json|tool)?\s*([\s\S]*?)```/g,r;while((r=o.exec(n))!==null){let i=r[1].trim();if(!i.startsWith("{")&&!i.startsWith("["))continue;try{let s=JSON.parse(i);if(typeof s==="object"&&s!==null){if(s.tool||s.name){e.push({tool:s.tool||s.name,parameters:s.parameters||s.arguments||s.args||s,rawSnippet:r[0]});continue}}}catch{try{let s=b(i),a=JSON.parse(s);if(typeof a==="object"&&a!==null&&(a.tool||a.name))e.push({tool:a.tool||a.name,parameters:a.parameters||a.arguments||a.args||a,rawSnippet:r[0]})}catch{}}}let t=/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;while((r=t.exec(n))!==null){let i=r[1].trim();try{let s=b(i),a=JSON.parse(s);if(typeof a==="object"&&a!==null)e.push({tool:a.tool||a.name||"unknown",parameters:a.parameters||a.arguments||a.args||a,rawSnippet:r[0]})}catch{}}return e}class h{fileReadCounts=new Map;failedEditCounts=new Map;recordToolExecution(n,e,o,r){if(!r.has(n)&&n!=="sh")return{type:"hallucinated_tool",target:n,count:1,suggestion:`Tool '${n}' does not exist. Use available tools or run commands via 'sh'.`};if(n==="read"&&e?.path){let t=String(e.path),i=(this.fileReadCounts.get(t)||0)+1;if(this.fileReadCounts.set(t,i),i>=3)return{type:"read_loop",target:t,count:i,suggestion:`File '${t}' has been read ${i} times without modification. Use 'outline' or proceed to edit.`}}if((n==="edit"||n==="write")&&e?.path)this.fileReadCounts.delete(String(e.path));if(n==="edit"&&o){let t=String(e?.path||e?.edits?.[0]?.path||"unknown"),i=(this.failedEditCounts.get(t)||0)+1;if(this.failedEditCounts.set(t,i),i>=2)return{type:"patch_spiral",target:t,count:i,suggestion:`Repeated failed edits on '${t}' (${i} failures). Use fresh 'read' with line anchors or review the file outline.`}}else if(n==="edit"&&!o){let t=String(e?.path||e?.edits?.[0]?.path||"unknown");this.failedEditCounts.delete(t)}return null}reset(){this.fileReadCounts.clear(),this.failedEditCounts.clear()}}function B(n=process.env){let e=n.LITTLE_CODER_MAX_TURNS?parseInt(n.LITTLE_CODER_MAX_TURNS,10):NaN,o=!isNaN(e)&&e>0?e:40,r=n.LITTLE_CODER_WARN_REMAINING?parseInt(n.LITTLE_CODER_WARN_REMAINING,10):NaN,t=!isNaN(r)&&r>0?r:5;return{maxTurns:o,warnRemaining:t}}class g{warned=!1;config;constructor(n){this.config=n??B()}reset(){this.warned=!1}evaluateTurn(n){let e=n+1;if(e>=this.config.maxTurns)return{action:"abort",turnIndex:e,maxTurns:this.config.maxTurns,message:`Safety turn cap reached (${e}/${this.config.maxTurns} turns). Halting execution to prevent runaway loop.`};let o=this.config.maxTurns-e;if(o<=this.config.warnRemaining&&!this.warned)return this.warned=!0,{action:"warn",remaining:o,message:`Warning: Only ${o} turn${o===1?"":"s"} remaining before budget exhaustion (${e}/${this.config.maxTurns}). Finalize current work and verify now.`};return{action:"continue"}}}function F(n){let e=new h,o=new g;n.on("turn_start",async(r,t)=>{try{let i=r?.turnIndex??0,s=o.evaluateTurn(i);if(s.action==="warn"){if(t?.ui?.notify?.(s.message,"warning"),typeof n.sendUserMessage==="function")n.sendUserMessage(`[SYSTEM WARNING] ${s.message}
Please conclude current edits, run verifications, and provide your final answer now.`)}else if(s.action==="abort"){if(t?.ui?.notify?.(s.message,"error"),typeof t?.abort==="function")t.abort()}}catch{}}),n.on("tool_call",async(r,t)=>{try{let i=r?.toolName,s=r?.input;if(i==="write"&&s?.path){let a=y(s.path,t?.cwd||process.cwd(),!0,Boolean(s.overwrite));if(!a.allowed)return t?.ui?.notify?.(a.reason||"Write blocked by write-guard","warning"),{block:!0,reason:a.reason}}}catch{}}),n.on("tool_result",async(r,t)=>{try{let i=r?.toolName,s=r?.result;if(s&&Array.isArray(s.content)){for(let l of s.content)if(l.type==="text"&&typeof l.text==="string"){let c=w(l.text);if(c.truncated)l.text=c.text,t?.ui?.notify?.("Output truncated by read-guard","info")}}let a=e.recordToolExecution(i,r?.input,Boolean(r?.isError),new Set(["read","edit","write","sh","outline","repo_map","scratchpad","session","schedule","goal"]));if(a)t?.ui?.notify?.(`[Quality Warning] ${a.suggestion}`,"warning")}catch{}}),n.on("turn_end",async(r,t)=>{try{let i=r?.message;if(i?.role==="assistant"){let s=typeof i.content==="string"?i.content:Array.isArray(i.content)?i.content.map((l)=>l.text||"").join(`
`):"",a=_(s);if(a.length>0){let c=`Notice: Fenced tool call detected in text for '${a[0].tool}'. Please invoke tools natively.`;t?.ui?.notify?.(c,"warning")}}}catch{}}),n.on("session_start",async()=>{e.reset(),o.reset()}),n.on("before_agent_start",async()=>{o.reset()})}export{F as default};
