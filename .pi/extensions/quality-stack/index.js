// @bun
import{existsSync as O,statSync as P}from"fs";import{resolve as I,basename as N}from"path";var b=new Set(["con","prn","aux","nul","com1","com2","com3","com4","com5","com6","com7","com8","com9","lpt1","lpt2","lpt3","lpt4","lpt5","lpt6","lpt7","lpt8","lpt9"]);function x(t,e=process.cwd(),r=!0,o=!1){if(!t||typeof t!=="string")return{allowed:!1,normalizedPath:"",reason:"Missing or invalid target path"};let n=I(e,t),i=N(n).toLowerCase(),a=i.split(".")[0];if(b.has(a)||b.has(i))return{allowed:!1,normalizedPath:n,reason:`Blocked reserved device filename: '${i}'`};if(n==="/"||n===e)return{allowed:!1,normalizedPath:n,reason:"Cannot overwrite root directory as a file"};if(r&&!o){if(O(n))try{if(P(n).isFile())return{allowed:!1,normalizedPath:n,suggestEdit:!0,reason:`File '${t}' already exists. Refusing full file overwrite. Use 'edit' with linehash anchors instead, or set overwrite=true.`}}catch{}}return{allowed:!0,normalizedPath:n}}var D={maxLines:800,maxChars:40000};function R(t,e=D){if(!t||typeof t!=="string")return{truncated:!1,text:t,originalLines:0,originalChars:0};let r=t.split(`
`),o=r.length,n=t.length;if(o<=e.maxLines&&n<=e.maxChars)return{truncated:!1,text:t,originalLines:o,originalChars:n};let i=r.slice(0,30),a=`
... [Read Guard: Truncated ${o-30} lines / ${n} chars. File is too large for single read. Use 'outline' or read specific line slices: lines:N-M]`;return{truncated:!0,text:i.join(`
`)+a,originalLines:o,originalChars:n}}import{readFileSync as j,writeFileSync as G,existsSync as h}from"fs";import{dirname as _,join as p}from"path";import{fileURLToPath as A}from"url";var E="@earendil-works/pi-coding-agent",F={rel:"dist/modes/interactive/components/assistant-message.js",applied:'little-coder patch: suppress the bare "Operation aborted" marker',find:`                const abortMessage = message.errorMessage && message.errorMessage !== "Request was aborted"
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
                }`},U={rel:"node_modules/@earendil-works/pi-tui/dist/components/box.js",applied:"little-coder patch: check child.render function existence in box component",find:`        // Render all children
        const childLines = [];
        for (const child of this.children) {
            const lines = child.render(contentWidth);`,replace:`        // Render all children
        // little-coder patch: check child.render function existence in box component
        const childLines = [];
        for (const child of this.children) {
            if (!child || typeof child.render !== "function") continue;
            const lines = child.render(contentWidth);`},H={rel:"dist/modes/interactive/components/tool-execution.js",applied:"little-coder patch: suppress blank spacer lines for grouped tools",find:`    render(width) {
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
    }`},W={rel:"dist/modes/interactive/components/tool-execution.js",applied:"little-coder patch: toolDefinitionOverrides for third-party rendering",find:`    getCallRenderer() {
        if (!this.builtInToolDefinition) {
            return this.toolDefinition?.renderCall;
        }`,replace:`    // little-coder patch: toolDefinitionOverrides for third-party rendering
    getCallRenderer() {
        const override = globalThis.__littleCoderToolOverrides?.get(this.toolName);
        if (override?.renderCall) return override.renderCall;
        if (!this.builtInToolDefinition) {
            return this.toolDefinition?.renderCall;
        }`};function m(t){let e="",r=!1,o=!1;for(let n of t){if(o){e+=n,o=!1;continue}if(n==="\\"){e+=n,o=!0;continue}if(n==='"'){r=!r,e+=n;continue}if(r){if(n===`
`){e+="\\n";continue}if(n==="\r"){e+="\\r";continue}if(n==="\t"){e+="\\t";continue}}e+=n}return e}var M="little-coder patch: repair raw control chars in a JSON-string `edits`";function B(t){let e=" ".repeat(t);return`catch {
${e}    // ${M} (issue #127).
${e}    // Small local models emit literal newlines inside oldText/newText;
${e}    // JSON.parse rejects those as "Bad control character in string
${e}    // literal", and the original empty catch left \`edits\` a string for
${e}    // schema validation to refuse. With write refused for an existing
${e}    // file, that left the model no way to deliver a patch at all.
${e}    try {
${e}        const repair = ${String(m).split(`
`).join(`
${e}        `)};
${e}        const repaired = JSON.parse(repair(args.edits));
${e}        if (Array.isArray(repaired))
${e}            args.edits = repaired;
${e}    }
${e}    catch { }
${e}}`}var J={rel:"dist/core/tools/edit.js",applied:M,find:`            if (Array.isArray(parsed))
                args.edits = parsed;
        }
        catch { }
    }
    const legacy = args;`,replace:`            if (Array.isArray(parsed))
                args.edits = parsed;
        }
        `+B(8)+`
    }
    const legacy = args;`},z={rel:"dist/core/auth-storage.js",applied:"little-coder patch: verify oauth provider exists in hasAuth",find:`    hasAuth(provider) {
        if (this.runtimeOverrides.has(provider))
            return true;
        if (this.data[provider])
            return true;`,replace:`    hasAuth(provider) {
        // little-coder patch: verify oauth provider exists in hasAuth
        if (this.runtimeOverrides.has(provider))
            return true;
        const cred = this.data[provider];
        if (cred) {
            if (cred.type === "oauth" && !getOAuthProvider(provider))
                return false;
            return true;
        }`},K={rel:"dist/core/model-resolver.js",applied:"little-coder patch: reject empty pattern in tryMatchModel",find:`function tryMatchModel(modelPattern, availableModels) {
    const exactMatch = findExactModelReferenceMatch(modelPattern, availableModels);`,replace:`function tryMatchModel(modelPattern, availableModels) {
    // little-coder patch: reject empty pattern in tryMatchModel
    if (!modelPattern || modelPattern.trim().length === 0) {
        return undefined;
    }
    const exactMatch = findExactModelReferenceMatch(modelPattern, availableModels);`},Q={rel:"dist/core/model-resolver.js",applied:"little-coder patch: verify auth on settings default model in findInitialModel",find:`    // 3. Try saved default from settings
    if (defaultProvider && defaultModelId) {
        const found = modelRegistry.find(defaultProvider, defaultModelId);
        if (found) {
            model = found;
            if (defaultThinkingLevel) {
                thinkingLevel = defaultThinkingLevel;
            }
            return { model, thinkingLevel, fallbackMessage: undefined };
        }
    }`,replace:`    // 3. Try saved default from settings
    // little-coder patch: verify auth on settings default model in findInitialModel
    if (defaultProvider && defaultModelId) {
        const found = modelRegistry.find(defaultProvider, defaultModelId);
        if (found && modelRegistry.hasConfiguredAuth(found)) {
            model = found;
            if (defaultThinkingLevel) {
                thinkingLevel = defaultThinkingLevel;
            }
            return { model, thinkingLevel, fallbackMessage: undefined };
        }
    }`},V=[F,U,H,W,J,z,K,Q];function X(t){if(t&&h(p(t,"package.json")))return t;try{let e=Bun.resolveSync(`${E}/package.json`,import.meta.dir);return _(e)}catch{}try{let e=_(A(import.meta.url)),r=p(e,"..","node_modules",...E.split("/"));if(h(p(r,"package.json")))return r}catch{}return null}function q(t){let e=X(t);if(!e)return;for(let r of V)try{let o=p(e,r.rel);if(!h(o))continue;let n=j(o,"utf8");if(n.includes(r.applied))continue;if(!n.includes(r.find))continue;G(o,n.replace(r.find,r.replace))}catch{}}var g=!1;try{g=process.argv[1]!=null&&A(import.meta.url)===process.argv[1]}catch{g=!1}if(g)q();function S(t){let e=t.trim();e=m(e),e=e.replace(/,(\s*[}\]])/g,"$1"),e=e.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g,'"$1"');let r=(e.match(/\{/g)||[]).length,o=(e.match(/\}/g)||[]).length;if(r>o)e+="}".repeat(r-o);let n=(e.match(/\[/g)||[]).length,i=(e.match(/\]/g)||[]).length;if(n>i)e+="]".repeat(n-i);return e}function k(t){if(!t||typeof t!=="string")return[];let e=[],r=/```(?:json|tool)?\s*([\s\S]*?)```/g,o;while((o=r.exec(t))!==null){let i=o[1].trim();if(!i.startsWith("{")&&!i.startsWith("["))continue;try{let a=JSON.parse(i);if(typeof a==="object"&&a!==null){if(a.tool||a.name){e.push({tool:a.tool||a.name,parameters:a.parameters||a.arguments||a.args||a,rawSnippet:o[0]});continue}}}catch{try{let a=S(i),s=JSON.parse(a);if(typeof s==="object"&&s!==null&&(s.tool||s.name))e.push({tool:s.tool||s.name,parameters:s.parameters||s.arguments||s.args||s,rawSnippet:o[0]})}catch{}}}let n=/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;while((o=n.exec(t))!==null){let i=o[1].trim();try{let a=S(i),s=JSON.parse(a);if(typeof s==="object"&&s!==null)e.push({tool:s.tool||s.name||"unknown",parameters:s.parameters||s.arguments||s.args||s,rawSnippet:o[0]})}catch{}}return e}function L(t,e){if(!e||e.length===0)return t;let r=new Set(e.map((o)=>o.trim().toLowerCase()));return t.filter((o)=>r.has(o.tool.trim().toLowerCase()))}class y{fileReadCounts=new Map;failedEditCounts=new Map;recordToolExecution(t,e,r,o){if(!o.has(t)&&t!=="sh")return{type:"hallucinated_tool",target:t,count:1,suggestion:`Tool '${t}' does not exist. Use available tools or run commands via 'sh'.`};if(t==="read"&&e?.path){let n=String(e.path),i=(this.fileReadCounts.get(n)||0)+1;if(this.fileReadCounts.set(n,i),i>=3)return{type:"read_loop",target:n,count:i,suggestion:`File '${n}' has been read ${i} times without modification. Use 'outline' or proceed to edit.`}}if((t==="edit"||t==="write")&&e?.path)this.fileReadCounts.delete(String(e.path));if(t==="edit"&&r){let n=String(e?.path||e?.edits?.[0]?.path||"unknown"),i=(this.failedEditCounts.get(n)||0)+1;if(this.failedEditCounts.set(n,i),i>=2)return{type:"patch_spiral",target:n,count:i,suggestion:`Repeated failed edits on '${n}' (${i} failures). Use fresh 'read' with line anchors or review the file outline.`}}else if(t==="edit"&&!r){let n=String(e?.path||e?.edits?.[0]?.path||"unknown");this.failedEditCounts.delete(n)}return null}reset(){this.fileReadCounts.clear(),this.failedEditCounts.clear()}}function Y(t=process.env){let e=t.LITTLE_CODER_MAX_TURNS?parseInt(t.LITTLE_CODER_MAX_TURNS,10):NaN,r=!isNaN(e)&&e>0?e:40,o=t.LITTLE_CODER_WARN_REMAINING?parseInt(t.LITTLE_CODER_WARN_REMAINING,10):NaN,n=!isNaN(o)&&o>0?o:5;return{maxTurns:r,warnRemaining:n}}class w{warned=!1;config;constructor(t){this.config=t??Y()}reset(){this.warned=!1}evaluateTurn(t){let e=t+1;if(e>=this.config.maxTurns)return{action:"abort",turnIndex:e,maxTurns:this.config.maxTurns,message:`Safety turn cap reached (${e}/${this.config.maxTurns} turns). Halting execution to prevent runaway loop.`};let r=this.config.maxTurns-e;if(r<=this.config.warnRemaining&&!this.warned)return this.warned=!0,{action:"warn",remaining:r,message:`Warning: Only ${r} turn${r===1?"":"s"} remaining before budget exhaustion (${e}/${this.config.maxTurns}). Finalize current work and verify now.`};return{action:"continue"}}}import{resolve as v}from"path";class T{readFiles=new Set;reset(){this.readFiles.clear()}recordAccess(t,e=process.cwd()){if(!t||typeof t!=="string")return;let r=v(e,t);this.readFiles.add(r)}hasRead(t,e=process.cwd()){if(!t||typeof t!=="string")return!1;let r=v(e,t);return this.readFiles.has(r)}checkEdit(t,e=process.cwd()){if(!t||typeof t!=="string")return{allowed:!0};let r=v(e,t);if(!this.readFiles.has(r))return{allowed:!1,reason:`File must be read first before edit \u2014 ${t} has not been read in this session.

Read ${t} first to inspect the exact line anchors and surrounding context, then apply the edit. Do not guess file contents.`};return{allowed:!0}}}function Z(t){let e=new y,r=new w,o=new T;t.on("turn_start",async(n,i)=>{try{let a=n?.turnIndex??0,s=r.evaluateTurn(a);if(s.action==="warn"){if(i?.ui?.notify?.(s.message,"warning"),typeof t.sendUserMessage==="function")t.sendUserMessage(`[SYSTEM WARNING] ${s.message}
Please conclude current edits, run verifications, and provide your final answer now.`)}else if(s.action==="abort"){if(i?.ui?.notify?.(s.message,"error"),typeof i?.abort==="function")i.abort()}}catch{}}),t.on("tool_call",async(n,i)=>{try{let a=n?.toolName,s=n?.input;if(a==="write"&&s?.path){let l=x(s.path,i?.cwd||process.cwd(),!0,Boolean(s.overwrite));if(!l.allowed)return i?.ui?.notify?.(l.reason||"Write blocked by write-guard","warning"),{block:!0,reason:l.reason}}if(a==="edit"){let l=s?.path||s?.file_path||Array.isArray(s?.edits)&&s.edits[0]?.path;if(typeof l==="string"){let d=o.checkEdit(l,i?.cwd||process.cwd());if(!d.allowed)return i?.ui?.notify?.("Edit blocked: File must be read first","warning"),{block:!0,reason:d.reason}}}}catch{}}),t.on("tool_result",async(n,i)=>{try{let a=n?.toolName,s=n?.result,l=n?.input;if(!Boolean(n?.isError)){if(a==="read"&&l?.path)o.recordAccess(l.path,i?.cwd||process.cwd());else if(a==="write"&&l?.path)o.recordAccess(l.path,i?.cwd||process.cwd());else if(a==="edit"){let c=l?.path||l?.file_path||Array.isArray(l?.edits)&&l.edits[0]?.path;if(typeof c==="string")o.recordAccess(c,i?.cwd||process.cwd())}}if(s&&Array.isArray(s.content)){for(let c of s.content)if(c.type==="text"&&typeof c.text==="string"){let C=R(c.text);if(C.truncated)c.text=C.text,i?.ui?.notify?.("Output truncated by read-guard","info")}}let u=typeof t.getActiveTools==="function"?new Set(t.getActiveTools()):new Set(["basic-tools","sh","shell","read","edit","write","grep","find","ls","ast_search","outline","repo_map","scratchpad","session","schedule","goal","grove_search","passive_ui","context_watchdog","revert_file"]);u.add("basic-tools"),u.add("sh"),u.add("shell"),u.add("grove_search");let f=e.recordToolExecution(a,n?.input,Boolean(n?.isError),u);if(f)i?.ui?.notify?.(`[Quality Warning] ${f.suggestion}`,"warning")}catch{}}),t.on("turn_end",async(n,i)=>{try{let a=n?.message;if(a?.role==="assistant"){let s=typeof a.content==="string"?a.content:Array.isArray(a.content)?a.content.map((d)=>d.text||"").join(`
`):"",l=k(s);if(l.length>0){let d;try{let f=i?.getAllTools?.();if(Array.isArray(f))d=f.map((c)=>String(c?.name??"")).filter(Boolean)}catch{d=void 0}let u=L(l,d);if(u.length>0){let c=`Notice: Fenced tool call detected in text for '${u[0].tool}'. Please invoke tools natively.`;i?.ui?.notify?.(c,"warning")}}}}catch{}}),t.on("session_start",async()=>{e.reset(),r.reset(),o.reset()}),t.on("before_agent_start",async()=>{r.reset()})}export{Z as default};
