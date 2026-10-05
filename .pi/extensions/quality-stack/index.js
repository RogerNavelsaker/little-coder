// @bun
import{existsSync as N,statSync as D}from"fs";import{resolve as G,basename as W}from"path";var R=new Set(["con","prn","aux","nul","com1","com2","com3","com4","com5","com6","com7","com8","com9","lpt1","lpt2","lpt3","lpt4","lpt5","lpt6","lpt7","lpt8","lpt9"]);function _(t,e=process.cwd(),i=!0,o=!1){if(!t||typeof t!=="string")return{allowed:!1,normalizedPath:"",reason:"Missing or invalid target path"};let s=G(e,t),r=W(s).toLowerCase(),n=r.split(".")[0];if(R.has(n)||R.has(r))return{allowed:!1,normalizedPath:s,reason:`Blocked reserved device filename: '${r}'`};if(s==="/"||s===e)return{allowed:!1,normalizedPath:s,reason:"Cannot overwrite root directory as a file"};if(i&&!o){if(N(s))try{if(D(s).isFile())return{allowed:!1,normalizedPath:s,suggestEdit:!0,reason:`File '${t}' already exists. Refusing full file overwrite. Use 'edit' with linehash anchors instead, or set overwrite=true.`}}catch{}}return{allowed:!0,normalizedPath:s}}import{mkdirSync as j,writeFileSync as U}from"fs";import{join as F}from"path";import{createHash as H}from"crypto";var B={maxLines:800,maxChars:40000,overflowDir:"/tmp/little-coder/overflow"};function E(t,e=B){if(!t||typeof t!=="string")return{truncated:!1,text:t,originalLines:0,originalChars:0};let i=t.split(`
`),o=i.length,s=t.length;if(o<=e.maxLines&&s<=e.maxChars)return{truncated:!1,text:t,originalLines:o,originalChars:s};let r,n=e.overflowDir||"/tmp/little-coder/overflow";try{j(n,{recursive:!0});let c=H("sha256").update(t).digest("hex").slice(0,12);r=F(n,`overflow-${Date.now()}-${c}.txt`),U(r,t,"utf-8")}catch{}let a=i.slice(0,30),l=r?`

[Context Cutoff Notice: Output exceeded inline budget (${o} lines / ${Math.round(s/1024)}KB). Full payload spooled to disk at: ${r}]
Options:
1. Search: run \`rg '<pattern>' ${r}\` via \`sh\`
2. Slice: read targeted lines via \`read\` with offset/limit
3. Sub-Agent: delegate summarization using an isolated sub-agent or \`sh\` pipeline`:`

... [Read Guard: Truncated ${o-30} lines / ${s} chars. Use 'outline' or read specific line slices: lines:N-M]`;return{truncated:!0,text:a.join(`
`)+l,originalLines:o,originalChars:s,spillPath:r}}import{mkdirSync as V,writeFileSync as J}from"fs";import{join as z}from"path";import{createHash as K}from"crypto";var Q={maxLines:500,maxChars:20000,headLines:30,tailLines:30,overflowDir:"/tmp/little-coder/overflow"};function M(t,e=Q){if(!t||typeof t!=="string")return{truncated:!1,text:t,originalLines:0,originalChars:0};let i=t.split(`
`),o=i.length,s=t.length;if(o<=e.maxLines&&s<=e.maxChars)return{truncated:!1,text:t,originalLines:o,originalChars:s};let r,n=e.overflowDir||"/tmp/little-coder/overflow";try{V(n,{recursive:!0});let p=K("sha256").update(t).digest("hex").slice(0,12);r=z(n,`stdout-${Date.now()}-${p}.txt`),J(r,t,"utf-8")}catch{}let a=i.slice(0,e.headLines),l=i.slice(-e.tailLines),c=o-(e.headLines+e.tailLines),d=r?`

... [Output Machete: Truncated ${c>0?c:0} intermediate lines (${Math.round(s/1024)}KB total). Full output spooled to: ${r}]
Recovery options:
`+`\u2022 Search: \`rg '<pattern>' ${r}\` via \`sh\`
`+`\u2022 Tail / Head: \`tail -n 50 ${r}\` or \`head -n 50 ${r}\`
`+`\u2022 Summarize: delegate analysis to a sub-agent or targeted pipeline ...

`:`

... [Output Machete: Truncated ${c} lines / ${s} chars] ...

`;return{truncated:!0,text:a.join(`
`)+d+l.join(`
`),originalLines:o,originalChars:s,spillPath:r}}import{readFileSync as X,writeFileSync as q,existsSync as g}from"fs";import{dirname as A,join as m}from"path";import{fileURLToPath as S}from"url";var O="@earendil-works/pi-coding-agent",Y={rel:"dist/modes/interactive/components/assistant-message.js",applied:'little-coder patch: suppress the bare "Operation aborted" marker',find:`                const abortMessage = message.errorMessage && message.errorMessage !== "Request was aborted"
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
                }`},Z={rel:"node_modules/@earendil-works/pi-tui/dist/components/box.js",applied:"little-coder patch: check child.render function existence in box component",find:`        // Render all children
        const childLines = [];
        for (const child of this.children) {
            const lines = child.render(contentWidth);`,replace:`        // Render all children
        // little-coder patch: check child.render function existence in box component
        const childLines = [];
        for (const child of this.children) {
            if (!child || typeof child.render !== "function") continue;
            const lines = child.render(contentWidth);`},ee={rel:"dist/modes/interactive/components/tool-execution.js",applied:"little-coder patch: suppress blank spacer lines for grouped tools",find:`    render(width) {
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
    }`},te={rel:"dist/modes/interactive/components/tool-execution.js",applied:"little-coder patch: toolDefinitionOverrides for third-party rendering",find:`    getCallRenderer() {
        if (!this.builtInToolDefinition) {
            return this.toolDefinition?.renderCall;
        }`,replace:`    // little-coder patch: toolDefinitionOverrides for third-party rendering
    getCallRenderer() {
        const override = globalThis.__littleCoderToolOverrides?.get(this.toolName);
        if (override?.renderCall) return override.renderCall;
        if (!this.builtInToolDefinition) {
            return this.toolDefinition?.renderCall;
        }`},ne={rel:"dist/modes/interactive/components/tool-execution.js",applied:"little-coder patch: neutral tool card background (codex/agy style)",find:`    updateDisplay() {
        const bgFn = this.isPartial
            ? (text) => theme.bg("toolPendingBg", text)
            : this.result?.isError
                ? (text) => theme.bg("toolErrorBg", text)
                : (text) => theme.bg("toolSuccessBg", text);`,replace:`    // little-coder patch: neutral tool card background (codex/agy style)
    updateDisplay() {
        const bgFn = (text) => text;`};function w(t){let e="",i=!1,o=!1;for(let s of t){if(o){e+=s,o=!1;continue}if(s==="\\"){e+=s,o=!0;continue}if(s==='"'){i=!i,e+=s;continue}if(i){if(s===`
`){e+="\\n";continue}if(s==="\r"){e+="\\r";continue}if(s==="\t"){e+="\\t";continue}}e+=s}return e}var L="little-coder patch: repair raw control chars in a JSON-string `edits`";function re(t){let e=" ".repeat(t);return`catch {
${e}    // ${L} (issue #127).
${e}    // Small local models emit literal newlines inside oldText/newText;
${e}    // JSON.parse rejects those as "Bad control character in string
${e}    // literal", and the original empty catch left \`edits\` a string for
${e}    // schema validation to refuse. With write refused for an existing
${e}    // file, that left the model no way to deliver a patch at all.
${e}    try {
${e}        const repair = ${String(w).split(`
`).join(`
${e}        `)};
${e}        const repaired = JSON.parse(repair(args.edits));
${e}        if (Array.isArray(repaired))
${e}            args.edits = repaired;
${e}    }
${e}    catch { }
${e}}`}var ie={rel:"dist/core/tools/edit.js",applied:L,find:`            if (Array.isArray(parsed))
                args.edits = parsed;
        }
        catch { }
    }
    const legacy = args;`,replace:`            if (Array.isArray(parsed))
                args.edits = parsed;
        }
        `+re(8)+`
    }
    const legacy = args;`},oe={rel:"dist/core/auth-storage.js",applied:"little-coder patch: verify oauth provider exists in hasAuth",find:`    hasAuth(provider) {
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
        }`},se={rel:"dist/core/model-resolver.js",applied:"little-coder patch: reject empty pattern in tryMatchModel",find:`function tryMatchModel(modelPattern, availableModels) {
    const exactMatch = findExactModelReferenceMatch(modelPattern, availableModels);`,replace:`function tryMatchModel(modelPattern, availableModels) {
    // little-coder patch: reject empty pattern in tryMatchModel
    if (!modelPattern || modelPattern.trim().length === 0) {
        return undefined;
    }
    const exactMatch = findExactModelReferenceMatch(modelPattern, availableModels);`},ae={rel:"dist/core/model-resolver.js",applied:"little-coder patch: verify auth on settings default model in findInitialModel",find:`    // 3. Try saved default from settings
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
    }`},le={rel:"node_modules/@earendil-works/pi-agent-core/dist/agent.js",applied:"little-coder patch: guard processEvents listener invocation on late events after run finish",find:`        const signal = this.activeRun?.abortController.signal;
        if (!signal) {
            throw new Error("Agent listener invoked outside active run");
        }`,replace:`        const signal = this.activeRun?.abortController.signal;
        if (!signal) {
            // little-coder patch: guard processEvents listener invocation on late events after run finish
            return;
        }`},ce=[Y,Z,ee,te,ne,ie,oe,se,ae,le];function de(t){if(t&&g(m(t,"package.json")))return t;try{let e=Bun.resolveSync(`${O}/package.json`,import.meta.dir);return A(e)}catch{}try{let e=A(S(import.meta.url)),i=m(e,"..","node_modules",...O.split("/"));if(g(m(i,"package.json")))return i}catch{}return null}function ue(t){let e=de(t);if(!e)return;for(let i of ce)try{let o=m(e,i.rel);if(!g(o)){let r=m(e,"..",i.rel.replace(/^node_modules\/@earendil-works\//,""));if(g(r))o=r}if(!g(o))continue;let s=X(o,"utf8");if(s.includes(i.applied))continue;if(!s.includes(i.find))continue;q(o,s.replace(i.find,i.replace))}catch{}}var y=!1;try{y=process.argv[1]!=null&&S(import.meta.url)===process.argv[1]}catch{y=!1}if(y)ue();function P(t){let e=t.trim();e=w(e),e=e.replace(/,(\s*[}\]])/g,"$1"),e=e.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g,'"$1"');let i=(e.match(/\{/g)||[]).length,o=(e.match(/\}/g)||[]).length;if(i>o)e+="}".repeat(i-o);let s=(e.match(/\[/g)||[]).length,r=(e.match(/\]/g)||[]).length;if(s>r)e+="]".repeat(s-r);return e}function k(t){if(!t||typeof t!=="string")return[];let e=[],i=/```(?:json|tool)?\s*([\s\S]*?)```/g,o;while((o=i.exec(t))!==null){let r=o[1].trim();if(!r.startsWith("{")&&!r.startsWith("["))continue;try{let n=JSON.parse(r);if(typeof n==="object"&&n!==null){if(n.tool||n.name){e.push({tool:n.tool||n.name,parameters:n.parameters||n.arguments||n.args||n,rawSnippet:o[0]});continue}}}catch{try{let n=P(r),a=JSON.parse(n);if(typeof a==="object"&&a!==null&&(a.tool||a.name))e.push({tool:a.tool||a.name,parameters:a.parameters||a.arguments||a.args||a,rawSnippet:o[0]})}catch{}}}let s=/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;while((o=s.exec(t))!==null){let r=o[1].trim();try{let n=P(r),a=JSON.parse(n);if(typeof a==="object"&&a!==null)e.push({tool:a.tool||a.name||"unknown",parameters:a.parameters||a.arguments||a.args||a,rawSnippet:o[0]})}catch{}}return e}function I(t,e){if(!e||e.length===0)return t;let i=new Set(e.map((o)=>o.trim().toLowerCase()));return t.filter((o)=>i.has(o.tool.trim().toLowerCase()))}import{statSync as fe}from"fs";import{resolve as pe}from"path";class v{fileReadCounts=new Map;fileMtimes=new Map;failedEditCounts=new Map;recordToolExecution(t,e,i,o,s=process.cwd()){if(!o.has(t)&&t!=="sh")return{type:"hallucinated_tool",target:t,count:1,suggestion:`Tool '${t}' does not exist. Use available tools or run commands via 'sh'.`};if(t==="read"){let r=[];if(e?.path)r.push(String(e.path));else if(Array.isArray(e?.files)){for(let n of e.files)if(n?.path)r.push(String(n.path))}for(let n of r){let a=pe(s,n),l;try{l=fe(a).mtimeMs}catch{}let c=this.fileMtimes.get(n);if(l!==void 0&&c!==void 0&&l>c){this.fileReadCounts.set(n,1),this.fileMtimes.set(n,l);continue}if(l!==void 0)this.fileMtimes.set(n,l);let d=(this.fileReadCounts.get(n)||0)+1;if(this.fileReadCounts.set(n,d),d>=3)return{type:"read_loop",target:n,count:d,suggestion:`File '${n}' has been read ${d} times without modification. Rely on existing context or use 'outline'/'ast_search' instead of re-reading.`}}}if(t==="edit"||t==="write"){let r=e?.path||Array.isArray(e?.edits)&&e.edits[0]?.path;if(r)this.fileReadCounts.delete(String(r))}if(t==="edit"&&i){let r=String(e?.path||e?.edits?.[0]?.path||"unknown"),n=(this.failedEditCounts.get(r)||0)+1;if(this.failedEditCounts.set(r,n),n>=2)return{type:"patch_spiral",target:r,count:n,suggestion:`Repeated failed edits on '${r}' (${n} failures). Use fresh 'read' with line anchors or review the file outline.`}}else if(t==="edit"&&!i){let r=String(e?.path||e?.edits?.[0]?.path||"unknown");this.failedEditCounts.delete(r)}return null}reset(){this.fileReadCounts.clear(),this.fileMtimes.clear(),this.failedEditCounts.clear()}}function he(t=process.env){let e=t.LITTLE_CODER_MAX_TURNS?parseInt(t.LITTLE_CODER_MAX_TURNS,10):NaN,i=!isNaN(e)&&e>0?e:40,o=t.LITTLE_CODER_WARN_REMAINING?parseInt(t.LITTLE_CODER_WARN_REMAINING,10):NaN,s=!isNaN(o)&&o>0?o:5;return{maxTurns:i,warnRemaining:s}}class T{warned=!1;config;constructor(t){this.config=t??he()}reset(){this.warned=!1}evaluateTurn(t){let e=t+1;if(e>=this.config.maxTurns)return{action:"abort",turnIndex:e,maxTurns:this.config.maxTurns,message:`Safety turn cap reached (${e}/${this.config.maxTurns} turns). Halting execution to prevent runaway loop.`};let i=this.config.maxTurns-e;if(i<=this.config.warnRemaining&&!this.warned)return this.warned=!0,{action:"warn",remaining:i,message:`Warning: Only ${i} turn${i===1?"":"s"} remaining before budget exhaustion (${e}/${this.config.maxTurns}). Finalize current work and verify now.`};return{action:"continue"}}}function ge(t=process.env){let e=t.LITTLE_CODER_GOVERNOR_MAX_TURNS?parseInt(t.LITTLE_CODER_GOVERNOR_MAX_TURNS,10):15,i=t.LITTLE_CODER_GOVERNOR_WINDOW_MS?parseInt(t.LITTLE_CODER_GOVERNOR_WINDOW_MS,10):120000,o=t.LITTLE_CODER_GOVERNOR_COOLDOWN_MS?parseInt(t.LITTLE_CODER_GOVERNOR_COOLDOWN_MS,10):30000;return{maxTurnsPerWindow:isNaN(e)||e<=0?15:e,windowMs:isNaN(i)||i<=0?120000:i,cooldownMs:isNaN(o)||o<=0?30000:o}}class x{turnTimestamps=[];lastThrottleUntil=0;config;constructor(t){this.config=t??ge()}reset(){this.turnTimestamps=[],this.lastThrottleUntil=0}evaluateTurn(t=Date.now()){if(t<this.lastThrottleUntil){let i=this.lastThrottleUntil-t;return{action:"throttle",waitMs:i,turnsInWindow:this.turnTimestamps.length,message:`Turn velocity governor active: cooling down for ${Math.ceil(i/1000)}s to prevent runaway cascade.`}}let e=t-this.config.windowMs;if(this.turnTimestamps=this.turnTimestamps.filter((i)=>i>=e),this.turnTimestamps.push(t),this.turnTimestamps.length>this.config.maxTurnsPerWindow)return this.lastThrottleUntil=t+this.config.cooldownMs,this.turnTimestamps=[],{action:"throttle",waitMs:this.config.cooldownMs,turnsInWindow:this.config.maxTurnsPerWindow+1,message:`Turn velocity governor tripped: limit of ${this.config.maxTurnsPerWindow} turns per ${Math.round(this.config.windowMs/1000)}s exceeded. Pausing for ${Math.round(this.config.cooldownMs/1000)}s cooldown.`};return{action:"allow"}}}import{resolve as C}from"path";class b{readFiles=new Set;reset(){this.readFiles.clear()}recordAccess(t,e=process.cwd()){if(!t||typeof t!=="string")return;let i=C(e,t);this.readFiles.add(i)}hasRead(t,e=process.cwd()){if(!t||typeof t!=="string")return!1;let i=C(e,t);return this.readFiles.has(i)}checkEdit(t,e=process.cwd()){if(!t||typeof t!=="string")return{allowed:!0};let i=C(e,t);if(!this.readFiles.has(i))return{allowed:!1,reason:`File must be read first before edit \u2014 ${t} has not been read in this session.

Read ${t} first to inspect the exact line anchors and surrounding context, then apply the edit. Do not guess file contents.`};return{allowed:!0}}}function me(t){let e=new v,i=new T,o=new x,s=new b;t.on("turn_start",async(r,n)=>{try{let a=r?.turnIndex??0,l=i.evaluateTurn(a);if(l.action==="warn"){if(n?.ui?.notify?.(l.message,"warning"),typeof t.sendUserMessage==="function")t.sendUserMessage(`[SYSTEM WARNING] ${l.message}
Please conclude current edits, run verifications, and provide your final answer now.`,{deliverAs:"steer"})}else if(l.action==="abort"){if(n?.ui?.notify?.(l.message,"error"),typeof n?.abort==="function")n.abort();return}let c=o.evaluateTurn();if(c.action==="throttle"){if(n?.ui?.notify?.(c.message,"warning"),typeof t.sendUserMessage==="function")t.sendUserMessage(`[GOVERNOR CIRCUIT BREAKER] ${c.message}
Take a deliberate pause before the next action.`,{deliverAs:"steer"})}}catch{}}),t.on("tool_call",async(r,n)=>{try{let a=r?.toolName,l=r?.input;if(a==="write"&&l?.path){let c=_(l.path,n?.cwd||process.cwd(),!0,Boolean(l.overwrite));if(!c.allowed)return n?.ui?.notify?.(c.reason||"Write blocked by write-guard","warning"),{block:!0,reason:c.reason}}if(a==="edit"){let c=l?.path||l?.file_path||Array.isArray(l?.edits)&&l.edits[0]?.path;if(typeof c==="string"){let d=s.checkEdit(c,n?.cwd||process.cwd());if(!d.allowed)return n?.ui?.notify?.("Edit blocked: File must be read first","warning"),{block:!0,reason:d.reason}}}}catch{}}),t.on("tool_result",async(r,n)=>{try{let a=r?.toolName,l=r?.result,c=r?.input;if(!Boolean(r?.isError)){if(a==="read"&&c?.path)s.recordAccess(c.path,n?.cwd||process.cwd());else if(a==="write"&&c?.path)s.recordAccess(c.path,n?.cwd||process.cwd());else if(a==="edit"){let u=c?.path||c?.file_path||Array.isArray(c?.edits)&&c.edits[0]?.path;if(typeof u==="string")s.recordAccess(u,n?.cwd||process.cwd())}}if(l&&Array.isArray(l.content)){for(let u of l.content)if(u.type==="text"&&typeof u.text==="string")if(a==="sh"||a==="shell"){let h=M(u.text);if(h.truncated)u.text=h.text,n?.ui?.notify?.("Shell output truncated by output-machete","info")}else{let h=E(u.text);if(h.truncated)u.text=h.text,n?.ui?.notify?.("Output truncated by read-guard","info")}}let f=typeof t.getActiveTools==="function"?new Set(t.getActiveTools()):new Set(["basic-tools","sh","shell","read","edit","write","grep","find","ls","ast_search","outline","repo_map","scratchpad","session","schedule","goal","grove_search","passive_ui","context_watchdog","revert_file"]);f.add("basic-tools"),f.add("sh"),f.add("shell"),f.add("grove_search");let p=e.recordToolExecution(a,r?.input,Boolean(r?.isError),f,n?.cwd||process.cwd());if(p){if(n?.ui?.notify?.(`[Quality Warning] ${p.suggestion}`,"warning"),l&&Array.isArray(l.content))l.content.push({type:"text",text:`
[Quality Guidance: ${p.suggestion}]`})}}catch{}}),t.on("turn_end",async(r,n)=>{try{let a=r?.message;if(a?.role==="assistant"){let l=typeof a.content==="string"?a.content:Array.isArray(a.content)?a.content.map((d)=>d.text||"").join(`
`):"",c=k(l);if(c.length>0){let d;try{let p=n?.getAllTools?.();if(Array.isArray(p))d=p.map((u)=>String(u?.name??"")).filter(Boolean)}catch{d=void 0}let f=I(c,d);if(f.length>0){let u=`Notice: Fenced tool call detected in text for '${f[0].tool}'. Please invoke tools natively.`;n?.ui?.notify?.(u,"warning")}}}}catch{}}),t.on("session_start",async()=>{e.reset(),i.reset(),o.reset(),s.reset()}),t.on("session_compact",async()=>{e.reset(),o.reset()}),t.on("before_agent_start",async()=>{i.reset(),o.reset()})}export{me as default};
