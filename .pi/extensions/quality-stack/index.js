// @bun
import{existsSync as S,statSync as v}from"fs";import{resolve as E,basename as _}from"path";var h=new Set(["con","prn","aux","nul","com1","com2","com3","com4","com5","com6","com7","com8","com9","lpt1","lpt2","lpt3","lpt4","lpt5","lpt6","lpt7","lpt8","lpt9"]);function g(n,e=process.cwd(),r=!0,i=!1){if(!n||typeof n!=="string")return{allowed:!1,normalizedPath:"",reason:"Missing or invalid target path"};let t=E(e,n),o=_(t).toLowerCase(),s=o.split(".")[0];if(h.has(s)||h.has(o))return{allowed:!1,normalizedPath:t,reason:`Blocked reserved device filename: '${o}'`};if(t==="/"||t===e)return{allowed:!1,normalizedPath:t,reason:"Cannot overwrite root directory as a file"};if(r&&!i){if(S(t))try{if(v(t).isFile())return{allowed:!1,normalizedPath:t,suggestEdit:!0,reason:`File '${n}' already exists. Refusing full file overwrite. Use 'edit' with linehash anchors instead, or set overwrite=true.`}}catch{}}return{allowed:!0,normalizedPath:t}}var T={maxLines:800,maxChars:40000};function m(n,e=T){if(!n||typeof n!=="string")return{truncated:!1,text:n,originalLines:0,originalChars:0};let r=n.split(`
`),i=r.length,t=n.length;if(i<=e.maxLines&&t<=e.maxChars)return{truncated:!1,text:n,originalLines:i,originalChars:t};let o=r.slice(0,30),s=`
... [Read Guard: Truncated ${i-30} lines / ${t} chars. File is too large for single read. Use 'outline' or read specific line slices: lines:N-M]`;return{truncated:!0,text:o.join(`
`)+s,originalLines:i,originalChars:t}}import{readFileSync as A,writeFileSync as k,existsSync as d}from"fs";import{dirname as y,join as c}from"path";import{fileURLToPath as C}from"url";var w="@earendil-works/pi-coding-agent",P={rel:"dist/modes/interactive/components/assistant-message.js",applied:'little-coder patch: suppress the bare "Operation aborted" marker',find:`                const abortMessage = message.errorMessage && message.errorMessage !== "Request was aborted"
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
                }`},O={rel:"node_modules/@earendil-works/pi-tui/dist/components/box.js",applied:"little-coder patch: check child.render function existence in box component",find:`        // Render all children
        const childLines = [];
        for (const child of this.children) {
            const lines = child.render(contentWidth);`,replace:`        // Render all children
        // little-coder patch: check child.render function existence in box component
        const childLines = [];
        for (const child of this.children) {
            if (!child || typeof child.render !== "function") continue;
            const lines = child.render(contentWidth);`},M={rel:"dist/modes/interactive/components/tool-execution.js",applied:"little-coder patch: suppress blank spacer lines for grouped tools",find:`    render(width) {
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
        }`};function u(n){let e="",r=!1,i=!1;for(let t of n){if(i){e+=t,i=!1;continue}if(t==="\\"){e+=t,i=!0;continue}if(t==='"'){r=!r,e+=t;continue}if(r){if(t===`
`){e+="\\n";continue}if(t==="\r"){e+="\\r";continue}if(t==="\t"){e+="\\t";continue}}e+=t}return e}var x="little-coder patch: repair raw control chars in a JSON-string `edits`";function j(n){let e=" ".repeat(n);return`catch {
${e}    // ${x} (issue #127).
${e}    // Small local models emit literal newlines inside oldText/newText;
${e}    // JSON.parse rejects those as "Bad control character in string
${e}    // literal", and the original empty catch left \`edits\` a string for
${e}    // schema validation to refuse. With write refused for an existing
${e}    // file, that left the model no way to deliver a patch at all.
${e}    try {
${e}        const repair = ${String(u).split(`
`).join(`
${e}        `)};
${e}        const repaired = JSON.parse(repair(args.edits));
${e}        if (Array.isArray(repaired))
${e}            args.edits = repaired;
${e}    }
${e}    catch { }
${e}}`}var D={rel:"dist/core/tools/edit.js",applied:x,find:`            if (Array.isArray(parsed))
                args.edits = parsed;
        }
        catch { }
    }
    const legacy = args;`,replace:`            if (Array.isArray(parsed))
                args.edits = parsed;
        }
        `+j(8)+`
    }
    const legacy = args;`},I=[P,O,M,L,D];function B(n){if(n&&d(c(n,"package.json")))return n;try{let e=Bun.resolveSync(`${w}/package.json`,import.meta.dir);return y(e)}catch{}try{let e=y(C(import.meta.url)),r=c(e,"..","node_modules",...w.split("/"));if(d(c(r,"package.json")))return r}catch{}return null}function G(n){let e=B(n);if(!e)return;for(let r of I)try{let i=c(e,r.rel);if(!d(i))continue;let t=A(i,"utf8");if(t.includes(r.applied))continue;if(!t.includes(r.find))continue;k(i,t.replace(r.find,r.replace))}catch{}}var p=!1;try{p=process.argv[1]!=null&&C(import.meta.url)===process.argv[1]}catch{p=!1}if(p)G();function R(n){let e=n.trim();e=u(e),e=e.replace(/,(\s*[}\]])/g,"$1"),e=e.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g,'"$1"');let r=(e.match(/\{/g)||[]).length,i=(e.match(/\}/g)||[]).length;if(r>i)e+="}".repeat(r-i);let t=(e.match(/\[/g)||[]).length,o=(e.match(/\]/g)||[]).length;if(t>o)e+="]".repeat(t-o);return e}function b(n){if(!n||typeof n!=="string")return[];let e=[],r=/```(?:json|tool)?\s*([\s\S]*?)```/g,i;while((i=r.exec(n))!==null){let o=i[1].trim();if(!o.startsWith("{")&&!o.startsWith("["))continue;try{let s=JSON.parse(o);if(typeof s==="object"&&s!==null){if(s.tool||s.name){e.push({tool:s.tool||s.name,parameters:s.parameters||s.arguments||s.args||s,rawSnippet:i[0]});continue}}}catch{try{let s=R(o),a=JSON.parse(s);if(typeof a==="object"&&a!==null&&(a.tool||a.name))e.push({tool:a.tool||a.name,parameters:a.parameters||a.arguments||a.args||a,rawSnippet:i[0]})}catch{}}}let t=/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;while((i=t.exec(n))!==null){let o=i[1].trim();try{let s=R(o),a=JSON.parse(s);if(typeof a==="object"&&a!==null)e.push({tool:a.tool||a.name||"unknown",parameters:a.parameters||a.arguments||a.args||a,rawSnippet:i[0]})}catch{}}return e}class f{fileReadCounts=new Map;failedEditCounts=new Map;recordToolExecution(n,e,r,i){if(!i.has(n)&&n!=="sh")return{type:"hallucinated_tool",target:n,count:1,suggestion:`Tool '${n}' does not exist. Use available tools or run commands via 'sh'.`};if(n==="read"&&e?.path){let t=String(e.path),o=(this.fileReadCounts.get(t)||0)+1;if(this.fileReadCounts.set(t,o),o>=3)return{type:"read_loop",target:t,count:o,suggestion:`File '${t}' has been read ${o} times without modification. Use 'outline' or proceed to edit.`}}if((n==="edit"||n==="write")&&e?.path)this.fileReadCounts.delete(String(e.path));if(n==="edit"&&r){let t=String(e?.path||e?.edits?.[0]?.path||"unknown"),o=(this.failedEditCounts.get(t)||0)+1;if(this.failedEditCounts.set(t,o),o>=2)return{type:"patch_spiral",target:t,count:o,suggestion:`Repeated failed edits on '${t}' (${o} failures). Use fresh 'read' with line anchors or review the file outline.`}}else if(n==="edit"&&!r){let t=String(e?.path||e?.edits?.[0]?.path||"unknown");this.failedEditCounts.delete(t)}return null}reset(){this.fileReadCounts.clear(),this.failedEditCounts.clear()}}function W(n){let e=new f;n.on("tool_call",async(r,i)=>{try{let t=r?.toolName,o=r?.input;if(t==="write"&&o?.path){let s=g(o.path,i?.cwd||process.cwd(),!0,Boolean(o.overwrite));if(!s.allowed)return i?.ui?.notify?.(s.reason||"Write blocked by write-guard","warning"),{block:!0,reason:s.reason}}}catch{}}),n.on("tool_result",async(r,i)=>{try{let t=r?.toolName,o=r?.result;if(o&&Array.isArray(o.content)){for(let a of o.content)if(a.type==="text"&&typeof a.text==="string"){let l=m(a.text);if(l.truncated)a.text=l.text,i?.ui?.notify?.("Output truncated by read-guard","info")}}let s=e.recordToolExecution(t,r?.input,Boolean(r?.isError),new Set(["read","edit","write","sh","outline","repo_map","scratchpad","session","schedule","goal"]));if(s)i?.ui?.notify?.(`[Quality Warning] ${s.suggestion}`,"warning")}catch{}}),n.on("turn_end",async(r,i)=>{try{let t=r?.message;if(t?.role==="assistant"){let o=typeof t.content==="string"?t.content:Array.isArray(t.content)?t.content.map((a)=>a.text||"").join(`
`):"",s=b(o);if(s.length>0){let l=`Notice: Fenced tool call detected in text for '${s[0].tool}'. Please invoke tools natively.`;i?.ui?.notify?.(l,"warning")}}}catch{}}),n.on("session_start",async()=>{e.reset()})}export{W as default};
