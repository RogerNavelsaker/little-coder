// @bun
var __defProp = Object.defineProperty;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};
var __require = import.meta.require;

// node_modules/@sinclair/typebox/build/esm/type/guard/value.mjs
function IsAsyncIterator(value) {
  return IsObject(value) && !IsArray(value) && !IsUint8Array(value) && Symbol.asyncIterator in value;
}
function IsArray(value) {
  return Array.isArray(value);
}
function IsBigInt(value) {
  return typeof value === "bigint";
}
function IsBoolean(value) {
  return typeof value === "boolean";
}
function IsDate(value) {
  return value instanceof globalThis.Date;
}
function IsFunction(value) {
  return typeof value === "function";
}
function IsIterator(value) {
  return IsObject(value) && !IsArray(value) && !IsUint8Array(value) && Symbol.iterator in value;
}
function IsNull(value) {
  return value === null;
}
function IsNumber(value) {
  return typeof value === "number";
}
function IsObject(value) {
  return typeof value === "object" && value !== null;
}
function IsRegExp(value) {
  return value instanceof globalThis.RegExp;
}
function IsString(value) {
  return typeof value === "string";
}
function IsSymbol(value) {
  return typeof value === "symbol";
}
function IsUint8Array(value) {
  return value instanceof globalThis.Uint8Array;
}
function IsUndefined(value) {
  return value === undefined;
}

// node_modules/@sinclair/typebox/build/esm/type/clone/value.mjs
function ArrayType(value) {
  return value.map((value) => Visit(value));
}
function DateType(value) {
  return new Date(value.getTime());
}
function Uint8ArrayType(value) {
  return new Uint8Array(value);
}
function RegExpType(value) {
  return new RegExp(value.source, value.flags);
}
function ObjectType(value) {
  const result = {};
  for (const key of Object.getOwnPropertyNames(value)) {
    result[key] = Visit(value[key]);
  }
  for (const key of Object.getOwnPropertySymbols(value)) {
    result[key] = Visit(value[key]);
  }
  return result;
}
function Visit(value) {
  return IsArray(value) ? ArrayType(value) : IsDate(value) ? DateType(value) : IsUint8Array(value) ? Uint8ArrayType(value) : IsRegExp(value) ? RegExpType(value) : IsObject(value) ? ObjectType(value) : value;
}
function Clone(value) {
  return Visit(value);
}

// node_modules/@sinclair/typebox/build/esm/type/clone/type.mjs
function CloneType(schema, options) {
  return options === undefined ? Clone(schema) : Clone({ ...options, ...schema });
}

// node_modules/@sinclair/typebox/build/esm/value/guard/guard.mjs
function IsObject2(value) {
  return value !== null && typeof value === "object";
}
function IsArray2(value) {
  return globalThis.Array.isArray(value) && !globalThis.ArrayBuffer.isView(value);
}
function IsUndefined2(value) {
  return value === undefined;
}
function IsNumber2(value) {
  return typeof value === "number";
}

// node_modules/@sinclair/typebox/build/esm/system/policy.mjs
var TypeSystemPolicy;
(function(TypeSystemPolicy) {
  TypeSystemPolicy.InstanceMode = "default";
  TypeSystemPolicy.ExactOptionalPropertyTypes = false;
  TypeSystemPolicy.AllowArrayObject = false;
  TypeSystemPolicy.AllowNaN = false;
  TypeSystemPolicy.AllowNullVoid = false;
  function IsExactOptionalProperty(value, key) {
    return TypeSystemPolicy.ExactOptionalPropertyTypes ? key in value : value[key] !== undefined;
  }
  TypeSystemPolicy.IsExactOptionalProperty = IsExactOptionalProperty;
  function IsObjectLike(value) {
    const isObject = IsObject2(value);
    return TypeSystemPolicy.AllowArrayObject ? isObject : isObject && !IsArray2(value);
  }
  TypeSystemPolicy.IsObjectLike = IsObjectLike;
  function IsRecordLike(value) {
    return IsObjectLike(value) && !(value instanceof Date) && !(value instanceof Uint8Array);
  }
  TypeSystemPolicy.IsRecordLike = IsRecordLike;
  function IsNumberLike(value) {
    return TypeSystemPolicy.AllowNaN ? IsNumber2(value) : Number.isFinite(value);
  }
  TypeSystemPolicy.IsNumberLike = IsNumberLike;
  function IsVoidLike(value) {
    const isUndefined = IsUndefined2(value);
    return TypeSystemPolicy.AllowNullVoid ? isUndefined || value === null : isUndefined;
  }
  TypeSystemPolicy.IsVoidLike = IsVoidLike;
})(TypeSystemPolicy || (TypeSystemPolicy = {}));

// node_modules/@sinclair/typebox/build/esm/type/create/immutable.mjs
function ImmutableArray(value) {
  return globalThis.Object.freeze(value).map((value) => Immutable(value));
}
function ImmutableDate(value) {
  return value;
}
function ImmutableUint8Array(value) {
  return value;
}
function ImmutableRegExp(value) {
  return value;
}
function ImmutableObject(value) {
  const result = {};
  for (const key of Object.getOwnPropertyNames(value)) {
    result[key] = Immutable(value[key]);
  }
  for (const key of Object.getOwnPropertySymbols(value)) {
    result[key] = Immutable(value[key]);
  }
  return globalThis.Object.freeze(result);
}
function Immutable(value) {
  return IsArray(value) ? ImmutableArray(value) : IsDate(value) ? ImmutableDate(value) : IsUint8Array(value) ? ImmutableUint8Array(value) : IsRegExp(value) ? ImmutableRegExp(value) : IsObject(value) ? ImmutableObject(value) : value;
}

// node_modules/@sinclair/typebox/build/esm/type/create/type.mjs
function CreateType(schema, options) {
  const result = options !== undefined ? { ...options, ...schema } : schema;
  switch (TypeSystemPolicy.InstanceMode) {
    case "freeze":
      return Immutable(result);
    case "clone":
      return Clone(result);
    default:
      return result;
  }
}

// node_modules/@sinclair/typebox/build/esm/type/error/error.mjs
class TypeBoxError extends Error {
  constructor(message) {
    super(message);
  }
}

// node_modules/@sinclair/typebox/build/esm/type/symbols/symbols.mjs
var TransformKind = Symbol.for("TypeBox.Transform");
var ReadonlyKind = Symbol.for("TypeBox.Readonly");
var OptionalKind = Symbol.for("TypeBox.Optional");
var Hint = Symbol.for("TypeBox.Hint");
var Kind = Symbol.for("TypeBox.Kind");

// node_modules/@sinclair/typebox/build/esm/type/guard/kind.mjs
function IsReadonly(value) {
  return IsObject(value) && value[ReadonlyKind] === "Readonly";
}
function IsOptional(value) {
  return IsObject(value) && value[OptionalKind] === "Optional";
}
function IsAny(value) {
  return IsKindOf(value, "Any");
}
function IsArgument(value) {
  return IsKindOf(value, "Argument");
}
function IsArray3(value) {
  return IsKindOf(value, "Array");
}
function IsAsyncIterator2(value) {
  return IsKindOf(value, "AsyncIterator");
}
function IsBigInt2(value) {
  return IsKindOf(value, "BigInt");
}
function IsBoolean2(value) {
  return IsKindOf(value, "Boolean");
}
function IsComputed(value) {
  return IsKindOf(value, "Computed");
}
function IsConstructor(value) {
  return IsKindOf(value, "Constructor");
}
function IsDate2(value) {
  return IsKindOf(value, "Date");
}
function IsFunction2(value) {
  return IsKindOf(value, "Function");
}
function IsInteger(value) {
  return IsKindOf(value, "Integer");
}
function IsIntersect(value) {
  return IsKindOf(value, "Intersect");
}
function IsIterator2(value) {
  return IsKindOf(value, "Iterator");
}
function IsKindOf(value, kind) {
  return IsObject(value) && Kind in value && value[Kind] === kind;
}
function IsLiteralValue(value) {
  return IsBoolean(value) || IsNumber(value) || IsString(value);
}
function IsLiteral(value) {
  return IsKindOf(value, "Literal");
}
function IsMappedKey(value) {
  return IsKindOf(value, "MappedKey");
}
function IsMappedResult(value) {
  return IsKindOf(value, "MappedResult");
}
function IsNever(value) {
  return IsKindOf(value, "Never");
}
function IsNot(value) {
  return IsKindOf(value, "Not");
}
function IsNull2(value) {
  return IsKindOf(value, "Null");
}
function IsNumber3(value) {
  return IsKindOf(value, "Number");
}
function IsObject3(value) {
  return IsKindOf(value, "Object");
}
function IsPromise(value) {
  return IsKindOf(value, "Promise");
}
function IsRecord(value) {
  return IsKindOf(value, "Record");
}
function IsRef(value) {
  return IsKindOf(value, "Ref");
}
function IsRegExp2(value) {
  return IsKindOf(value, "RegExp");
}
function IsString2(value) {
  return IsKindOf(value, "String");
}
function IsSymbol2(value) {
  return IsKindOf(value, "Symbol");
}
function IsTemplateLiteral(value) {
  return IsKindOf(value, "TemplateLiteral");
}
function IsThis(value) {
  return IsKindOf(value, "This");
}
function IsTransform(value) {
  return IsObject(value) && TransformKind in value;
}
function IsTuple(value) {
  return IsKindOf(value, "Tuple");
}
function IsUndefined3(value) {
  return IsKindOf(value, "Undefined");
}
function IsUnion(value) {
  return IsKindOf(value, "Union");
}
function IsUint8Array2(value) {
  return IsKindOf(value, "Uint8Array");
}
function IsUnknown(value) {
  return IsKindOf(value, "Unknown");
}
function IsUnsafe(value) {
  return IsKindOf(value, "Unsafe");
}
function IsVoid(value) {
  return IsKindOf(value, "Void");
}
function IsKind(value) {
  return IsObject(value) && Kind in value && IsString(value[Kind]);
}
function IsSchema(value) {
  return IsAny(value) || IsArgument(value) || IsArray3(value) || IsBoolean2(value) || IsBigInt2(value) || IsAsyncIterator2(value) || IsComputed(value) || IsConstructor(value) || IsDate2(value) || IsFunction2(value) || IsInteger(value) || IsIntersect(value) || IsIterator2(value) || IsLiteral(value) || IsMappedKey(value) || IsMappedResult(value) || IsNever(value) || IsNot(value) || IsNull2(value) || IsNumber3(value) || IsObject3(value) || IsPromise(value) || IsRecord(value) || IsRef(value) || IsRegExp2(value) || IsString2(value) || IsSymbol2(value) || IsTemplateLiteral(value) || IsThis(value) || IsTuple(value) || IsUndefined3(value) || IsUnion(value) || IsUint8Array2(value) || IsUnknown(value) || IsUnsafe(value) || IsVoid(value) || IsKind(value);
}
// node_modules/@sinclair/typebox/build/esm/type/guard/type.mjs
var KnownTypes = [
  "Argument",
  "Any",
  "Array",
  "AsyncIterator",
  "BigInt",
  "Boolean",
  "Computed",
  "Constructor",
  "Date",
  "Enum",
  "Function",
  "Integer",
  "Intersect",
  "Iterator",
  "Literal",
  "MappedKey",
  "MappedResult",
  "Not",
  "Null",
  "Number",
  "Object",
  "Promise",
  "Record",
  "Ref",
  "RegExp",
  "String",
  "Symbol",
  "TemplateLiteral",
  "This",
  "Tuple",
  "Undefined",
  "Union",
  "Uint8Array",
  "Unknown",
  "Void"
];
function IsPattern(value) {
  try {
    new RegExp(value);
    return true;
  } catch {
    return false;
  }
}
function IsControlCharacterFree(value) {
  if (!IsString(value))
    return false;
  for (let i = 0;i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 7 && code <= 13 || code === 27 || code === 127) {
      return false;
    }
  }
  return true;
}
function IsAdditionalProperties(value) {
  return IsOptionalBoolean(value) || IsSchema2(value);
}
function IsOptionalBigInt(value) {
  return IsUndefined(value) || IsBigInt(value);
}
function IsOptionalNumber(value) {
  return IsUndefined(value) || IsNumber(value);
}
function IsOptionalBoolean(value) {
  return IsUndefined(value) || IsBoolean(value);
}
function IsOptionalString(value) {
  return IsUndefined(value) || IsString(value);
}
function IsOptionalPattern(value) {
  return IsUndefined(value) || IsString(value) && IsControlCharacterFree(value) && IsPattern(value);
}
function IsOptionalFormat(value) {
  return IsUndefined(value) || IsString(value) && IsControlCharacterFree(value);
}
function IsOptionalSchema(value) {
  return IsUndefined(value) || IsSchema2(value);
}
function IsOptional2(value) {
  return IsObject(value) && value[OptionalKind] === "Optional";
}
function IsAny2(value) {
  return IsKindOf2(value, "Any") && IsOptionalString(value.$id);
}
function IsArgument2(value) {
  return IsKindOf2(value, "Argument") && IsNumber(value.index);
}
function IsArray4(value) {
  return IsKindOf2(value, "Array") && value.type === "array" && IsOptionalString(value.$id) && IsSchema2(value.items) && IsOptionalNumber(value.minItems) && IsOptionalNumber(value.maxItems) && IsOptionalBoolean(value.uniqueItems) && IsOptionalSchema(value.contains) && IsOptionalNumber(value.minContains) && IsOptionalNumber(value.maxContains);
}
function IsAsyncIterator3(value) {
  return IsKindOf2(value, "AsyncIterator") && value.type === "AsyncIterator" && IsOptionalString(value.$id) && IsSchema2(value.items);
}
function IsBigInt3(value) {
  return IsKindOf2(value, "BigInt") && value.type === "bigint" && IsOptionalString(value.$id) && IsOptionalBigInt(value.exclusiveMaximum) && IsOptionalBigInt(value.exclusiveMinimum) && IsOptionalBigInt(value.maximum) && IsOptionalBigInt(value.minimum) && IsOptionalBigInt(value.multipleOf);
}
function IsBoolean3(value) {
  return IsKindOf2(value, "Boolean") && value.type === "boolean" && IsOptionalString(value.$id);
}
function IsComputed2(value) {
  return IsKindOf2(value, "Computed") && IsString(value.target) && IsArray(value.parameters) && value.parameters.every((schema) => IsSchema2(schema));
}
function IsConstructor2(value) {
  return IsKindOf2(value, "Constructor") && value.type === "Constructor" && IsOptionalString(value.$id) && IsArray(value.parameters) && value.parameters.every((schema) => IsSchema2(schema)) && IsSchema2(value.returns);
}
function IsDate3(value) {
  return IsKindOf2(value, "Date") && value.type === "Date" && IsOptionalString(value.$id) && IsOptionalNumber(value.exclusiveMaximumTimestamp) && IsOptionalNumber(value.exclusiveMinimumTimestamp) && IsOptionalNumber(value.maximumTimestamp) && IsOptionalNumber(value.minimumTimestamp) && IsOptionalNumber(value.multipleOfTimestamp);
}
function IsFunction3(value) {
  return IsKindOf2(value, "Function") && value.type === "Function" && IsOptionalString(value.$id) && IsArray(value.parameters) && value.parameters.every((schema) => IsSchema2(schema)) && IsSchema2(value.returns);
}
function IsInteger2(value) {
  return IsKindOf2(value, "Integer") && value.type === "integer" && IsOptionalString(value.$id) && IsOptionalNumber(value.exclusiveMaximum) && IsOptionalNumber(value.exclusiveMinimum) && IsOptionalNumber(value.maximum) && IsOptionalNumber(value.minimum) && IsOptionalNumber(value.multipleOf);
}
function IsProperties(value) {
  return IsObject(value) && Object.entries(value).every(([key, schema]) => IsControlCharacterFree(key) && IsSchema2(schema));
}
function IsIntersect2(value) {
  return IsKindOf2(value, "Intersect") && (IsString(value.type) && value.type !== "object" ? false : true) && IsArray(value.allOf) && value.allOf.every((schema) => IsSchema2(schema) && !IsTransform2(schema)) && IsOptionalString(value.type) && (IsOptionalBoolean(value.unevaluatedProperties) || IsOptionalSchema(value.unevaluatedProperties)) && IsOptionalString(value.$id);
}
function IsIterator3(value) {
  return IsKindOf2(value, "Iterator") && value.type === "Iterator" && IsOptionalString(value.$id) && IsSchema2(value.items);
}
function IsKindOf2(value, kind) {
  return IsObject(value) && Kind in value && value[Kind] === kind;
}
function IsLiteralString(value) {
  return IsLiteral2(value) && IsString(value.const);
}
function IsLiteralNumber(value) {
  return IsLiteral2(value) && IsNumber(value.const);
}
function IsLiteralBoolean(value) {
  return IsLiteral2(value) && IsBoolean(value.const);
}
function IsLiteral2(value) {
  return IsKindOf2(value, "Literal") && IsOptionalString(value.$id) && IsLiteralValue2(value.const);
}
function IsLiteralValue2(value) {
  return IsBoolean(value) || IsNumber(value) || IsString(value);
}
function IsMappedKey2(value) {
  return IsKindOf2(value, "MappedKey") && IsArray(value.keys) && value.keys.every((key) => IsNumber(key) || IsString(key));
}
function IsMappedResult2(value) {
  return IsKindOf2(value, "MappedResult") && IsProperties(value.properties);
}
function IsNever2(value) {
  return IsKindOf2(value, "Never") && IsObject(value.not) && Object.getOwnPropertyNames(value.not).length === 0;
}
function IsNot2(value) {
  return IsKindOf2(value, "Not") && IsSchema2(value.not);
}
function IsNull3(value) {
  return IsKindOf2(value, "Null") && value.type === "null" && IsOptionalString(value.$id);
}
function IsNumber4(value) {
  return IsKindOf2(value, "Number") && value.type === "number" && IsOptionalString(value.$id) && IsOptionalNumber(value.exclusiveMaximum) && IsOptionalNumber(value.exclusiveMinimum) && IsOptionalNumber(value.maximum) && IsOptionalNumber(value.minimum) && IsOptionalNumber(value.multipleOf);
}
function IsObject4(value) {
  return IsKindOf2(value, "Object") && value.type === "object" && IsOptionalString(value.$id) && IsProperties(value.properties) && IsAdditionalProperties(value.additionalProperties) && IsOptionalNumber(value.minProperties) && IsOptionalNumber(value.maxProperties);
}
function IsPromise2(value) {
  return IsKindOf2(value, "Promise") && value.type === "Promise" && IsOptionalString(value.$id) && IsSchema2(value.item);
}
function IsRecord2(value) {
  return IsKindOf2(value, "Record") && value.type === "object" && IsOptionalString(value.$id) && IsAdditionalProperties(value.additionalProperties) && IsObject(value.patternProperties) && ((schema) => {
    const keys = Object.getOwnPropertyNames(schema.patternProperties);
    return keys.length === 1 && IsPattern(keys[0]) && IsObject(schema.patternProperties) && IsSchema2(schema.patternProperties[keys[0]]);
  })(value);
}
function IsRef2(value) {
  return IsKindOf2(value, "Ref") && IsOptionalString(value.$id) && IsString(value.$ref);
}
function IsRegExp3(value) {
  return IsKindOf2(value, "RegExp") && IsOptionalString(value.$id) && IsString(value.source) && IsString(value.flags) && IsOptionalNumber(value.maxLength) && IsOptionalNumber(value.minLength);
}
function IsString3(value) {
  return IsKindOf2(value, "String") && value.type === "string" && IsOptionalString(value.$id) && IsOptionalNumber(value.minLength) && IsOptionalNumber(value.maxLength) && IsOptionalPattern(value.pattern) && IsOptionalFormat(value.format);
}
function IsSymbol3(value) {
  return IsKindOf2(value, "Symbol") && value.type === "symbol" && IsOptionalString(value.$id);
}
function IsTemplateLiteral2(value) {
  return IsKindOf2(value, "TemplateLiteral") && value.type === "string" && IsString(value.pattern) && value.pattern[0] === "^" && value.pattern[value.pattern.length - 1] === "$";
}
function IsThis2(value) {
  return IsKindOf2(value, "This") && IsOptionalString(value.$id) && IsString(value.$ref);
}
function IsTransform2(value) {
  return IsObject(value) && TransformKind in value;
}
function IsTuple2(value) {
  return IsKindOf2(value, "Tuple") && value.type === "array" && IsOptionalString(value.$id) && IsNumber(value.minItems) && IsNumber(value.maxItems) && value.minItems === value.maxItems && (IsUndefined(value.items) && IsUndefined(value.additionalItems) && value.minItems === 0 || IsArray(value.items) && value.items.every((schema) => IsSchema2(schema)));
}
function IsUndefined4(value) {
  return IsKindOf2(value, "Undefined") && value.type === "undefined" && IsOptionalString(value.$id);
}
function IsUnion2(value) {
  return IsKindOf2(value, "Union") && IsOptionalString(value.$id) && IsObject(value) && IsArray(value.anyOf) && value.anyOf.every((schema) => IsSchema2(schema));
}
function IsUint8Array3(value) {
  return IsKindOf2(value, "Uint8Array") && value.type === "Uint8Array" && IsOptionalString(value.$id) && IsOptionalNumber(value.minByteLength) && IsOptionalNumber(value.maxByteLength);
}
function IsUnknown2(value) {
  return IsKindOf2(value, "Unknown") && IsOptionalString(value.$id);
}
function IsUnsafe2(value) {
  return IsKindOf2(value, "Unsafe");
}
function IsVoid2(value) {
  return IsKindOf2(value, "Void") && value.type === "void" && IsOptionalString(value.$id);
}
function IsKind2(value) {
  return IsObject(value) && Kind in value && IsString(value[Kind]) && !KnownTypes.includes(value[Kind]);
}
function IsSchema2(value) {
  return IsObject(value) && (IsAny2(value) || IsArgument2(value) || IsArray4(value) || IsBoolean3(value) || IsBigInt3(value) || IsAsyncIterator3(value) || IsComputed2(value) || IsConstructor2(value) || IsDate3(value) || IsFunction3(value) || IsInteger2(value) || IsIntersect2(value) || IsIterator3(value) || IsLiteral2(value) || IsMappedKey2(value) || IsMappedResult2(value) || IsNever2(value) || IsNot2(value) || IsNull3(value) || IsNumber4(value) || IsObject4(value) || IsPromise2(value) || IsRecord2(value) || IsRef2(value) || IsRegExp3(value) || IsString3(value) || IsSymbol3(value) || IsTemplateLiteral2(value) || IsThis2(value) || IsTuple2(value) || IsUndefined4(value) || IsUnion2(value) || IsUint8Array3(value) || IsUnknown2(value) || IsUnsafe2(value) || IsVoid2(value) || IsKind2(value));
}
// node_modules/@sinclair/typebox/build/esm/type/patterns/patterns.mjs
var PatternBoolean = "(true|false)";
var PatternNumber = "(0|[1-9][0-9]*)";
var PatternString = "(.*)";
var PatternNever = "(?!.*)";
var PatternBooleanExact = `^${PatternBoolean}$`;
var PatternNumberExact = `^${PatternNumber}$`;
var PatternStringExact = `^${PatternString}$`;
var PatternNeverExact = `^${PatternNever}$`;

// node_modules/@sinclair/typebox/build/esm/type/sets/set.mjs
function SetIncludes(T, S) {
  return T.includes(S);
}
function SetDistinct(T) {
  return [...new Set(T)];
}
function SetIntersect(T, S) {
  return T.filter((L) => S.includes(L));
}
function SetIntersectManyResolve(T, Init) {
  return T.reduce((Acc, L) => {
    return SetIntersect(Acc, L);
  }, Init);
}
function SetIntersectMany(T) {
  return T.length === 1 ? T[0] : T.length > 1 ? SetIntersectManyResolve(T.slice(1), T[0]) : [];
}
function SetUnionMany(T) {
  const Acc = [];
  for (const L of T)
    Acc.push(...L);
  return Acc;
}

// node_modules/@sinclair/typebox/build/esm/type/any/any.mjs
function Any(options) {
  return CreateType({ [Kind]: "Any" }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/array/array.mjs
function Array2(items, options) {
  return CreateType({ [Kind]: "Array", type: "array", items }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/argument/argument.mjs
function Argument(index) {
  return CreateType({ [Kind]: "Argument", index });
}

// node_modules/@sinclair/typebox/build/esm/type/async-iterator/async-iterator.mjs
function AsyncIterator(items, options) {
  return CreateType({ [Kind]: "AsyncIterator", type: "AsyncIterator", items }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/computed/computed.mjs
function Computed(target, parameters, options) {
  return CreateType({ [Kind]: "Computed", target, parameters }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/discard/discard.mjs
function DiscardKey(value, key) {
  const { [key]: _, ...rest } = value;
  return rest;
}
function Discard(value, keys) {
  return keys.reduce((acc, key) => DiscardKey(acc, key), value);
}

// node_modules/@sinclair/typebox/build/esm/type/never/never.mjs
function Never(options) {
  return CreateType({ [Kind]: "Never", not: {} }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/mapped/mapped-result.mjs
function MappedResult(properties) {
  return CreateType({
    [Kind]: "MappedResult",
    properties
  });
}

// node_modules/@sinclair/typebox/build/esm/type/constructor/constructor.mjs
function Constructor(parameters, returns, options) {
  return CreateType({ [Kind]: "Constructor", type: "Constructor", parameters, returns }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/function/function.mjs
function Function(parameters, returns, options) {
  return CreateType({ [Kind]: "Function", type: "Function", parameters, returns }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/union/union-create.mjs
function UnionCreate(T, options) {
  return CreateType({ [Kind]: "Union", anyOf: T }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/union/union-evaluated.mjs
function IsUnionOptional(types) {
  return types.some((type) => IsOptional(type));
}
function RemoveOptionalFromRest(types) {
  return types.map((left) => IsOptional(left) ? RemoveOptionalFromType(left) : left);
}
function RemoveOptionalFromType(T) {
  return Discard(T, [OptionalKind]);
}
function ResolveUnion(types, options) {
  const isOptional = IsUnionOptional(types);
  return isOptional ? Optional(UnionCreate(RemoveOptionalFromRest(types), options)) : UnionCreate(RemoveOptionalFromRest(types), options);
}
function UnionEvaluated(T, options) {
  return T.length === 1 ? CreateType(T[0], options) : T.length === 0 ? Never(options) : ResolveUnion(T, options);
}

// node_modules/@sinclair/typebox/build/esm/type/union/union.mjs
function Union(types, options) {
  return types.length === 0 ? Never(options) : types.length === 1 ? CreateType(types[0], options) : UnionCreate(types, options);
}

// node_modules/@sinclair/typebox/build/esm/type/template-literal/parse.mjs
class TemplateLiteralParserError extends TypeBoxError {
}
function Unescape(pattern) {
  return pattern.replace(/\\\$/g, "$").replace(/\\\*/g, "*").replace(/\\\^/g, "^").replace(/\\\|/g, "|").replace(/\\\(/g, "(").replace(/\\\)/g, ")");
}
function IsNonEscaped(pattern, index, char) {
  return pattern[index] === char && pattern.charCodeAt(index - 1) !== 92;
}
function IsOpenParen(pattern, index) {
  return IsNonEscaped(pattern, index, "(");
}
function IsCloseParen(pattern, index) {
  return IsNonEscaped(pattern, index, ")");
}
function IsSeparator(pattern, index) {
  return IsNonEscaped(pattern, index, "|");
}
function IsGroup(pattern) {
  if (!(IsOpenParen(pattern, 0) && IsCloseParen(pattern, pattern.length - 1)))
    return false;
  let count = 0;
  for (let index = 0;index < pattern.length; index++) {
    if (IsOpenParen(pattern, index))
      count += 1;
    if (IsCloseParen(pattern, index))
      count -= 1;
    if (count === 0 && index !== pattern.length - 1)
      return false;
  }
  return true;
}
function InGroup(pattern) {
  return pattern.slice(1, pattern.length - 1);
}
function IsPrecedenceOr(pattern) {
  let count = 0;
  for (let index = 0;index < pattern.length; index++) {
    if (IsOpenParen(pattern, index))
      count += 1;
    if (IsCloseParen(pattern, index))
      count -= 1;
    if (IsSeparator(pattern, index) && count === 0)
      return true;
  }
  return false;
}
function IsPrecedenceAnd(pattern) {
  for (let index = 0;index < pattern.length; index++) {
    if (IsOpenParen(pattern, index))
      return true;
  }
  return false;
}
function Or(pattern) {
  let [count, start] = [0, 0];
  const expressions = [];
  for (let index = 0;index < pattern.length; index++) {
    if (IsOpenParen(pattern, index))
      count += 1;
    if (IsCloseParen(pattern, index))
      count -= 1;
    if (IsSeparator(pattern, index) && count === 0) {
      const range = pattern.slice(start, index);
      if (range.length > 0)
        expressions.push(TemplateLiteralParse(range));
      start = index + 1;
    }
  }
  const range = pattern.slice(start);
  if (range.length > 0)
    expressions.push(TemplateLiteralParse(range));
  if (expressions.length === 0)
    return { type: "const", const: "" };
  if (expressions.length === 1)
    return expressions[0];
  return { type: "or", expr: expressions };
}
function And(pattern) {
  function Group(value, index) {
    if (!IsOpenParen(value, index))
      throw new TemplateLiteralParserError(`TemplateLiteralParser: Index must point to open parens`);
    let count = 0;
    for (let scan = index;scan < value.length; scan++) {
      if (IsOpenParen(value, scan))
        count += 1;
      if (IsCloseParen(value, scan))
        count -= 1;
      if (count === 0)
        return [index, scan];
    }
    throw new TemplateLiteralParserError(`TemplateLiteralParser: Unclosed group parens in expression`);
  }
  function Range(pattern, index) {
    for (let scan = index;scan < pattern.length; scan++) {
      if (IsOpenParen(pattern, scan))
        return [index, scan];
    }
    return [index, pattern.length];
  }
  const expressions = [];
  for (let index = 0;index < pattern.length; index++) {
    if (IsOpenParen(pattern, index)) {
      const [start, end] = Group(pattern, index);
      const range = pattern.slice(start, end + 1);
      expressions.push(TemplateLiteralParse(range));
      index = end;
    } else {
      const [start, end] = Range(pattern, index);
      const range = pattern.slice(start, end);
      if (range.length > 0)
        expressions.push(TemplateLiteralParse(range));
      index = end - 1;
    }
  }
  return expressions.length === 0 ? { type: "const", const: "" } : expressions.length === 1 ? expressions[0] : { type: "and", expr: expressions };
}
function TemplateLiteralParse(pattern) {
  return IsGroup(pattern) ? TemplateLiteralParse(InGroup(pattern)) : IsPrecedenceOr(pattern) ? Or(pattern) : IsPrecedenceAnd(pattern) ? And(pattern) : { type: "const", const: Unescape(pattern) };
}
function TemplateLiteralParseExact(pattern) {
  return TemplateLiteralParse(pattern.slice(1, pattern.length - 1));
}

// node_modules/@sinclair/typebox/build/esm/type/template-literal/finite.mjs
class TemplateLiteralFiniteError extends TypeBoxError {
}
function IsNumberExpression(expression) {
  return expression.type === "or" && expression.expr.length === 2 && expression.expr[0].type === "const" && expression.expr[0].const === "0" && expression.expr[1].type === "const" && expression.expr[1].const === "[1-9][0-9]*";
}
function IsBooleanExpression(expression) {
  return expression.type === "or" && expression.expr.length === 2 && expression.expr[0].type === "const" && expression.expr[0].const === "true" && expression.expr[1].type === "const" && expression.expr[1].const === "false";
}
function IsStringExpression(expression) {
  return expression.type === "const" && expression.const === ".*";
}
function IsTemplateLiteralExpressionFinite(expression) {
  return IsNumberExpression(expression) || IsStringExpression(expression) ? false : IsBooleanExpression(expression) ? true : expression.type === "and" ? expression.expr.every((expr) => IsTemplateLiteralExpressionFinite(expr)) : expression.type === "or" ? expression.expr.every((expr) => IsTemplateLiteralExpressionFinite(expr)) : expression.type === "const" ? true : (() => {
    throw new TemplateLiteralFiniteError(`Unknown expression type`);
  })();
}
function IsTemplateLiteralFinite(schema) {
  const expression = TemplateLiteralParseExact(schema.pattern);
  return IsTemplateLiteralExpressionFinite(expression);
}

// node_modules/@sinclair/typebox/build/esm/type/template-literal/generate.mjs
class TemplateLiteralGenerateError extends TypeBoxError {
}
function* GenerateReduce(buffer) {
  if (buffer.length === 1)
    return yield* buffer[0];
  for (const left of buffer[0]) {
    for (const right of GenerateReduce(buffer.slice(1))) {
      yield `${left}${right}`;
    }
  }
}
function* GenerateAnd(expression) {
  return yield* GenerateReduce(expression.expr.map((expr) => [...TemplateLiteralExpressionGenerate(expr)]));
}
function* GenerateOr(expression) {
  for (const expr of expression.expr)
    yield* TemplateLiteralExpressionGenerate(expr);
}
function* GenerateConst(expression) {
  return yield expression.const;
}
function* TemplateLiteralExpressionGenerate(expression) {
  return expression.type === "and" ? yield* GenerateAnd(expression) : expression.type === "or" ? yield* GenerateOr(expression) : expression.type === "const" ? yield* GenerateConst(expression) : (() => {
    throw new TemplateLiteralGenerateError("Unknown expression");
  })();
}
function TemplateLiteralGenerate(schema) {
  const expression = TemplateLiteralParseExact(schema.pattern);
  return IsTemplateLiteralExpressionFinite(expression) ? [...TemplateLiteralExpressionGenerate(expression)] : [];
}

// node_modules/@sinclair/typebox/build/esm/type/literal/literal.mjs
function Literal(value, options) {
  return CreateType({
    [Kind]: "Literal",
    const: value,
    type: typeof value
  }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/boolean/boolean.mjs
function Boolean2(options) {
  return CreateType({ [Kind]: "Boolean", type: "boolean" }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/bigint/bigint.mjs
function BigInt(options) {
  return CreateType({ [Kind]: "BigInt", type: "bigint" }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/number/number.mjs
function Number2(options) {
  return CreateType({ [Kind]: "Number", type: "number" }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/string/string.mjs
function String2(options) {
  return CreateType({ [Kind]: "String", type: "string" }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/template-literal/syntax.mjs
function* FromUnion(syntax) {
  const trim = syntax.trim().replace(/"|'/g, "");
  return trim === "boolean" ? yield Boolean2() : trim === "number" ? yield Number2() : trim === "bigint" ? yield BigInt() : trim === "string" ? yield String2() : yield (() => {
    const literals = trim.split("|").map((literal) => Literal(literal.trim()));
    return literals.length === 0 ? Never() : literals.length === 1 ? literals[0] : UnionEvaluated(literals);
  })();
}
function* FromTerminal(syntax) {
  if (syntax[1] !== "{") {
    const L = Literal("$");
    const R = FromSyntax(syntax.slice(1));
    return yield* [L, ...R];
  }
  for (let i = 2;i < syntax.length; i++) {
    if (syntax[i] === "}") {
      const L = FromUnion(syntax.slice(2, i));
      const R = FromSyntax(syntax.slice(i + 1));
      return yield* [...L, ...R];
    }
  }
  yield Literal(syntax);
}
function* FromSyntax(syntax) {
  for (let i = 0;i < syntax.length; i++) {
    if (syntax[i] === "$") {
      const L = Literal(syntax.slice(0, i));
      const R = FromTerminal(syntax.slice(i));
      return yield* [L, ...R];
    }
  }
  yield Literal(syntax);
}
function TemplateLiteralSyntax(syntax) {
  return [...FromSyntax(syntax)];
}

// node_modules/@sinclair/typebox/build/esm/type/template-literal/pattern.mjs
class TemplateLiteralPatternError extends TypeBoxError {
}
function Escape(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function Visit2(schema, acc) {
  return IsTemplateLiteral(schema) ? schema.pattern.slice(1, schema.pattern.length - 1) : IsUnion(schema) ? `(${schema.anyOf.map((schema) => Visit2(schema, acc)).join("|")})` : IsNumber3(schema) ? `${acc}${PatternNumber}` : IsInteger(schema) ? `${acc}${PatternNumber}` : IsBigInt2(schema) ? `${acc}${PatternNumber}` : IsString2(schema) ? `${acc}${PatternString}` : IsLiteral(schema) ? `${acc}${Escape(schema.const.toString())}` : IsBoolean2(schema) ? `${acc}${PatternBoolean}` : (() => {
    throw new TemplateLiteralPatternError(`Unexpected Kind '${schema[Kind]}'`);
  })();
}
function TemplateLiteralPattern(kinds) {
  return `^${kinds.map((schema) => Visit2(schema, "")).join("")}$`;
}

// node_modules/@sinclair/typebox/build/esm/type/template-literal/union.mjs
function TemplateLiteralToUnion(schema) {
  const R = TemplateLiteralGenerate(schema);
  const L = R.map((S) => Literal(S));
  return UnionEvaluated(L);
}

// node_modules/@sinclair/typebox/build/esm/type/template-literal/template-literal.mjs
function TemplateLiteral(unresolved, options) {
  const pattern = IsString(unresolved) ? TemplateLiteralPattern(TemplateLiteralSyntax(unresolved)) : TemplateLiteralPattern(unresolved);
  return CreateType({ [Kind]: "TemplateLiteral", type: "string", pattern }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/indexed/indexed-property-keys.mjs
function FromTemplateLiteral(templateLiteral) {
  const keys = TemplateLiteralGenerate(templateLiteral);
  return keys.map((key) => key.toString());
}
function FromUnion2(types) {
  const result = [];
  for (const type of types)
    result.push(...IndexPropertyKeys(type));
  return result;
}
function FromLiteral(literalValue) {
  return [literalValue.toString()];
}
function IndexPropertyKeys(type) {
  return [...new Set(IsTemplateLiteral(type) ? FromTemplateLiteral(type) : IsUnion(type) ? FromUnion2(type.anyOf) : IsLiteral(type) ? FromLiteral(type.const) : IsNumber3(type) ? ["[number]"] : IsInteger(type) ? ["[number]"] : [])];
}

// node_modules/@sinclair/typebox/build/esm/type/indexed/indexed-from-mapped-result.mjs
function FromProperties(type, properties, options) {
  const result = {};
  for (const K2 of Object.getOwnPropertyNames(properties)) {
    result[K2] = Index(type, IndexPropertyKeys(properties[K2]), options);
  }
  return result;
}
function FromMappedResult(type, mappedResult, options) {
  return FromProperties(type, mappedResult.properties, options);
}
function IndexFromMappedResult(type, mappedResult, options) {
  const properties = FromMappedResult(type, mappedResult, options);
  return MappedResult(properties);
}

// node_modules/@sinclair/typebox/build/esm/type/indexed/indexed.mjs
function FromRest(types, key) {
  return types.map((type) => IndexFromPropertyKey(type, key));
}
function FromIntersectRest(types) {
  return types.filter((type) => !IsNever(type));
}
function FromIntersect(types, key) {
  return IntersectEvaluated(FromIntersectRest(FromRest(types, key)));
}
function FromUnionRest(types) {
  return types.some((L) => IsNever(L)) ? [] : types;
}
function FromUnion3(types, key) {
  return UnionEvaluated(FromUnionRest(FromRest(types, key)));
}
function FromTuple(types, key) {
  return key in types ? types[key] : key === "[number]" ? UnionEvaluated(types) : Never();
}
function FromArray(type, key) {
  return key === "[number]" ? type : Never();
}
function FromProperty(properties, propertyKey) {
  return propertyKey in properties ? properties[propertyKey] : Never();
}
function IndexFromPropertyKey(type, propertyKey) {
  return IsIntersect(type) ? FromIntersect(type.allOf, propertyKey) : IsUnion(type) ? FromUnion3(type.anyOf, propertyKey) : IsTuple(type) ? FromTuple(type.items ?? [], propertyKey) : IsArray3(type) ? FromArray(type.items, propertyKey) : IsObject3(type) ? FromProperty(type.properties, propertyKey) : Never();
}
function IndexFromPropertyKeys(type, propertyKeys) {
  return propertyKeys.map((propertyKey) => IndexFromPropertyKey(type, propertyKey));
}
function FromSchema(type, propertyKeys) {
  return UnionEvaluated(IndexFromPropertyKeys(type, propertyKeys));
}
function Index(type, key, options) {
  if (IsRef(type) || IsRef(key)) {
    const error = `Index types using Ref parameters require both Type and Key to be of TSchema`;
    if (!IsSchema(type) || !IsSchema(key))
      throw new TypeBoxError(error);
    return Computed("Index", [type, key]);
  }
  if (IsMappedResult(key))
    return IndexFromMappedResult(type, key, options);
  if (IsMappedKey(key))
    return IndexFromMappedKey(type, key, options);
  return CreateType(IsSchema(key) ? FromSchema(type, IndexPropertyKeys(key)) : FromSchema(type, key), options);
}

// node_modules/@sinclair/typebox/build/esm/type/indexed/indexed-from-mapped-key.mjs
function MappedIndexPropertyKey(type, key, options) {
  return { [key]: Index(type, [key], Clone(options)) };
}
function MappedIndexPropertyKeys(type, propertyKeys, options) {
  return propertyKeys.reduce((result, left) => {
    return { ...result, ...MappedIndexPropertyKey(type, left, options) };
  }, {});
}
function MappedIndexProperties(type, mappedKey, options) {
  return MappedIndexPropertyKeys(type, mappedKey.keys, options);
}
function IndexFromMappedKey(type, mappedKey, options) {
  const properties = MappedIndexProperties(type, mappedKey, options);
  return MappedResult(properties);
}

// node_modules/@sinclair/typebox/build/esm/type/iterator/iterator.mjs
function Iterator(items, options) {
  return CreateType({ [Kind]: "Iterator", type: "Iterator", items }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/object/object.mjs
function RequiredArray(properties) {
  return globalThis.Object.keys(properties).filter((key) => !IsOptional(properties[key]));
}
function _Object(properties, options) {
  const required = RequiredArray(properties);
  const schema = required.length > 0 ? { [Kind]: "Object", type: "object", required, properties } : { [Kind]: "Object", type: "object", properties };
  return CreateType(schema, options);
}
var Object2 = _Object;

// node_modules/@sinclair/typebox/build/esm/type/promise/promise.mjs
function Promise2(item, options) {
  return CreateType({ [Kind]: "Promise", type: "Promise", item }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/readonly/readonly.mjs
function RemoveReadonly(schema) {
  return CreateType(Discard(schema, [ReadonlyKind]));
}
function AddReadonly(schema) {
  return CreateType({ ...schema, [ReadonlyKind]: "Readonly" });
}
function ReadonlyWithFlag(schema, F) {
  return F === false ? RemoveReadonly(schema) : AddReadonly(schema);
}
function Readonly(schema, enable) {
  const F = enable ?? true;
  return IsMappedResult(schema) ? ReadonlyFromMappedResult(schema, F) : ReadonlyWithFlag(schema, F);
}

// node_modules/@sinclair/typebox/build/esm/type/readonly/readonly-from-mapped-result.mjs
function FromProperties2(K, F) {
  const Acc = {};
  for (const K2 of globalThis.Object.getOwnPropertyNames(K))
    Acc[K2] = Readonly(K[K2], F);
  return Acc;
}
function FromMappedResult2(R, F) {
  return FromProperties2(R.properties, F);
}
function ReadonlyFromMappedResult(R, F) {
  const P = FromMappedResult2(R, F);
  return MappedResult(P);
}

// node_modules/@sinclair/typebox/build/esm/type/tuple/tuple.mjs
function Tuple(types, options) {
  return CreateType(types.length > 0 ? { [Kind]: "Tuple", type: "array", items: types, additionalItems: false, minItems: types.length, maxItems: types.length } : { [Kind]: "Tuple", type: "array", minItems: types.length, maxItems: types.length }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/mapped/mapped.mjs
function FromMappedResult3(K, P) {
  return K in P ? FromSchemaType(K, P[K]) : MappedResult(P);
}
function MappedKeyToKnownMappedResultProperties(K) {
  return { [K]: Literal(K) };
}
function MappedKeyToUnknownMappedResultProperties(P) {
  const Acc = {};
  for (const L of P)
    Acc[L] = Literal(L);
  return Acc;
}
function MappedKeyToMappedResultProperties(K, P) {
  return SetIncludes(P, K) ? MappedKeyToKnownMappedResultProperties(K) : MappedKeyToUnknownMappedResultProperties(P);
}
function FromMappedKey(K, P) {
  const R = MappedKeyToMappedResultProperties(K, P);
  return FromMappedResult3(K, R);
}
function FromRest2(K, T) {
  return T.map((L) => FromSchemaType(K, L));
}
function FromProperties3(K, T) {
  const Acc = {};
  for (const K2 of globalThis.Object.getOwnPropertyNames(T))
    Acc[K2] = FromSchemaType(K, T[K2]);
  return Acc;
}
function FromSchemaType(K, T) {
  const options = { ...T };
  return IsOptional(T) ? Optional(FromSchemaType(K, Discard(T, [OptionalKind]))) : IsReadonly(T) ? Readonly(FromSchemaType(K, Discard(T, [ReadonlyKind]))) : IsMappedResult(T) ? FromMappedResult3(K, T.properties) : IsMappedKey(T) ? FromMappedKey(K, T.keys) : IsConstructor(T) ? Constructor(FromRest2(K, T.parameters), FromSchemaType(K, T.returns), options) : IsFunction2(T) ? Function(FromRest2(K, T.parameters), FromSchemaType(K, T.returns), options) : IsAsyncIterator2(T) ? AsyncIterator(FromSchemaType(K, T.items), options) : IsIterator2(T) ? Iterator(FromSchemaType(K, T.items), options) : IsIntersect(T) ? Intersect(FromRest2(K, T.allOf), options) : IsUnion(T) ? Union(FromRest2(K, T.anyOf), options) : IsTuple(T) ? Tuple(FromRest2(K, T.items ?? []), options) : IsObject3(T) ? Object2(FromProperties3(K, T.properties), options) : IsArray3(T) ? Array2(FromSchemaType(K, T.items), options) : IsPromise(T) ? Promise2(FromSchemaType(K, T.item), options) : T;
}
function MappedFunctionReturnType(K, T) {
  const Acc = {};
  for (const L of K)
    Acc[L] = FromSchemaType(L, T);
  return Acc;
}
function Mapped(key, map, options) {
  const K = IsSchema(key) ? IndexPropertyKeys(key) : key;
  const RT = map({ [Kind]: "MappedKey", keys: K });
  const R = MappedFunctionReturnType(K, RT);
  return Object2(R, options);
}

// node_modules/@sinclair/typebox/build/esm/type/optional/optional.mjs
function RemoveOptional(schema) {
  return CreateType(Discard(schema, [OptionalKind]));
}
function AddOptional(schema) {
  return CreateType({ ...schema, [OptionalKind]: "Optional" });
}
function OptionalWithFlag(schema, F) {
  return F === false ? RemoveOptional(schema) : AddOptional(schema);
}
function Optional(schema, enable) {
  const F = enable ?? true;
  return IsMappedResult(schema) ? OptionalFromMappedResult(schema, F) : OptionalWithFlag(schema, F);
}

// node_modules/@sinclair/typebox/build/esm/type/optional/optional-from-mapped-result.mjs
function FromProperties4(P, F) {
  const Acc = {};
  for (const K2 of globalThis.Object.getOwnPropertyNames(P))
    Acc[K2] = Optional(P[K2], F);
  return Acc;
}
function FromMappedResult4(R, F) {
  return FromProperties4(R.properties, F);
}
function OptionalFromMappedResult(R, F) {
  const P = FromMappedResult4(R, F);
  return MappedResult(P);
}

// node_modules/@sinclair/typebox/build/esm/type/intersect/intersect-create.mjs
function IntersectCreate(T, options = {}) {
  const allObjects = T.every((schema) => IsObject3(schema));
  const clonedUnevaluatedProperties = IsSchema(options.unevaluatedProperties) ? { unevaluatedProperties: options.unevaluatedProperties } : {};
  return CreateType(options.unevaluatedProperties === false || IsSchema(options.unevaluatedProperties) || allObjects ? { ...clonedUnevaluatedProperties, [Kind]: "Intersect", type: "object", allOf: T } : { ...clonedUnevaluatedProperties, [Kind]: "Intersect", allOf: T }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/intersect/intersect-evaluated.mjs
function IsIntersectOptional(types) {
  return types.every((left) => IsOptional(left));
}
function RemoveOptionalFromType2(type) {
  return Discard(type, [OptionalKind]);
}
function RemoveOptionalFromRest2(types) {
  return types.map((left) => IsOptional(left) ? RemoveOptionalFromType2(left) : left);
}
function ResolveIntersect(types, options) {
  return IsIntersectOptional(types) ? Optional(IntersectCreate(RemoveOptionalFromRest2(types), options)) : IntersectCreate(RemoveOptionalFromRest2(types), options);
}
function IntersectEvaluated(types, options = {}) {
  if (types.length === 1)
    return CreateType(types[0], options);
  if (types.length === 0)
    return Never(options);
  if (types.some((schema) => IsTransform(schema)))
    throw new Error("Cannot intersect transform types");
  return ResolveIntersect(types, options);
}

// node_modules/@sinclair/typebox/build/esm/type/intersect/intersect.mjs
function Intersect(types, options) {
  if (types.length === 1)
    return CreateType(types[0], options);
  if (types.length === 0)
    return Never(options);
  if (types.some((schema) => IsTransform(schema)))
    throw new Error("Cannot intersect transform types");
  return IntersectCreate(types, options);
}

// node_modules/@sinclair/typebox/build/esm/type/ref/ref.mjs
function Ref(...args) {
  const [$ref, options] = typeof args[0] === "string" ? [args[0], args[1]] : [args[0].$id, args[1]];
  if (typeof $ref !== "string")
    throw new TypeBoxError("Ref: $ref must be a string");
  return CreateType({ [Kind]: "Ref", $ref }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/awaited/awaited.mjs
function FromComputed(target, parameters) {
  return Computed("Awaited", [Computed(target, parameters)]);
}
function FromRef($ref) {
  return Computed("Awaited", [Ref($ref)]);
}
function FromIntersect2(types) {
  return Intersect(FromRest3(types));
}
function FromUnion4(types) {
  return Union(FromRest3(types));
}
function FromPromise(type) {
  return Awaited(type);
}
function FromRest3(types) {
  return types.map((type) => Awaited(type));
}
function Awaited(type, options) {
  return CreateType(IsComputed(type) ? FromComputed(type.target, type.parameters) : IsIntersect(type) ? FromIntersect2(type.allOf) : IsUnion(type) ? FromUnion4(type.anyOf) : IsPromise(type) ? FromPromise(type.item) : IsRef(type) ? FromRef(type.$ref) : type, options);
}

// node_modules/@sinclair/typebox/build/esm/type/keyof/keyof-property-keys.mjs
function FromRest4(types) {
  const result = [];
  for (const L of types)
    result.push(KeyOfPropertyKeys(L));
  return result;
}
function FromIntersect3(types) {
  const propertyKeysArray = FromRest4(types);
  const propertyKeys = SetUnionMany(propertyKeysArray);
  return propertyKeys;
}
function FromUnion5(types) {
  const propertyKeysArray = FromRest4(types);
  const propertyKeys = SetIntersectMany(propertyKeysArray);
  return propertyKeys;
}
function FromTuple2(types) {
  return types.map((_, indexer) => indexer.toString());
}
function FromArray2(_) {
  return ["[number]"];
}
function FromProperties5(T) {
  return globalThis.Object.getOwnPropertyNames(T);
}
function FromPatternProperties(patternProperties) {
  if (!includePatternProperties)
    return [];
  const patternPropertyKeys = globalThis.Object.getOwnPropertyNames(patternProperties);
  return patternPropertyKeys.map((key) => {
    return key[0] === "^" && key[key.length - 1] === "$" ? key.slice(1, key.length - 1) : key;
  });
}
function KeyOfPropertyKeys(type) {
  return IsIntersect(type) ? FromIntersect3(type.allOf) : IsUnion(type) ? FromUnion5(type.anyOf) : IsTuple(type) ? FromTuple2(type.items ?? []) : IsArray3(type) ? FromArray2(type.items) : IsObject3(type) ? FromProperties5(type.properties) : IsRecord(type) ? FromPatternProperties(type.patternProperties) : [];
}
var includePatternProperties = false;

// node_modules/@sinclair/typebox/build/esm/type/keyof/keyof.mjs
function FromComputed2(target, parameters) {
  return Computed("KeyOf", [Computed(target, parameters)]);
}
function FromRef2($ref) {
  return Computed("KeyOf", [Ref($ref)]);
}
function KeyOfFromType(type, options) {
  const propertyKeys = KeyOfPropertyKeys(type);
  const propertyKeyTypes = KeyOfPropertyKeysToRest(propertyKeys);
  const result = UnionEvaluated(propertyKeyTypes);
  return CreateType(result, options);
}
function KeyOfPropertyKeysToRest(propertyKeys) {
  return propertyKeys.map((L) => L === "[number]" ? Number2() : Literal(L));
}
function KeyOf(type, options) {
  return IsComputed(type) ? FromComputed2(type.target, type.parameters) : IsRef(type) ? FromRef2(type.$ref) : IsMappedResult(type) ? KeyOfFromMappedResult(type, options) : KeyOfFromType(type, options);
}

// node_modules/@sinclair/typebox/build/esm/type/keyof/keyof-from-mapped-result.mjs
function FromProperties6(properties, options) {
  const result = {};
  for (const K2 of globalThis.Object.getOwnPropertyNames(properties))
    result[K2] = KeyOf(properties[K2], Clone(options));
  return result;
}
function FromMappedResult5(mappedResult, options) {
  return FromProperties6(mappedResult.properties, options);
}
function KeyOfFromMappedResult(mappedResult, options) {
  const properties = FromMappedResult5(mappedResult, options);
  return MappedResult(properties);
}

// node_modules/@sinclair/typebox/build/esm/type/composite/composite.mjs
function CompositeKeys(T) {
  const Acc = [];
  for (const L of T)
    Acc.push(...KeyOfPropertyKeys(L));
  return SetDistinct(Acc);
}
function FilterNever(T) {
  return T.filter((L) => !IsNever(L));
}
function CompositeProperty(T, K) {
  const Acc = [];
  for (const L of T)
    Acc.push(...IndexFromPropertyKeys(L, [K]));
  return FilterNever(Acc);
}
function CompositeProperties(T, K) {
  const Acc = {};
  for (const L of K) {
    Acc[L] = IntersectEvaluated(CompositeProperty(T, L));
  }
  return Acc;
}
function Composite(T, options) {
  const K = CompositeKeys(T);
  const P = CompositeProperties(T, K);
  const R = Object2(P, options);
  return R;
}

// node_modules/@sinclair/typebox/build/esm/type/date/date.mjs
function Date2(options) {
  return CreateType({ [Kind]: "Date", type: "Date" }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/null/null.mjs
function Null(options) {
  return CreateType({ [Kind]: "Null", type: "null" }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/symbol/symbol.mjs
function Symbol2(options) {
  return CreateType({ [Kind]: "Symbol", type: "symbol" }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/undefined/undefined.mjs
function Undefined(options) {
  return CreateType({ [Kind]: "Undefined", type: "undefined" }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/uint8array/uint8array.mjs
function Uint8Array2(options) {
  return CreateType({ [Kind]: "Uint8Array", type: "Uint8Array" }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/unknown/unknown.mjs
function Unknown(options) {
  return CreateType({ [Kind]: "Unknown" }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/const/const.mjs
function FromArray3(T) {
  return T.map((L) => FromValue(L, false));
}
function FromProperties7(value) {
  const Acc = {};
  for (const K of globalThis.Object.getOwnPropertyNames(value))
    Acc[K] = Readonly(FromValue(value[K], false));
  return Acc;
}
function ConditionalReadonly(T, root) {
  return root === true ? T : Readonly(T);
}
function FromValue(value, root) {
  return IsAsyncIterator(value) ? ConditionalReadonly(Any(), root) : IsIterator(value) ? ConditionalReadonly(Any(), root) : IsArray(value) ? Readonly(Tuple(FromArray3(value))) : IsUint8Array(value) ? Uint8Array2() : IsDate(value) ? Date2() : IsObject(value) ? ConditionalReadonly(Object2(FromProperties7(value)), root) : IsFunction(value) ? ConditionalReadonly(Function([], Unknown()), root) : IsUndefined(value) ? Undefined() : IsNull(value) ? Null() : IsSymbol(value) ? Symbol2() : IsBigInt(value) ? BigInt() : IsNumber(value) ? Literal(value) : IsBoolean(value) ? Literal(value) : IsString(value) ? Literal(value) : Object2({});
}
function Const(T, options) {
  return CreateType(FromValue(T, true), options);
}

// node_modules/@sinclair/typebox/build/esm/type/constructor-parameters/constructor-parameters.mjs
function ConstructorParameters(schema, options) {
  return IsConstructor(schema) ? Tuple(schema.parameters, options) : Never(options);
}

// node_modules/@sinclair/typebox/build/esm/type/enum/enum.mjs
function Enum(item, options) {
  if (IsUndefined(item))
    throw new Error("Enum undefined or empty");
  const values1 = globalThis.Object.getOwnPropertyNames(item).filter((key) => isNaN(key)).map((key) => item[key]);
  const values2 = [...new Set(values1)];
  const anyOf = values2.map((value) => Literal(value));
  return Union(anyOf, { ...options, [Hint]: "Enum" });
}

// node_modules/@sinclair/typebox/build/esm/type/extends/extends-check.mjs
class ExtendsResolverError extends TypeBoxError {
}
var ExtendsResult;
(function(ExtendsResult) {
  ExtendsResult[ExtendsResult["Union"] = 0] = "Union";
  ExtendsResult[ExtendsResult["True"] = 1] = "True";
  ExtendsResult[ExtendsResult["False"] = 2] = "False";
})(ExtendsResult || (ExtendsResult = {}));
function IntoBooleanResult(result) {
  return result === ExtendsResult.False ? result : ExtendsResult.True;
}
function Throw(message) {
  throw new ExtendsResolverError(message);
}
function IsStructuralRight(right) {
  return IsNever2(right) || IsIntersect2(right) || IsUnion2(right) || IsUnknown2(right) || IsAny2(right);
}
function StructuralRight(left, right) {
  return IsNever2(right) ? FromNeverRight(left, right) : IsIntersect2(right) ? FromIntersectRight(left, right) : IsUnion2(right) ? FromUnionRight(left, right) : IsUnknown2(right) ? FromUnknownRight(left, right) : IsAny2(right) ? FromAnyRight(left, right) : Throw("StructuralRight");
}
function FromAnyRight(left, right) {
  return ExtendsResult.True;
}
function FromAny(left, right) {
  return IsIntersect2(right) ? FromIntersectRight(left, right) : IsUnion2(right) && right.anyOf.some((schema) => IsAny2(schema) || IsUnknown2(schema)) ? ExtendsResult.True : IsUnion2(right) ? ExtendsResult.Union : IsUnknown2(right) ? ExtendsResult.True : IsAny2(right) ? ExtendsResult.True : ExtendsResult.Union;
}
function FromArrayRight(left, right) {
  return IsUnknown2(left) ? ExtendsResult.False : IsAny2(left) ? ExtendsResult.Union : IsNever2(left) ? ExtendsResult.True : ExtendsResult.False;
}
function FromArray4(left, right) {
  return IsObject4(right) && IsObjectArrayLike(right) ? ExtendsResult.True : IsStructuralRight(right) ? StructuralRight(left, right) : !IsArray4(right) ? ExtendsResult.False : IntoBooleanResult(Visit3(left.items, right.items));
}
function FromAsyncIterator(left, right) {
  return IsStructuralRight(right) ? StructuralRight(left, right) : !IsAsyncIterator3(right) ? ExtendsResult.False : IntoBooleanResult(Visit3(left.items, right.items));
}
function FromBigInt(left, right) {
  return IsStructuralRight(right) ? StructuralRight(left, right) : IsObject4(right) ? FromObjectRight(left, right) : IsRecord2(right) ? FromRecordRight(left, right) : IsBigInt3(right) ? ExtendsResult.True : ExtendsResult.False;
}
function FromBooleanRight(left, right) {
  return IsLiteralBoolean(left) ? ExtendsResult.True : IsBoolean3(left) ? ExtendsResult.True : ExtendsResult.False;
}
function FromBoolean(left, right) {
  return IsStructuralRight(right) ? StructuralRight(left, right) : IsObject4(right) ? FromObjectRight(left, right) : IsRecord2(right) ? FromRecordRight(left, right) : IsBoolean3(right) ? ExtendsResult.True : ExtendsResult.False;
}
function FromConstructor(left, right) {
  return IsStructuralRight(right) ? StructuralRight(left, right) : IsObject4(right) ? FromObjectRight(left, right) : !IsConstructor2(right) ? ExtendsResult.False : left.parameters.length > right.parameters.length ? ExtendsResult.False : !left.parameters.every((schema, index) => IntoBooleanResult(Visit3(right.parameters[index], schema)) === ExtendsResult.True) ? ExtendsResult.False : IntoBooleanResult(Visit3(left.returns, right.returns));
}
function FromDate(left, right) {
  return IsStructuralRight(right) ? StructuralRight(left, right) : IsObject4(right) ? FromObjectRight(left, right) : IsRecord2(right) ? FromRecordRight(left, right) : IsDate3(right) ? ExtendsResult.True : ExtendsResult.False;
}
function FromFunction(left, right) {
  return IsStructuralRight(right) ? StructuralRight(left, right) : IsObject4(right) ? FromObjectRight(left, right) : !IsFunction3(right) ? ExtendsResult.False : left.parameters.length > right.parameters.length ? ExtendsResult.False : !left.parameters.every((schema, index) => IntoBooleanResult(Visit3(right.parameters[index], schema)) === ExtendsResult.True) ? ExtendsResult.False : IntoBooleanResult(Visit3(left.returns, right.returns));
}
function FromIntegerRight(left, right) {
  return IsLiteral2(left) && IsNumber(left.const) ? ExtendsResult.True : IsNumber4(left) || IsInteger2(left) ? ExtendsResult.True : ExtendsResult.False;
}
function FromInteger(left, right) {
  return IsInteger2(right) || IsNumber4(right) ? ExtendsResult.True : IsStructuralRight(right) ? StructuralRight(left, right) : IsObject4(right) ? FromObjectRight(left, right) : IsRecord2(right) ? FromRecordRight(left, right) : ExtendsResult.False;
}
function FromIntersectRight(left, right) {
  return right.allOf.every((schema) => Visit3(left, schema) === ExtendsResult.True) ? ExtendsResult.True : ExtendsResult.False;
}
function FromIntersect4(left, right) {
  return left.allOf.some((schema) => Visit3(schema, right) === ExtendsResult.True) ? ExtendsResult.True : ExtendsResult.False;
}
function FromIterator(left, right) {
  return IsStructuralRight(right) ? StructuralRight(left, right) : !IsIterator3(right) ? ExtendsResult.False : IntoBooleanResult(Visit3(left.items, right.items));
}
function FromLiteral2(left, right) {
  return IsLiteral2(right) && right.const === left.const ? ExtendsResult.True : IsStructuralRight(right) ? StructuralRight(left, right) : IsObject4(right) ? FromObjectRight(left, right) : IsRecord2(right) ? FromRecordRight(left, right) : IsString3(right) ? FromStringRight(left, right) : IsNumber4(right) ? FromNumberRight(left, right) : IsInteger2(right) ? FromIntegerRight(left, right) : IsBoolean3(right) ? FromBooleanRight(left, right) : ExtendsResult.False;
}
function FromNeverRight(left, right) {
  return ExtendsResult.False;
}
function FromNever(left, right) {
  return ExtendsResult.True;
}
function UnwrapTNot(schema) {
  let [current, depth] = [schema, 0];
  while (true) {
    if (!IsNot2(current))
      break;
    current = current.not;
    depth += 1;
  }
  return depth % 2 === 0 ? current : Unknown();
}
function FromNot(left, right) {
  return IsNot2(left) ? Visit3(UnwrapTNot(left), right) : IsNot2(right) ? Visit3(left, UnwrapTNot(right)) : Throw("Invalid fallthrough for Not");
}
function FromNull(left, right) {
  return IsStructuralRight(right) ? StructuralRight(left, right) : IsObject4(right) ? FromObjectRight(left, right) : IsRecord2(right) ? FromRecordRight(left, right) : IsNull3(right) ? ExtendsResult.True : ExtendsResult.False;
}
function FromNumberRight(left, right) {
  return IsLiteralNumber(left) ? ExtendsResult.True : IsNumber4(left) || IsInteger2(left) ? ExtendsResult.True : ExtendsResult.False;
}
function FromNumber(left, right) {
  return IsStructuralRight(right) ? StructuralRight(left, right) : IsObject4(right) ? FromObjectRight(left, right) : IsRecord2(right) ? FromRecordRight(left, right) : IsInteger2(right) || IsNumber4(right) ? ExtendsResult.True : ExtendsResult.False;
}
function IsObjectPropertyCount(schema, count) {
  return Object.getOwnPropertyNames(schema.properties).length === count;
}
function IsObjectStringLike(schema) {
  return IsObjectArrayLike(schema);
}
function IsObjectSymbolLike(schema) {
  return IsObjectPropertyCount(schema, 0) || IsObjectPropertyCount(schema, 1) && "description" in schema.properties && IsUnion2(schema.properties.description) && schema.properties.description.anyOf.length === 2 && (IsString3(schema.properties.description.anyOf[0]) && IsUndefined4(schema.properties.description.anyOf[1]) || IsString3(schema.properties.description.anyOf[1]) && IsUndefined4(schema.properties.description.anyOf[0]));
}
function IsObjectNumberLike(schema) {
  return IsObjectPropertyCount(schema, 0);
}
function IsObjectBooleanLike(schema) {
  return IsObjectPropertyCount(schema, 0);
}
function IsObjectBigIntLike(schema) {
  return IsObjectPropertyCount(schema, 0);
}
function IsObjectDateLike(schema) {
  return IsObjectPropertyCount(schema, 0);
}
function IsObjectUint8ArrayLike(schema) {
  return IsObjectArrayLike(schema);
}
function IsObjectFunctionLike(schema) {
  const length = Number2();
  return IsObjectPropertyCount(schema, 0) || IsObjectPropertyCount(schema, 1) && "length" in schema.properties && IntoBooleanResult(Visit3(schema.properties["length"], length)) === ExtendsResult.True;
}
function IsObjectConstructorLike(schema) {
  return IsObjectPropertyCount(schema, 0);
}
function IsObjectArrayLike(schema) {
  const length = Number2();
  return IsObjectPropertyCount(schema, 0) || IsObjectPropertyCount(schema, 1) && "length" in schema.properties && IntoBooleanResult(Visit3(schema.properties["length"], length)) === ExtendsResult.True;
}
function IsObjectPromiseLike(schema) {
  const then = Function([Any()], Any());
  return IsObjectPropertyCount(schema, 0) || IsObjectPropertyCount(schema, 1) && "then" in schema.properties && IntoBooleanResult(Visit3(schema.properties["then"], then)) === ExtendsResult.True;
}
function Property(left, right) {
  return Visit3(left, right) === ExtendsResult.False ? ExtendsResult.False : IsOptional2(left) && !IsOptional2(right) ? ExtendsResult.False : ExtendsResult.True;
}
function FromObjectRight(left, right) {
  return IsUnknown2(left) ? ExtendsResult.False : IsAny2(left) ? ExtendsResult.Union : IsNever2(left) || IsLiteralString(left) && IsObjectStringLike(right) || IsLiteralNumber(left) && IsObjectNumberLike(right) || IsLiteralBoolean(left) && IsObjectBooleanLike(right) || IsSymbol3(left) && IsObjectSymbolLike(right) || IsBigInt3(left) && IsObjectBigIntLike(right) || IsString3(left) && IsObjectStringLike(right) || IsSymbol3(left) && IsObjectSymbolLike(right) || IsNumber4(left) && IsObjectNumberLike(right) || IsInteger2(left) && IsObjectNumberLike(right) || IsBoolean3(left) && IsObjectBooleanLike(right) || IsUint8Array3(left) && IsObjectUint8ArrayLike(right) || IsDate3(left) && IsObjectDateLike(right) || IsConstructor2(left) && IsObjectConstructorLike(right) || IsFunction3(left) && IsObjectFunctionLike(right) ? ExtendsResult.True : IsRecord2(left) && IsString3(RecordKey(left)) ? (() => {
    return right[Hint] === "Record" ? ExtendsResult.True : ExtendsResult.False;
  })() : IsRecord2(left) && IsNumber4(RecordKey(left)) ? (() => {
    return IsObjectPropertyCount(right, 0) ? ExtendsResult.True : ExtendsResult.False;
  })() : ExtendsResult.False;
}
function FromObject(left, right) {
  return IsStructuralRight(right) ? StructuralRight(left, right) : IsRecord2(right) ? FromRecordRight(left, right) : !IsObject4(right) ? ExtendsResult.False : (() => {
    for (const key of Object.getOwnPropertyNames(right.properties)) {
      if (!(key in left.properties) && !IsOptional2(right.properties[key])) {
        return ExtendsResult.False;
      }
      if (IsOptional2(right.properties[key])) {
        return ExtendsResult.True;
      }
      if (Property(left.properties[key], right.properties[key]) === ExtendsResult.False) {
        return ExtendsResult.False;
      }
    }
    return ExtendsResult.True;
  })();
}
function FromPromise2(left, right) {
  return IsStructuralRight(right) ? StructuralRight(left, right) : IsObject4(right) && IsObjectPromiseLike(right) ? ExtendsResult.True : !IsPromise2(right) ? ExtendsResult.False : IntoBooleanResult(Visit3(left.item, right.item));
}
function RecordKey(schema) {
  return PatternNumberExact in schema.patternProperties ? Number2() : (PatternStringExact in schema.patternProperties) ? String2() : Throw("Unknown record key pattern");
}
function RecordValue(schema) {
  return PatternNumberExact in schema.patternProperties ? schema.patternProperties[PatternNumberExact] : (PatternStringExact in schema.patternProperties) ? schema.patternProperties[PatternStringExact] : Throw("Unable to get record value schema");
}
function FromRecordRight(left, right) {
  const [Key, Value] = [RecordKey(right), RecordValue(right)];
  return IsLiteralString(left) && IsNumber4(Key) && IntoBooleanResult(Visit3(left, Value)) === ExtendsResult.True ? ExtendsResult.True : IsUint8Array3(left) && IsNumber4(Key) ? Visit3(left, Value) : IsString3(left) && IsNumber4(Key) ? Visit3(left, Value) : IsArray4(left) && IsNumber4(Key) ? Visit3(left, Value) : IsObject4(left) ? (() => {
    for (const key of Object.getOwnPropertyNames(left.properties)) {
      if (Property(Value, left.properties[key]) === ExtendsResult.False) {
        return ExtendsResult.False;
      }
    }
    return ExtendsResult.True;
  })() : ExtendsResult.False;
}
function FromRecord(left, right) {
  return IsStructuralRight(right) ? StructuralRight(left, right) : IsObject4(right) ? FromObjectRight(left, right) : !IsRecord2(right) ? ExtendsResult.False : Visit3(RecordValue(left), RecordValue(right));
}
function FromRegExp(left, right) {
  const L = IsRegExp3(left) ? String2() : left;
  const R = IsRegExp3(right) ? String2() : right;
  return Visit3(L, R);
}
function FromStringRight(left, right) {
  return IsLiteral2(left) && IsString(left.const) ? ExtendsResult.True : IsString3(left) ? ExtendsResult.True : ExtendsResult.False;
}
function FromString(left, right) {
  return IsStructuralRight(right) ? StructuralRight(left, right) : IsObject4(right) ? FromObjectRight(left, right) : IsRecord2(right) ? FromRecordRight(left, right) : IsString3(right) ? ExtendsResult.True : ExtendsResult.False;
}
function FromSymbol(left, right) {
  return IsStructuralRight(right) ? StructuralRight(left, right) : IsObject4(right) ? FromObjectRight(left, right) : IsRecord2(right) ? FromRecordRight(left, right) : IsSymbol3(right) ? ExtendsResult.True : ExtendsResult.False;
}
function FromTemplateLiteral2(left, right) {
  return IsTemplateLiteral2(left) ? Visit3(TemplateLiteralToUnion(left), right) : IsTemplateLiteral2(right) ? Visit3(left, TemplateLiteralToUnion(right)) : Throw("Invalid fallthrough for TemplateLiteral");
}
function IsArrayOfTuple(left, right) {
  return IsArray4(right) && left.items !== undefined && left.items.every((schema) => Visit3(schema, right.items) === ExtendsResult.True);
}
function FromTupleRight(left, right) {
  return IsNever2(left) ? ExtendsResult.True : IsUnknown2(left) ? ExtendsResult.False : IsAny2(left) ? ExtendsResult.Union : ExtendsResult.False;
}
function FromTuple3(left, right) {
  return IsStructuralRight(right) ? StructuralRight(left, right) : IsObject4(right) && IsObjectArrayLike(right) ? ExtendsResult.True : IsArray4(right) && IsArrayOfTuple(left, right) ? ExtendsResult.True : !IsTuple2(right) ? ExtendsResult.False : IsUndefined(left.items) && !IsUndefined(right.items) || !IsUndefined(left.items) && IsUndefined(right.items) ? ExtendsResult.False : IsUndefined(left.items) && !IsUndefined(right.items) ? ExtendsResult.True : left.items.every((schema, index) => Visit3(schema, right.items[index]) === ExtendsResult.True) ? ExtendsResult.True : ExtendsResult.False;
}
function FromUint8Array(left, right) {
  return IsStructuralRight(right) ? StructuralRight(left, right) : IsObject4(right) ? FromObjectRight(left, right) : IsRecord2(right) ? FromRecordRight(left, right) : IsUint8Array3(right) ? ExtendsResult.True : ExtendsResult.False;
}
function FromUndefined(left, right) {
  return IsStructuralRight(right) ? StructuralRight(left, right) : IsObject4(right) ? FromObjectRight(left, right) : IsRecord2(right) ? FromRecordRight(left, right) : IsVoid2(right) ? FromVoidRight(left, right) : IsUndefined4(right) ? ExtendsResult.True : ExtendsResult.False;
}
function FromUnionRight(left, right) {
  return right.anyOf.some((schema) => Visit3(left, schema) === ExtendsResult.True) ? ExtendsResult.True : ExtendsResult.False;
}
function FromUnion6(left, right) {
  return left.anyOf.every((schema) => Visit3(schema, right) === ExtendsResult.True) ? ExtendsResult.True : ExtendsResult.False;
}
function FromUnknownRight(left, right) {
  return ExtendsResult.True;
}
function FromUnknown(left, right) {
  return IsNever2(right) ? FromNeverRight(left, right) : IsIntersect2(right) ? FromIntersectRight(left, right) : IsUnion2(right) ? FromUnionRight(left, right) : IsAny2(right) ? FromAnyRight(left, right) : IsString3(right) ? FromStringRight(left, right) : IsNumber4(right) ? FromNumberRight(left, right) : IsInteger2(right) ? FromIntegerRight(left, right) : IsBoolean3(right) ? FromBooleanRight(left, right) : IsArray4(right) ? FromArrayRight(left, right) : IsTuple2(right) ? FromTupleRight(left, right) : IsObject4(right) ? FromObjectRight(left, right) : IsUnknown2(right) ? ExtendsResult.True : ExtendsResult.False;
}
function FromVoidRight(left, right) {
  return IsUndefined4(left) ? ExtendsResult.True : IsUndefined4(left) ? ExtendsResult.True : ExtendsResult.False;
}
function FromVoid(left, right) {
  return IsIntersect2(right) ? FromIntersectRight(left, right) : IsUnion2(right) ? FromUnionRight(left, right) : IsUnknown2(right) ? FromUnknownRight(left, right) : IsAny2(right) ? FromAnyRight(left, right) : IsObject4(right) ? FromObjectRight(left, right) : IsVoid2(right) ? ExtendsResult.True : ExtendsResult.False;
}
function Visit3(left, right) {
  return IsTemplateLiteral2(left) || IsTemplateLiteral2(right) ? FromTemplateLiteral2(left, right) : IsRegExp3(left) || IsRegExp3(right) ? FromRegExp(left, right) : IsNot2(left) || IsNot2(right) ? FromNot(left, right) : IsAny2(left) ? FromAny(left, right) : IsArray4(left) ? FromArray4(left, right) : IsBigInt3(left) ? FromBigInt(left, right) : IsBoolean3(left) ? FromBoolean(left, right) : IsAsyncIterator3(left) ? FromAsyncIterator(left, right) : IsConstructor2(left) ? FromConstructor(left, right) : IsDate3(left) ? FromDate(left, right) : IsFunction3(left) ? FromFunction(left, right) : IsInteger2(left) ? FromInteger(left, right) : IsIntersect2(left) ? FromIntersect4(left, right) : IsIterator3(left) ? FromIterator(left, right) : IsLiteral2(left) ? FromLiteral2(left, right) : IsNever2(left) ? FromNever(left, right) : IsNull3(left) ? FromNull(left, right) : IsNumber4(left) ? FromNumber(left, right) : IsObject4(left) ? FromObject(left, right) : IsRecord2(left) ? FromRecord(left, right) : IsString3(left) ? FromString(left, right) : IsSymbol3(left) ? FromSymbol(left, right) : IsTuple2(left) ? FromTuple3(left, right) : IsPromise2(left) ? FromPromise2(left, right) : IsUint8Array3(left) ? FromUint8Array(left, right) : IsUndefined4(left) ? FromUndefined(left, right) : IsUnion2(left) ? FromUnion6(left, right) : IsUnknown2(left) ? FromUnknown(left, right) : IsVoid2(left) ? FromVoid(left, right) : Throw(`Unknown left type operand '${left[Kind]}'`);
}
function ExtendsCheck(left, right) {
  return Visit3(left, right);
}

// node_modules/@sinclair/typebox/build/esm/type/extends/extends-from-mapped-result.mjs
function FromProperties8(P, Right, True, False, options) {
  const Acc = {};
  for (const K2 of globalThis.Object.getOwnPropertyNames(P))
    Acc[K2] = Extends(P[K2], Right, True, False, Clone(options));
  return Acc;
}
function FromMappedResult6(Left, Right, True, False, options) {
  return FromProperties8(Left.properties, Right, True, False, options);
}
function ExtendsFromMappedResult(Left, Right, True, False, options) {
  const P = FromMappedResult6(Left, Right, True, False, options);
  return MappedResult(P);
}

// node_modules/@sinclair/typebox/build/esm/type/extends/extends.mjs
function ExtendsResolve(left, right, trueType, falseType) {
  const R = ExtendsCheck(left, right);
  return R === ExtendsResult.Union ? Union([trueType, falseType]) : R === ExtendsResult.True ? trueType : falseType;
}
function Extends(L, R, T, F, options) {
  return IsMappedResult(L) ? ExtendsFromMappedResult(L, R, T, F, options) : IsMappedKey(L) ? CreateType(ExtendsFromMappedKey(L, R, T, F, options)) : CreateType(ExtendsResolve(L, R, T, F), options);
}

// node_modules/@sinclair/typebox/build/esm/type/extends/extends-from-mapped-key.mjs
function FromPropertyKey(K, U, L, R, options) {
  return {
    [K]: Extends(Literal(K), U, L, R, Clone(options))
  };
}
function FromPropertyKeys(K, U, L, R, options) {
  return K.reduce((Acc, LK) => {
    return { ...Acc, ...FromPropertyKey(LK, U, L, R, options) };
  }, {});
}
function FromMappedKey2(K, U, L, R, options) {
  return FromPropertyKeys(K.keys, U, L, R, options);
}
function ExtendsFromMappedKey(T, U, L, R, options) {
  const P = FromMappedKey2(T, U, L, R, options);
  return MappedResult(P);
}

// node_modules/@sinclair/typebox/build/esm/type/exclude/exclude-from-template-literal.mjs
function ExcludeFromTemplateLiteral(L, R) {
  return Exclude(TemplateLiteralToUnion(L), R);
}

// node_modules/@sinclair/typebox/build/esm/type/exclude/exclude.mjs
function ExcludeRest(L, R) {
  const excluded = L.filter((inner) => ExtendsCheck(inner, R) === ExtendsResult.False);
  return excluded.length === 1 ? excluded[0] : Union(excluded);
}
function Exclude(L, R, options = {}) {
  if (IsTemplateLiteral(L))
    return CreateType(ExcludeFromTemplateLiteral(L, R), options);
  if (IsMappedResult(L))
    return CreateType(ExcludeFromMappedResult(L, R), options);
  return CreateType(IsUnion(L) ? ExcludeRest(L.anyOf, R) : ExtendsCheck(L, R) !== ExtendsResult.False ? Never() : L, options);
}

// node_modules/@sinclair/typebox/build/esm/type/exclude/exclude-from-mapped-result.mjs
function FromProperties9(P, U) {
  const Acc = {};
  for (const K2 of globalThis.Object.getOwnPropertyNames(P))
    Acc[K2] = Exclude(P[K2], U);
  return Acc;
}
function FromMappedResult7(R, T) {
  return FromProperties9(R.properties, T);
}
function ExcludeFromMappedResult(R, T) {
  const P = FromMappedResult7(R, T);
  return MappedResult(P);
}

// node_modules/@sinclair/typebox/build/esm/type/extract/extract-from-template-literal.mjs
function ExtractFromTemplateLiteral(L, R) {
  return Extract(TemplateLiteralToUnion(L), R);
}

// node_modules/@sinclair/typebox/build/esm/type/extract/extract.mjs
function ExtractRest(L, R) {
  const extracted = L.filter((inner) => ExtendsCheck(inner, R) !== ExtendsResult.False);
  return extracted.length === 1 ? extracted[0] : Union(extracted);
}
function Extract(L, R, options) {
  if (IsTemplateLiteral(L))
    return CreateType(ExtractFromTemplateLiteral(L, R), options);
  if (IsMappedResult(L))
    return CreateType(ExtractFromMappedResult(L, R), options);
  return CreateType(IsUnion(L) ? ExtractRest(L.anyOf, R) : ExtendsCheck(L, R) !== ExtendsResult.False ? L : Never(), options);
}

// node_modules/@sinclair/typebox/build/esm/type/extract/extract-from-mapped-result.mjs
function FromProperties10(P, T) {
  const Acc = {};
  for (const K2 of globalThis.Object.getOwnPropertyNames(P))
    Acc[K2] = Extract(P[K2], T);
  return Acc;
}
function FromMappedResult8(R, T) {
  return FromProperties10(R.properties, T);
}
function ExtractFromMappedResult(R, T) {
  const P = FromMappedResult8(R, T);
  return MappedResult(P);
}

// node_modules/@sinclair/typebox/build/esm/type/instance-type/instance-type.mjs
function InstanceType(schema, options) {
  return IsConstructor(schema) ? CreateType(schema.returns, options) : Never(options);
}

// node_modules/@sinclair/typebox/build/esm/type/readonly-optional/readonly-optional.mjs
function ReadonlyOptional(schema) {
  return Readonly(Optional(schema));
}

// node_modules/@sinclair/typebox/build/esm/type/record/record.mjs
function RecordCreateFromPattern(pattern, T, options) {
  return CreateType({ [Kind]: "Record", type: "object", patternProperties: { [pattern]: T } }, options);
}
function RecordCreateFromKeys(K, T, options) {
  const result = {};
  for (const K2 of K)
    result[K2] = T;
  return Object2(result, { ...options, [Hint]: "Record" });
}
function FromTemplateLiteralKey(K, T, options) {
  return IsTemplateLiteralFinite(K) ? RecordCreateFromKeys(IndexPropertyKeys(K), T, options) : RecordCreateFromPattern(K.pattern, T, options);
}
function FromUnionKey(key, type, options) {
  return RecordCreateFromKeys(IndexPropertyKeys(Union(key)), type, options);
}
function FromLiteralKey(key, type, options) {
  return RecordCreateFromKeys([key.toString()], type, options);
}
function FromRegExpKey(key, type, options) {
  return RecordCreateFromPattern(key.source, type, options);
}
function FromStringKey(key, type, options) {
  const pattern = IsUndefined(key.pattern) ? PatternStringExact : key.pattern;
  return RecordCreateFromPattern(pattern, type, options);
}
function FromAnyKey(_, type, options) {
  return RecordCreateFromPattern(PatternStringExact, type, options);
}
function FromNeverKey(_key, type, options) {
  return RecordCreateFromPattern(PatternNeverExact, type, options);
}
function FromBooleanKey(_key, type, options) {
  return Object2({ true: type, false: type }, options);
}
function FromIntegerKey(_key, type, options) {
  return RecordCreateFromPattern(PatternNumberExact, type, options);
}
function FromNumberKey(_, type, options) {
  return RecordCreateFromPattern(PatternNumberExact, type, options);
}
function Record(key, type, options = {}) {
  return IsUnion(key) ? FromUnionKey(key.anyOf, type, options) : IsTemplateLiteral(key) ? FromTemplateLiteralKey(key, type, options) : IsLiteral(key) ? FromLiteralKey(key.const, type, options) : IsBoolean2(key) ? FromBooleanKey(key, type, options) : IsInteger(key) ? FromIntegerKey(key, type, options) : IsNumber3(key) ? FromNumberKey(key, type, options) : IsRegExp2(key) ? FromRegExpKey(key, type, options) : IsString2(key) ? FromStringKey(key, type, options) : IsAny(key) ? FromAnyKey(key, type, options) : IsNever(key) ? FromNeverKey(key, type, options) : Never(options);
}
function RecordPattern(record) {
  return globalThis.Object.getOwnPropertyNames(record.patternProperties)[0];
}
function RecordKey2(type) {
  const pattern = RecordPattern(type);
  return pattern === PatternStringExact ? String2() : pattern === PatternNumberExact ? Number2() : String2({ pattern });
}
function RecordValue2(type) {
  return type.patternProperties[RecordPattern(type)];
}

// node_modules/@sinclair/typebox/build/esm/type/instantiate/instantiate.mjs
function FromConstructor2(args, type) {
  type.parameters = FromTypes(args, type.parameters);
  type.returns = FromType(args, type.returns);
  return type;
}
function FromFunction2(args, type) {
  type.parameters = FromTypes(args, type.parameters);
  type.returns = FromType(args, type.returns);
  return type;
}
function FromIntersect5(args, type) {
  type.allOf = FromTypes(args, type.allOf);
  return type;
}
function FromUnion7(args, type) {
  type.anyOf = FromTypes(args, type.anyOf);
  return type;
}
function FromTuple4(args, type) {
  if (IsUndefined(type.items))
    return type;
  type.items = FromTypes(args, type.items);
  return type;
}
function FromArray5(args, type) {
  type.items = FromType(args, type.items);
  return type;
}
function FromAsyncIterator2(args, type) {
  type.items = FromType(args, type.items);
  return type;
}
function FromIterator2(args, type) {
  type.items = FromType(args, type.items);
  return type;
}
function FromPromise3(args, type) {
  type.item = FromType(args, type.item);
  return type;
}
function FromObject2(args, type) {
  const mappedProperties = FromProperties11(args, type.properties);
  return { ...type, ...Object2(mappedProperties) };
}
function FromRecord2(args, type) {
  const mappedKey = FromType(args, RecordKey2(type));
  const mappedValue = FromType(args, RecordValue2(type));
  const result = Record(mappedKey, mappedValue);
  return { ...type, ...result };
}
function FromArgument(args, argument) {
  return argument.index in args ? args[argument.index] : Unknown();
}
function FromProperty2(args, type) {
  const isReadonly = IsReadonly(type);
  const isOptional = IsOptional(type);
  const mapped = FromType(args, type);
  return isReadonly && isOptional ? ReadonlyOptional(mapped) : isReadonly && !isOptional ? Readonly(mapped) : !isReadonly && isOptional ? Optional(mapped) : mapped;
}
function FromProperties11(args, properties) {
  return globalThis.Object.getOwnPropertyNames(properties).reduce((result, key) => {
    return { ...result, [key]: FromProperty2(args, properties[key]) };
  }, {});
}
function FromTypes(args, types) {
  return types.map((type) => FromType(args, type));
}
function FromType(args, type) {
  return IsConstructor(type) ? FromConstructor2(args, type) : IsFunction2(type) ? FromFunction2(args, type) : IsIntersect(type) ? FromIntersect5(args, type) : IsUnion(type) ? FromUnion7(args, type) : IsTuple(type) ? FromTuple4(args, type) : IsArray3(type) ? FromArray5(args, type) : IsAsyncIterator2(type) ? FromAsyncIterator2(args, type) : IsIterator2(type) ? FromIterator2(args, type) : IsPromise(type) ? FromPromise3(args, type) : IsObject3(type) ? FromObject2(args, type) : IsRecord(type) ? FromRecord2(args, type) : IsArgument(type) ? FromArgument(args, type) : type;
}
function Instantiate(type, args) {
  return FromType(args, CloneType(type));
}

// node_modules/@sinclair/typebox/build/esm/type/integer/integer.mjs
function Integer(options) {
  return CreateType({ [Kind]: "Integer", type: "integer" }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/intrinsic/intrinsic-from-mapped-key.mjs
function MappedIntrinsicPropertyKey(K, M, options) {
  return {
    [K]: Intrinsic(Literal(K), M, Clone(options))
  };
}
function MappedIntrinsicPropertyKeys(K, M, options) {
  const result = K.reduce((Acc, L) => {
    return { ...Acc, ...MappedIntrinsicPropertyKey(L, M, options) };
  }, {});
  return result;
}
function MappedIntrinsicProperties(T, M, options) {
  return MappedIntrinsicPropertyKeys(T["keys"], M, options);
}
function IntrinsicFromMappedKey(T, M, options) {
  const P = MappedIntrinsicProperties(T, M, options);
  return MappedResult(P);
}

// node_modules/@sinclair/typebox/build/esm/type/intrinsic/intrinsic.mjs
function ApplyUncapitalize(value) {
  const [first, rest] = [value.slice(0, 1), value.slice(1)];
  return [first.toLowerCase(), rest].join("");
}
function ApplyCapitalize(value) {
  const [first, rest] = [value.slice(0, 1), value.slice(1)];
  return [first.toUpperCase(), rest].join("");
}
function ApplyUppercase(value) {
  return value.toUpperCase();
}
function ApplyLowercase(value) {
  return value.toLowerCase();
}
function FromTemplateLiteral3(schema, mode, options) {
  const expression = TemplateLiteralParseExact(schema.pattern);
  const finite = IsTemplateLiteralExpressionFinite(expression);
  if (!finite)
    return { ...schema, pattern: FromLiteralValue(schema.pattern, mode) };
  const strings = [...TemplateLiteralExpressionGenerate(expression)];
  const literals = strings.map((value) => Literal(value));
  const mapped = FromRest5(literals, mode);
  const union = Union(mapped);
  return TemplateLiteral([union], options);
}
function FromLiteralValue(value, mode) {
  return typeof value === "string" ? mode === "Uncapitalize" ? ApplyUncapitalize(value) : mode === "Capitalize" ? ApplyCapitalize(value) : mode === "Uppercase" ? ApplyUppercase(value) : mode === "Lowercase" ? ApplyLowercase(value) : value : value.toString();
}
function FromRest5(T, M) {
  return T.map((L) => Intrinsic(L, M));
}
function Intrinsic(schema, mode, options = {}) {
  return IsMappedKey(schema) ? IntrinsicFromMappedKey(schema, mode, options) : IsTemplateLiteral(schema) ? FromTemplateLiteral3(schema, mode, options) : IsUnion(schema) ? Union(FromRest5(schema.anyOf, mode), options) : IsLiteral(schema) ? Literal(FromLiteralValue(schema.const, mode), options) : CreateType(schema, options);
}

// node_modules/@sinclair/typebox/build/esm/type/intrinsic/capitalize.mjs
function Capitalize(T, options = {}) {
  return Intrinsic(T, "Capitalize", options);
}

// node_modules/@sinclair/typebox/build/esm/type/intrinsic/lowercase.mjs
function Lowercase(T, options = {}) {
  return Intrinsic(T, "Lowercase", options);
}

// node_modules/@sinclair/typebox/build/esm/type/intrinsic/uncapitalize.mjs
function Uncapitalize(T, options = {}) {
  return Intrinsic(T, "Uncapitalize", options);
}

// node_modules/@sinclair/typebox/build/esm/type/intrinsic/uppercase.mjs
function Uppercase(T, options = {}) {
  return Intrinsic(T, "Uppercase", options);
}

// node_modules/@sinclair/typebox/build/esm/type/omit/omit-from-mapped-result.mjs
function FromProperties12(properties, propertyKeys, options) {
  const result = {};
  for (const K2 of globalThis.Object.getOwnPropertyNames(properties))
    result[K2] = Omit(properties[K2], propertyKeys, Clone(options));
  return result;
}
function FromMappedResult9(mappedResult, propertyKeys, options) {
  return FromProperties12(mappedResult.properties, propertyKeys, options);
}
function OmitFromMappedResult(mappedResult, propertyKeys, options) {
  const properties = FromMappedResult9(mappedResult, propertyKeys, options);
  return MappedResult(properties);
}

// node_modules/@sinclair/typebox/build/esm/type/omit/omit.mjs
function FromIntersect6(types, propertyKeys) {
  return types.map((type) => OmitResolve(type, propertyKeys));
}
function FromUnion8(types, propertyKeys) {
  return types.map((type) => OmitResolve(type, propertyKeys));
}
function FromProperty3(properties, key) {
  const { [key]: _, ...R } = properties;
  return R;
}
function FromProperties13(properties, propertyKeys) {
  return propertyKeys.reduce((T, K2) => FromProperty3(T, K2), properties);
}
function FromObject3(type, propertyKeys, properties) {
  const options = Discard(type, [TransformKind, "$id", "required", "properties"]);
  const mappedProperties = FromProperties13(properties, propertyKeys);
  return Object2(mappedProperties, options);
}
function UnionFromPropertyKeys(propertyKeys) {
  const result = propertyKeys.reduce((result, key) => IsLiteralValue(key) ? [...result, Literal(key)] : result, []);
  return Union(result);
}
function OmitResolve(type, propertyKeys) {
  return IsIntersect(type) ? Intersect(FromIntersect6(type.allOf, propertyKeys)) : IsUnion(type) ? Union(FromUnion8(type.anyOf, propertyKeys)) : IsObject3(type) ? FromObject3(type, propertyKeys, type.properties) : Object2({});
}
function Omit(type, key, options) {
  const typeKey = IsArray(key) ? UnionFromPropertyKeys(key) : key;
  const propertyKeys = IsSchema(key) ? IndexPropertyKeys(key) : key;
  const isTypeRef = IsRef(type);
  const isKeyRef = IsRef(key);
  return IsMappedResult(type) ? OmitFromMappedResult(type, propertyKeys, options) : IsMappedKey(key) ? OmitFromMappedKey(type, key, options) : isTypeRef && isKeyRef ? Computed("Omit", [type, typeKey], options) : !isTypeRef && isKeyRef ? Computed("Omit", [type, typeKey], options) : isTypeRef && !isKeyRef ? Computed("Omit", [type, typeKey], options) : CreateType({ ...OmitResolve(type, propertyKeys), ...options });
}

// node_modules/@sinclair/typebox/build/esm/type/omit/omit-from-mapped-key.mjs
function FromPropertyKey2(type, key, options) {
  return { [key]: Omit(type, [key], Clone(options)) };
}
function FromPropertyKeys2(type, propertyKeys, options) {
  return propertyKeys.reduce((Acc, LK) => {
    return { ...Acc, ...FromPropertyKey2(type, LK, options) };
  }, {});
}
function FromMappedKey3(type, mappedKey, options) {
  return FromPropertyKeys2(type, mappedKey.keys, options);
}
function OmitFromMappedKey(type, mappedKey, options) {
  const properties = FromMappedKey3(type, mappedKey, options);
  return MappedResult(properties);
}

// node_modules/@sinclair/typebox/build/esm/type/pick/pick-from-mapped-result.mjs
function FromProperties14(properties, propertyKeys, options) {
  const result = {};
  for (const K2 of globalThis.Object.getOwnPropertyNames(properties))
    result[K2] = Pick(properties[K2], propertyKeys, Clone(options));
  return result;
}
function FromMappedResult10(mappedResult, propertyKeys, options) {
  return FromProperties14(mappedResult.properties, propertyKeys, options);
}
function PickFromMappedResult(mappedResult, propertyKeys, options) {
  const properties = FromMappedResult10(mappedResult, propertyKeys, options);
  return MappedResult(properties);
}

// node_modules/@sinclair/typebox/build/esm/type/pick/pick.mjs
function FromIntersect7(types, propertyKeys) {
  return types.map((type) => PickResolve(type, propertyKeys));
}
function FromUnion9(types, propertyKeys) {
  return types.map((type) => PickResolve(type, propertyKeys));
}
function FromProperties15(properties, propertyKeys) {
  const result = {};
  for (const K2 of propertyKeys)
    if (K2 in properties)
      result[K2] = properties[K2];
  return result;
}
function FromObject4(Type, keys, properties) {
  const options = Discard(Type, [TransformKind, "$id", "required", "properties"]);
  const mappedProperties = FromProperties15(properties, keys);
  return Object2(mappedProperties, options);
}
function UnionFromPropertyKeys2(propertyKeys) {
  const result = propertyKeys.reduce((result, key) => IsLiteralValue(key) ? [...result, Literal(key)] : result, []);
  return Union(result);
}
function PickResolve(type, propertyKeys) {
  return IsIntersect(type) ? Intersect(FromIntersect7(type.allOf, propertyKeys)) : IsUnion(type) ? Union(FromUnion9(type.anyOf, propertyKeys)) : IsObject3(type) ? FromObject4(type, propertyKeys, type.properties) : Object2({});
}
function Pick(type, key, options) {
  const typeKey = IsArray(key) ? UnionFromPropertyKeys2(key) : key;
  const propertyKeys = IsSchema(key) ? IndexPropertyKeys(key) : key;
  const isTypeRef = IsRef(type);
  const isKeyRef = IsRef(key);
  return IsMappedResult(type) ? PickFromMappedResult(type, propertyKeys, options) : IsMappedKey(key) ? PickFromMappedKey(type, key, options) : isTypeRef && isKeyRef ? Computed("Pick", [type, typeKey], options) : !isTypeRef && isKeyRef ? Computed("Pick", [type, typeKey], options) : isTypeRef && !isKeyRef ? Computed("Pick", [type, typeKey], options) : CreateType({ ...PickResolve(type, propertyKeys), ...options });
}

// node_modules/@sinclair/typebox/build/esm/type/pick/pick-from-mapped-key.mjs
function FromPropertyKey3(type, key, options) {
  return {
    [key]: Pick(type, [key], Clone(options))
  };
}
function FromPropertyKeys3(type, propertyKeys, options) {
  return propertyKeys.reduce((result, leftKey) => {
    return { ...result, ...FromPropertyKey3(type, leftKey, options) };
  }, {});
}
function FromMappedKey4(type, mappedKey, options) {
  return FromPropertyKeys3(type, mappedKey.keys, options);
}
function PickFromMappedKey(type, mappedKey, options) {
  const properties = FromMappedKey4(type, mappedKey, options);
  return MappedResult(properties);
}

// node_modules/@sinclair/typebox/build/esm/type/partial/partial.mjs
function FromComputed3(target, parameters) {
  return Computed("Partial", [Computed(target, parameters)]);
}
function FromRef3($ref) {
  return Computed("Partial", [Ref($ref)]);
}
function FromProperties16(properties) {
  const partialProperties = {};
  for (const K of globalThis.Object.getOwnPropertyNames(properties))
    partialProperties[K] = Optional(properties[K]);
  return partialProperties;
}
function FromObject5(type, properties) {
  const options = Discard(type, [TransformKind, "$id", "required", "properties"]);
  const mappedProperties = FromProperties16(properties);
  return Object2(mappedProperties, options);
}
function FromRest6(types) {
  return types.map((type) => PartialResolve(type));
}
function PartialResolve(type) {
  return IsComputed(type) ? FromComputed3(type.target, type.parameters) : IsRef(type) ? FromRef3(type.$ref) : IsIntersect(type) ? Intersect(FromRest6(type.allOf)) : IsUnion(type) ? Union(FromRest6(type.anyOf)) : IsObject3(type) ? FromObject5(type, type.properties) : IsBigInt2(type) ? type : IsBoolean2(type) ? type : IsInteger(type) ? type : IsLiteral(type) ? type : IsNull2(type) ? type : IsNumber3(type) ? type : IsString2(type) ? type : IsSymbol2(type) ? type : IsUndefined3(type) ? type : Object2({});
}
function Partial(type, options) {
  if (IsMappedResult(type)) {
    return PartialFromMappedResult(type, options);
  } else {
    return CreateType({ ...PartialResolve(type), ...options });
  }
}

// node_modules/@sinclair/typebox/build/esm/type/partial/partial-from-mapped-result.mjs
function FromProperties17(K, options) {
  const Acc = {};
  for (const K2 of globalThis.Object.getOwnPropertyNames(K))
    Acc[K2] = Partial(K[K2], Clone(options));
  return Acc;
}
function FromMappedResult11(R, options) {
  return FromProperties17(R.properties, options);
}
function PartialFromMappedResult(R, options) {
  const P = FromMappedResult11(R, options);
  return MappedResult(P);
}

// node_modules/@sinclair/typebox/build/esm/type/required/required.mjs
function FromComputed4(target, parameters) {
  return Computed("Required", [Computed(target, parameters)]);
}
function FromRef4($ref) {
  return Computed("Required", [Ref($ref)]);
}
function FromProperties18(properties) {
  const requiredProperties = {};
  for (const K of globalThis.Object.getOwnPropertyNames(properties))
    requiredProperties[K] = Discard(properties[K], [OptionalKind]);
  return requiredProperties;
}
function FromObject6(type, properties) {
  const options = Discard(type, [TransformKind, "$id", "required", "properties"]);
  const mappedProperties = FromProperties18(properties);
  return Object2(mappedProperties, options);
}
function FromRest7(types) {
  return types.map((type) => RequiredResolve(type));
}
function RequiredResolve(type) {
  return IsComputed(type) ? FromComputed4(type.target, type.parameters) : IsRef(type) ? FromRef4(type.$ref) : IsIntersect(type) ? Intersect(FromRest7(type.allOf)) : IsUnion(type) ? Union(FromRest7(type.anyOf)) : IsObject3(type) ? FromObject6(type, type.properties) : IsBigInt2(type) ? type : IsBoolean2(type) ? type : IsInteger(type) ? type : IsLiteral(type) ? type : IsNull2(type) ? type : IsNumber3(type) ? type : IsString2(type) ? type : IsSymbol2(type) ? type : IsUndefined3(type) ? type : Object2({});
}
function Required(type, options) {
  if (IsMappedResult(type)) {
    return RequiredFromMappedResult(type, options);
  } else {
    return CreateType({ ...RequiredResolve(type), ...options });
  }
}

// node_modules/@sinclair/typebox/build/esm/type/required/required-from-mapped-result.mjs
function FromProperties19(P, options) {
  const Acc = {};
  for (const K2 of globalThis.Object.getOwnPropertyNames(P))
    Acc[K2] = Required(P[K2], options);
  return Acc;
}
function FromMappedResult12(R, options) {
  return FromProperties19(R.properties, options);
}
function RequiredFromMappedResult(R, options) {
  const P = FromMappedResult12(R, options);
  return MappedResult(P);
}

// node_modules/@sinclair/typebox/build/esm/type/module/compute.mjs
function DereferenceParameters(moduleProperties, types) {
  return types.map((type) => {
    return IsRef(type) ? Dereference(moduleProperties, type.$ref) : FromType2(moduleProperties, type);
  });
}
function Dereference(moduleProperties, ref) {
  return ref in moduleProperties ? IsRef(moduleProperties[ref]) ? Dereference(moduleProperties, moduleProperties[ref].$ref) : FromType2(moduleProperties, moduleProperties[ref]) : Never();
}
function FromAwaited(parameters) {
  return Awaited(parameters[0]);
}
function FromIndex(parameters) {
  return Index(parameters[0], parameters[1]);
}
function FromKeyOf(parameters) {
  return KeyOf(parameters[0]);
}
function FromPartial(parameters) {
  return Partial(parameters[0]);
}
function FromOmit(parameters) {
  return Omit(parameters[0], parameters[1]);
}
function FromPick(parameters) {
  return Pick(parameters[0], parameters[1]);
}
function FromRequired(parameters) {
  return Required(parameters[0]);
}
function FromComputed5(moduleProperties, target, parameters) {
  const dereferenced = DereferenceParameters(moduleProperties, parameters);
  return target === "Awaited" ? FromAwaited(dereferenced) : target === "Index" ? FromIndex(dereferenced) : target === "KeyOf" ? FromKeyOf(dereferenced) : target === "Partial" ? FromPartial(dereferenced) : target === "Omit" ? FromOmit(dereferenced) : target === "Pick" ? FromPick(dereferenced) : target === "Required" ? FromRequired(dereferenced) : Never();
}
function FromArray6(moduleProperties, type) {
  return Array2(FromType2(moduleProperties, type));
}
function FromAsyncIterator3(moduleProperties, type) {
  return AsyncIterator(FromType2(moduleProperties, type));
}
function FromConstructor3(moduleProperties, parameters, instanceType) {
  return Constructor(FromTypes2(moduleProperties, parameters), FromType2(moduleProperties, instanceType));
}
function FromFunction3(moduleProperties, parameters, returnType) {
  return Function(FromTypes2(moduleProperties, parameters), FromType2(moduleProperties, returnType));
}
function FromIntersect8(moduleProperties, types) {
  return Intersect(FromTypes2(moduleProperties, types));
}
function FromIterator3(moduleProperties, type) {
  return Iterator(FromType2(moduleProperties, type));
}
function FromObject7(moduleProperties, properties) {
  return Object2(globalThis.Object.keys(properties).reduce((result, key) => {
    return { ...result, [key]: FromType2(moduleProperties, properties[key]) };
  }, {}));
}
function FromRecord3(moduleProperties, type) {
  const [value, pattern] = [FromType2(moduleProperties, RecordValue2(type)), RecordPattern(type)];
  const result = CloneType(type);
  result.patternProperties[pattern] = value;
  return result;
}
function FromTransform(moduleProperties, transform) {
  return IsRef(transform) ? { ...Dereference(moduleProperties, transform.$ref), [TransformKind]: transform[TransformKind] } : transform;
}
function FromTuple5(moduleProperties, types) {
  return Tuple(FromTypes2(moduleProperties, types));
}
function FromUnion10(moduleProperties, types) {
  return Union(FromTypes2(moduleProperties, types));
}
function FromTypes2(moduleProperties, types) {
  return types.map((type) => FromType2(moduleProperties, type));
}
function FromType2(moduleProperties, type) {
  return IsOptional(type) ? CreateType(FromType2(moduleProperties, Discard(type, [OptionalKind])), type) : IsReadonly(type) ? CreateType(FromType2(moduleProperties, Discard(type, [ReadonlyKind])), type) : IsTransform(type) ? CreateType(FromTransform(moduleProperties, type), type) : IsArray3(type) ? CreateType(FromArray6(moduleProperties, type.items), type) : IsAsyncIterator2(type) ? CreateType(FromAsyncIterator3(moduleProperties, type.items), type) : IsComputed(type) ? CreateType(FromComputed5(moduleProperties, type.target, type.parameters)) : IsConstructor(type) ? CreateType(FromConstructor3(moduleProperties, type.parameters, type.returns), type) : IsFunction2(type) ? CreateType(FromFunction3(moduleProperties, type.parameters, type.returns), type) : IsIntersect(type) ? CreateType(FromIntersect8(moduleProperties, type.allOf), type) : IsIterator2(type) ? CreateType(FromIterator3(moduleProperties, type.items), type) : IsObject3(type) ? CreateType(FromObject7(moduleProperties, type.properties), type) : IsRecord(type) ? CreateType(FromRecord3(moduleProperties, type)) : IsTuple(type) ? CreateType(FromTuple5(moduleProperties, type.items || []), type) : IsUnion(type) ? CreateType(FromUnion10(moduleProperties, type.anyOf), type) : type;
}
function ComputeType(moduleProperties, key) {
  return key in moduleProperties ? FromType2(moduleProperties, moduleProperties[key]) : Never();
}
function ComputeModuleProperties(moduleProperties) {
  return globalThis.Object.getOwnPropertyNames(moduleProperties).reduce((result, key) => {
    return { ...result, [key]: ComputeType(moduleProperties, key) };
  }, {});
}

// node_modules/@sinclair/typebox/build/esm/type/module/module.mjs
class TModule {
  constructor($defs) {
    const computed = ComputeModuleProperties($defs);
    const identified = this.WithIdentifiers(computed);
    this.$defs = identified;
  }
  Import(key, options) {
    const $defs = { ...this.$defs, [key]: CreateType(this.$defs[key], options) };
    return CreateType({ [Kind]: "Import", $defs, $ref: key });
  }
  WithIdentifiers($defs) {
    return globalThis.Object.getOwnPropertyNames($defs).reduce((result, key) => {
      return { ...result, [key]: { ...$defs[key], $id: key } };
    }, {});
  }
}
function Module(properties) {
  return new TModule(properties);
}

// node_modules/@sinclair/typebox/build/esm/type/not/not.mjs
function Not(type, options) {
  return CreateType({ [Kind]: "Not", not: type }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/parameters/parameters.mjs
function Parameters(schema, options) {
  return IsFunction2(schema) ? Tuple(schema.parameters, options) : Never();
}

// node_modules/@sinclair/typebox/build/esm/type/recursive/recursive.mjs
var Ordinal = 0;
function Recursive(callback, options = {}) {
  if (IsUndefined(options.$id))
    options.$id = `T${Ordinal++}`;
  const thisType = CloneType(callback({ [Kind]: "This", $ref: `${options.$id}` }));
  thisType.$id = options.$id;
  return CreateType({ [Hint]: "Recursive", ...thisType }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/regexp/regexp.mjs
function RegExp2(unresolved, options) {
  const expr = IsString(unresolved) ? new globalThis.RegExp(unresolved) : unresolved;
  return CreateType({ [Kind]: "RegExp", type: "RegExp", source: expr.source, flags: expr.flags }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/rest/rest.mjs
function RestResolve(T) {
  return IsIntersect(T) ? T.allOf : IsUnion(T) ? T.anyOf : IsTuple(T) ? T.items ?? [] : [];
}
function Rest(T) {
  return RestResolve(T);
}

// node_modules/@sinclair/typebox/build/esm/type/return-type/return-type.mjs
function ReturnType(schema, options) {
  return IsFunction2(schema) ? CreateType(schema.returns, options) : Never(options);
}

// node_modules/@sinclair/typebox/build/esm/type/transform/transform.mjs
class TransformDecodeBuilder {
  constructor(schema) {
    this.schema = schema;
  }
  Decode(decode) {
    return new TransformEncodeBuilder(this.schema, decode);
  }
}

class TransformEncodeBuilder {
  constructor(schema, decode) {
    this.schema = schema;
    this.decode = decode;
  }
  EncodeTransform(encode, schema) {
    const Encode = (value) => schema[TransformKind].Encode(encode(value));
    const Decode = (value) => this.decode(schema[TransformKind].Decode(value));
    const Codec = { Encode, Decode };
    return { ...schema, [TransformKind]: Codec };
  }
  EncodeSchema(encode, schema) {
    const Codec = { Decode: this.decode, Encode: encode };
    return { ...schema, [TransformKind]: Codec };
  }
  Encode(encode) {
    return IsTransform(this.schema) ? this.EncodeTransform(encode, this.schema) : this.EncodeSchema(encode, this.schema);
  }
}
function Transform(schema) {
  return new TransformDecodeBuilder(schema);
}

// node_modules/@sinclair/typebox/build/esm/type/unsafe/unsafe.mjs
function Unsafe(options = {}) {
  return CreateType({ [Kind]: options[Kind] ?? "Unsafe" }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/void/void.mjs
function Void(options) {
  return CreateType({ [Kind]: "Void", type: "void" }, options);
}

// node_modules/@sinclair/typebox/build/esm/type/type/type.mjs
var exports_type2 = {};
__export(exports_type2, {
  Any: () => Any,
  Argument: () => Argument,
  Array: () => Array2,
  AsyncIterator: () => AsyncIterator,
  Awaited: () => Awaited,
  BigInt: () => BigInt,
  Boolean: () => Boolean2,
  Capitalize: () => Capitalize,
  Composite: () => Composite,
  Const: () => Const,
  Constructor: () => Constructor,
  ConstructorParameters: () => ConstructorParameters,
  Date: () => Date2,
  Enum: () => Enum,
  Exclude: () => Exclude,
  Extends: () => Extends,
  Extract: () => Extract,
  Function: () => Function,
  Index: () => Index,
  InstanceType: () => InstanceType,
  Instantiate: () => Instantiate,
  Integer: () => Integer,
  Intersect: () => Intersect,
  Iterator: () => Iterator,
  KeyOf: () => KeyOf,
  Literal: () => Literal,
  Lowercase: () => Lowercase,
  Mapped: () => Mapped,
  Module: () => Module,
  Never: () => Never,
  Not: () => Not,
  Null: () => Null,
  Number: () => Number2,
  Object: () => Object2,
  Omit: () => Omit,
  Optional: () => Optional,
  Parameters: () => Parameters,
  Partial: () => Partial,
  Pick: () => Pick,
  Promise: () => Promise2,
  Readonly: () => Readonly,
  ReadonlyOptional: () => ReadonlyOptional,
  Record: () => Record,
  Recursive: () => Recursive,
  Ref: () => Ref,
  RegExp: () => RegExp2,
  Required: () => Required,
  Rest: () => Rest,
  ReturnType: () => ReturnType,
  String: () => String2,
  Symbol: () => Symbol2,
  TemplateLiteral: () => TemplateLiteral,
  Transform: () => Transform,
  Tuple: () => Tuple,
  Uint8Array: () => Uint8Array2,
  Uncapitalize: () => Uncapitalize,
  Undefined: () => Undefined,
  Union: () => Union,
  Unknown: () => Unknown,
  Unsafe: () => Unsafe,
  Uppercase: () => Uppercase,
  Void: () => Void
});

// node_modules/@sinclair/typebox/build/esm/type/type/index.mjs
var Type = exports_type2;

// .pi/extensions/passive-ui/src/passive-ui.ts
import { Text as Text3 } from "@earendil-works/pi-tui";

// .pi/extensions/passive-ui/src/basic-tool-grouping.ts
import { Text } from "@earendil-works/pi-tui";

// .pi/extensions/_shared/tool-execution-patch.ts
import { FooterComponent, ToolExecutionComponent } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

// .pi/extensions/_shared/little-coder-config.ts
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
var DEFAULT_LITTLE_CODER_SETTINGS = {
  roles: {
    voice_model: undefined,
    mind_model: undefined,
    hands_model: undefined,
    default_role: "hands",
    auto_turn_transition: true
  },
  effort: {
    voice_budget: 0,
    mind_budget: 8192,
    hands_budget: 1024,
    dynamic_intent: true
  },
  tools: {
    discrete_tools: false,
    readonly: false,
    disabled_tools: [],
    enabled_tools: undefined
  },
  watchdog: {
    enabled: true,
    threshold: 80
  },
  turn_cap: {
    max_turns: 40,
    warn_remaining: 5
  },
  shell: {
    async_grace_ms: 15000,
    semi_async: true,
    default_silence_ms: 30000
  },
  statusline: "minimal",
  statusline_items: {
    cwd: true,
    model: true,
    context: true,
    tokens: false,
    cost: false,
    extension_status: true
  },
  fixed_model: false
};
function readJsonFile(filePath) {
  if (!existsSync(filePath))
    return null;
  try {
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function loadLittleCoderSettings(workspaceDir = process.cwd()) {
  const result = JSON.parse(JSON.stringify(DEFAULT_LITTLE_CODER_SETTINGS));
  const userSettingsPath = join(homedir(), ".pi", "agent", "settings.json");
  const userSettings = readJsonFile(userSettingsPath);
  if (userSettings?.little_coder) {
    applyJsonConfig(result, userSettings.little_coder);
  }
  const wsSettingsPath = join(workspaceDir, ".pi", "settings.json");
  const wsSettings = readJsonFile(wsSettingsPath);
  if (wsSettings?.little_coder) {
    applyJsonConfig(result, wsSettings.little_coder);
  }
  applyEnvOverrides(result);
  return result;
}
function saveStatuslineSetting(mode, items, workspaceDir = process.cwd()) {
  try {
    const wsSettingsPath = join(workspaceDir, ".pi", "settings.json");
    let wsSettings = {};
    if (existsSync(wsSettingsPath)) {
      wsSettings = readJsonFile(wsSettingsPath) || {};
    }
    if (!wsSettings.little_coder || typeof wsSettings.little_coder !== "object") {
      wsSettings.little_coder = {};
    }
    wsSettings.little_coder.statusline = mode;
    if (items) {
      wsSettings.little_coder.statusline_items = items;
    }
    writeFileSync(wsSettingsPath, JSON.stringify(wsSettings, null, 2) + `
`, "utf-8");
    return true;
  } catch {
    return false;
  }
}
function applyJsonConfig(target, src) {
  if (typeof src !== "object" || src === null)
    return;
  if (src.roles) {
    if (typeof src.roles.voice_model === "string")
      target.roles.voice_model = src.roles.voice_model;
    if (typeof src.roles.mind_model === "string")
      target.roles.mind_model = src.roles.mind_model;
    if (typeof src.roles.hands_model === "string")
      target.roles.hands_model = src.roles.hands_model;
    if (["voice", "mind", "hands"].includes(src.roles.default_role))
      target.roles.default_role = src.roles.default_role;
    if (typeof src.roles.auto_turn_transition === "boolean")
      target.roles.auto_turn_transition = src.roles.auto_turn_transition;
  }
  if (src.effort) {
    if (typeof src.effort.voice_budget === "number")
      target.effort.voice_budget = src.effort.voice_budget;
    if (typeof src.effort.mind_budget === "number")
      target.effort.mind_budget = src.effort.mind_budget;
    if (typeof src.effort.hands_budget === "number")
      target.effort.hands_budget = src.effort.hands_budget;
    if (typeof src.effort.dynamic_intent === "boolean")
      target.effort.dynamic_intent = src.effort.dynamic_intent;
  }
  if (src.tools) {
    if (typeof src.tools.discrete_tools === "boolean")
      target.tools.discrete_tools = src.tools.discrete_tools;
    if (typeof src.tools.readonly === "boolean")
      target.tools.readonly = src.tools.readonly;
    if (Array.isArray(src.tools.disabled_tools))
      target.tools.disabled_tools = src.tools.disabled_tools;
    if (Array.isArray(src.tools.enabled_tools))
      target.tools.enabled_tools = src.tools.enabled_tools;
  }
  if (src.watchdog) {
    if (typeof src.watchdog.enabled === "boolean")
      target.watchdog.enabled = src.watchdog.enabled;
    if (typeof src.watchdog.threshold === "number")
      target.watchdog.threshold = src.watchdog.threshold;
  }
  if (src.turn_cap) {
    if (typeof src.turn_cap.max_turns === "number")
      target.turn_cap.max_turns = src.turn_cap.max_turns;
    if (typeof src.turn_cap.warn_remaining === "number")
      target.turn_cap.warn_remaining = src.turn_cap.warn_remaining;
  }
  if (src.shell) {
    if (typeof src.shell.async_grace_ms === "number")
      target.shell.async_grace_ms = src.shell.async_grace_ms;
    if (typeof src.shell.semi_async === "boolean")
      target.shell.semi_async = src.shell.semi_async;
    if (typeof src.shell.default_silence_ms === "number")
      target.shell.default_silence_ms = src.shell.default_silence_ms;
  }
  if (typeof src.statusline === "string" && ["minimal", "standard", "full", "custom", "off"].includes(src.statusline)) {
    target.statusline = src.statusline;
  }
  if (src.statusline_items && typeof src.statusline_items === "object") {
    target.statusline_items = {
      cwd: typeof src.statusline_items.cwd === "boolean" ? src.statusline_items.cwd : target.statusline_items?.cwd ?? true,
      model: typeof src.statusline_items.model === "boolean" ? src.statusline_items.model : target.statusline_items?.model ?? true,
      context: typeof src.statusline_items.context === "boolean" ? src.statusline_items.context : target.statusline_items?.context ?? true,
      tokens: typeof src.statusline_items.tokens === "boolean" ? src.statusline_items.tokens : target.statusline_items?.tokens ?? false,
      cost: typeof src.statusline_items.cost === "boolean" ? src.statusline_items.cost : target.statusline_items?.cost ?? false,
      extension_status: typeof src.statusline_items.extension_status === "boolean" ? src.statusline_items.extension_status : target.statusline_items?.extension_status ?? true
    };
  }
  if (typeof src.fixed_model === "boolean") {
    target.fixed_model = src.fixed_model;
  }
}
function applyEnvOverrides(target) {
  const env = process.env;
  if (env.LITTLE_CODER_VOICE_MODEL)
    target.roles.voice_model = env.LITTLE_CODER_VOICE_MODEL;
  if (env.LITTLE_CODER_MIND_MODEL || env.LITTLE_CODER_PLAN_MODEL) {
    target.roles.mind_model = env.LITTLE_CODER_MIND_MODEL || env.LITTLE_CODER_PLAN_MODEL;
  }
  if (env.LITTLE_CODER_HANDS_MODEL || env.LITTLE_CODER_ACTION_MODEL) {
    target.roles.hands_model = env.LITTLE_CODER_HANDS_MODEL || env.LITTLE_CODER_ACTION_MODEL;
  }
  if (env.LITTLE_CODER_ROLE && ["voice", "mind", "hands"].includes(env.LITTLE_CODER_ROLE)) {
    target.roles.default_role = env.LITTLE_CODER_ROLE;
  }
  if (env.LITTLE_CODER_AUTO_TURN_TRANSITION) {
    target.roles.auto_turn_transition = env.LITTLE_CODER_AUTO_TURN_TRANSITION !== "0" && env.LITTLE_CODER_AUTO_TURN_TRANSITION !== "false";
  }
  if (env.LITTLE_CODER_VOICE_BUDGET)
    target.effort.voice_budget = parseInt(env.LITTLE_CODER_VOICE_BUDGET, 10);
  if (env.LITTLE_CODER_MIND_BUDGET)
    target.effort.mind_budget = parseInt(env.LITTLE_CODER_MIND_BUDGET, 10);
  if (env.LITTLE_CODER_HANDS_BUDGET)
    target.effort.hands_budget = parseInt(env.LITTLE_CODER_HANDS_BUDGET, 10);
  if (env.LITTLE_CODER_DYNAMIC_EFFORT) {
    target.effort.dynamic_intent = env.LITTLE_CODER_DYNAMIC_EFFORT !== "0" && env.LITTLE_CODER_DYNAMIC_EFFORT !== "false";
  }
  if (env.PI_DISCRETE_TOOLS === "1" || env.LITTLE_CODER_DISCRETE_TOOLS === "1") {
    target.tools.discrete_tools = true;
  }
  if (env.LITTLE_CODER_READONLY === "1" || env.LITTLE_CODER_READONLY === "true") {
    target.tools.readonly = true;
  }
  if (env.LITTLE_CODER_DISABLED_TOOLS) {
    target.tools.disabled_tools = env.LITTLE_CODER_DISABLED_TOOLS.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (env.LITTLE_CODER_ENABLED_TOOLS) {
    target.tools.enabled_tools = env.LITTLE_CODER_ENABLED_TOOLS.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (env.LITTLE_CODER_WATCHDOG_THRESHOLD) {
    target.watchdog.threshold = parseInt(env.LITTLE_CODER_WATCHDOG_THRESHOLD, 10);
  }
  if (env.LITTLE_CODER_WATCHDOG_ENABLED) {
    target.watchdog.enabled = env.LITTLE_CODER_WATCHDOG_ENABLED !== "0" && env.LITTLE_CODER_WATCHDOG_ENABLED !== "false";
  }
  if (env.LITTLE_CODER_MAX_TURNS) {
    target.turn_cap.max_turns = parseInt(env.LITTLE_CODER_MAX_TURNS, 10);
  }
  if (env.LITTLE_CODER_WARN_REMAINING) {
    target.turn_cap.warn_remaining = parseInt(env.LITTLE_CODER_WARN_REMAINING, 10);
  }
  if (env.LITTLE_CODER_SHELL_ASYNC_GRACE_MS) {
    target.shell.async_grace_ms = parseInt(env.LITTLE_CODER_SHELL_ASYNC_GRACE_MS, 10);
  }
  if (env.LITTLE_CODER_SEMI_ASYNC) {
    target.shell.semi_async = env.LITTLE_CODER_SEMI_ASYNC !== "0" && env.LITTLE_CODER_SEMI_ASYNC !== "false";
  }
  if (env.LITTLE_CODER_SHELL_SILENCE_MS) {
    target.shell.default_silence_ms = parseInt(env.LITTLE_CODER_SHELL_SILENCE_MS, 10);
  }
  if (env.LITTLE_CODER_STATUSLINE && ["minimal", "standard", "full", "custom", "off"].includes(env.LITTLE_CODER_STATUSLINE)) {
    target.statusline = env.LITTLE_CODER_STATUSLINE;
  }
  if (env.LITTLE_CODER_FIXED_MODEL === "1") {
    target.fixed_model = true;
  }
}

// .pi/extensions/_shared/tool-execution-patch.ts
var DEFAULT_STATUSLINE_ITEMS = {
  cwd: true,
  model: true,
  context: true,
  tokens: false,
  cost: false,
  extension_status: true
};
function getStatuslineMode() {
  if (globalThis.__littleCoderStatuslineMode) {
    return globalThis.__littleCoderStatuslineMode;
  }
  try {
    const cfg = loadLittleCoderSettings();
    globalThis.__littleCoderStatuslineMode = cfg.statusline;
    if (cfg.statusline_items) {
      globalThis.__littleCoderStatuslineItems = { ...DEFAULT_STATUSLINE_ITEMS, ...cfg.statusline_items };
    }
  } catch {
    globalThis.__littleCoderStatuslineMode = "minimal";
  }
  return globalThis.__littleCoderStatuslineMode;
}
function getStatuslineItems() {
  if (globalThis.__littleCoderStatuslineItems) {
    return globalThis.__littleCoderStatuslineItems;
  }
  try {
    const cfg = loadLittleCoderSettings();
    if (cfg.statusline_items) {
      globalThis.__littleCoderStatuslineItems = { ...DEFAULT_STATUSLINE_ITEMS, ...cfg.statusline_items };
    } else {
      globalThis.__littleCoderStatuslineItems = { ...DEFAULT_STATUSLINE_ITEMS };
    }
  } catch {
    globalThis.__littleCoderStatuslineItems = { ...DEFAULT_STATUSLINE_ITEMS };
  }
  return globalThis.__littleCoderStatuslineItems;
}
function setStatuslineMode(mode) {
  globalThis.__littleCoderStatuslineMode = mode;
}
function setStatuslineItems(items) {
  globalThis.__littleCoderStatuslineItems = { ...items };
}
function registerToolDefinitionOverride(toolName, definition) {
  if (!globalThis.__littleCoderToolOverrides) {
    globalThis.__littleCoderToolOverrides = new Map;
  }
  globalThis.__littleCoderToolOverrides.set(toolName, definition);
}
function patchToolExecutionComponent() {
  const proto = ToolExecutionComponent.prototype;
  if (proto.__littleCoderPatched)
    return;
  const origRender = proto.render;
  proto.render = function(width) {
    if (this.hideComponent)
      return [];
    const rawLines = origRender.call(this, width);
    const trimmed = rawLines.map((l) => l.trimEnd());
    const nonBlank = trimmed.filter((l) => l.trim().length > 0);
    if (nonBlank.length === 0)
      return [];
    const header = nonBlank[0];
    const rest = nonBlank.slice(1);
    const hasLeadingSpacer = !this.suppressLeadingSpacer && !this.isGrouped;
    if (!this.expanded) {
      let unWrappedHeader = header;
      let unWrappedSummary = "";
      const container = this.getRenderShell() === "self" ? this.selfRenderContainer : this.contentBox;
      if (container && Array.isArray(container.children) && container.children.length > 0) {
        const unWrappedLines = [];
        for (const child of container.children) {
          const rendered = child.render(1e4);
          for (const l of rendered) {
            const trimmed = l.trimEnd();
            if (trimmed.trim().length > 0)
              unWrappedLines.push(trimmed);
          }
        }
        if (unWrappedLines.length > 0) {
          unWrappedHeader = unWrappedLines[0];
          if (unWrappedLines.length > 1) {
            unWrappedSummary = unWrappedLines.slice(1).map((l) => l.trim()).join(" ").replace(/\s+/g, " ");
          }
        }
      } else if (rest.length > 0) {
        unWrappedSummary = rest.map((l) => l.trim()).join(" ").replace(/\s+/g, " ");
      }
      const expandHint = "\x1B[2m... (ctrl+o to expand)\x1B[0m";
      let line = unWrappedHeader;
      if (!unWrappedSummary) {
        if (visibleWidth(unWrappedHeader) > width) {
          line = truncateToWidth(unWrappedHeader, width, expandHint);
        }
      } else {
        const summaryPart = `  \x1B[2m(${unWrappedSummary})\x1B[0m`;
        const summaryWidth = visibleWidth(summaryPart);
        if (visibleWidth(unWrappedHeader) + summaryWidth <= width) {
          line = `${unWrappedHeader}${summaryPart}`;
        } else {
          const availableForSummary = width - visibleWidth(unWrappedHeader) - 6;
          if (availableForSummary >= 15) {
            const shortSummary = `${unWrappedSummary.slice(0, availableForSummary - 3)}...`;
            line = `${unWrappedHeader}  \x1B[2m(${shortSummary})\x1B[0m`;
          } else {
            line = truncateToWidth(unWrappedHeader, width, expandHint);
          }
        }
      }
      return hasLeadingSpacer ? ["", line] : [line];
    }
    const isLast = Boolean(this.isLast);
    const connectorPrefix = isLast ? "  " : "\x1B[1m\x1B[97m\u2503\x1B[0m ";
    const expandedLines = [
      header,
      ...rest.map((l) => {
        if (l.startsWith("\u2503 ") || l.startsWith("\u2502 ") || l.startsWith("\u2523 ") || l.startsWith("\u2517 ") || l.startsWith("\u250F ")) {
          return l;
        }
        return `${connectorPrefix}${l.trim()}`;
      })
    ];
    return hasLeadingSpacer ? ["", ...expandedLines] : expandedLines;
  };
  const origHasRendererDefinition = proto.hasRendererDefinition;
  proto.hasRendererDefinition = function() {
    if (globalThis.__littleCoderToolOverrides?.has(this.toolName))
      return true;
    return origHasRendererDefinition ? origHasRendererDefinition.call(this) : false;
  };
  const origGetRenderContext = proto.getRenderContext;
  proto.getRenderContext = function(lastComponent) {
    const ctx = origGetRenderContext.call(this, lastComponent);
    ctx.component = this;
    return ctx;
  };
  const origGetCallRenderer = proto.getCallRenderer;
  proto.getCallRenderer = function() {
    const override = globalThis.__littleCoderToolOverrides?.get(this.toolName);
    if (override?.renderCall)
      return override.renderCall;
    return origGetCallRenderer.call(this);
  };
  const origGetResultRenderer = proto.getResultRenderer;
  proto.getResultRenderer = function() {
    const override = globalThis.__littleCoderToolOverrides?.get(this.toolName);
    if (override?.renderResult)
      return override.renderResult;
    return origGetResultRenderer.call(this);
  };
  const origUpdateDisplay = proto.updateDisplay;
  proto.updateDisplay = function() {
    if (origUpdateDisplay) {
      origUpdateDisplay.call(this);
    }
    if (this.contentBox && typeof this.contentBox.setBgFn === "function") {
      this.contentBox.setBgFn((text) => text);
      this.contentBox.paddingY = 0;
    }
    if (this.contentText && typeof this.contentText.setCustomBgFn === "function") {
      this.contentText.setCustomBgFn((text) => text);
    }
  };
  proto.__littleCoderPatched = true;
}
function patchFooterComponent() {
  const proto = FooterComponent.prototype;
  if (proto.__littleCoderFooterPatched)
    return;
  const origRender = proto.render;
  proto.render = function(width) {
    const rawLines = origRender.call(this, width);
    if (!rawLines || rawLines.length === 0)
      return rawLines;
    const state = this.session?.state;
    if (!state)
      return rawLines;
    const theme = this.theme || {
      fg: (_color, text) => text,
      bold: (text) => text
    };
    let totalInput = 0;
    let totalOutput = 0;
    let totalCacheRead = 0;
    let totalCacheWrite = 0;
    let totalCost = 0;
    for (const entry of this.session.sessionManager.getEntries()) {
      if (entry.type === "message" && entry.message.role === "assistant") {
        totalInput += entry.message.usage?.input || 0;
        totalOutput += entry.message.usage?.output || 0;
        totalCacheRead += entry.message.usage?.cacheRead || 0;
        totalCacheWrite += entry.message.usage?.cacheWrite || 0;
        totalCost += entry.message.usage?.cost?.total || 0;
      }
    }
    const fmtTokens = (count) => {
      if (count < 1000)
        return count.toString();
      if (count < 1e4)
        return `${(count / 1000).toFixed(1)}k`;
      if (count < 1e6)
        return `${Math.round(count / 1000)}k`;
      if (count < 1e7)
        return `${(count / 1e6).toFixed(1)}M`;
      return `${Math.round(count / 1e6)}M`;
    };
    const contextUsage = this.session.getContextUsage();
    const contextWindow = contextUsage?.contextWindow ?? state.model?.contextWindow ?? 0;
    const contextPercentValue = contextUsage?.percent ?? 0;
    const contextPercent = contextUsage?.percent !== null && contextUsage?.percent !== undefined ? contextPercentValue.toFixed(1) : "?";
    let pwd = rawLines[0]?.replace(/\x1b\[[0-9;]*m/g, "").trim() || "~";
    if (pwd.length > 28) {
      const branchMatch = pwd.match(/\s*\([^)]+\)$/);
      const branch = branchMatch ? branchMatch[0] : "";
      const pathPart = branchMatch ? pwd.slice(0, branchMatch.index).trim() : pwd;
      const parts = pathPart.split("/").filter(Boolean);
      if (parts.length > 2) {
        pwd = `\u2026/${parts.slice(-2).join("/")}${branch}`;
      }
    }
    const pwdSegment = `\x1B[38;2;138;190;183m${pwd}\x1B[0m`;
    const modelName = state.model?.id || "no-model";
    const provider = state.model?.provider ? ` (${state.model.provider})` : "";
    const thinkingLevel = state.thinkingLevel && state.thinkingLevel !== "off" ? ` \u2022 ${state.thinkingLevel}` : "";
    const modelSegment = `\x1B[38;2;184;152;50m${modelName}${provider}${thinkingLevel}\x1B[0m`;
    let ctxColor = "\x1B[38;2;149;152;203m";
    if (contextPercentValue > 90)
      ctxColor = "\x1B[31m";
    else if (contextPercentValue > 70)
      ctxColor = "\x1B[33m";
    const autoIndicator = this.autoCompactEnabled ? " (auto)" : "";
    const ctxSegment = `${ctxColor}Context ${contextPercent}%/${fmtTokens(contextWindow)}${autoIndicator}\x1B[0m`;
    const tokenParts = [];
    if (totalInput)
      tokenParts.push(`\u2191${fmtTokens(totalInput)}`);
    if (totalOutput)
      tokenParts.push(`\u2193${fmtTokens(totalOutput)}`);
    if (totalCacheRead)
      tokenParts.push(`R${fmtTokens(totalCacheRead)}`);
    if (totalCacheWrite)
      tokenParts.push(`W${fmtTokens(totalCacheWrite)}`);
    const tokenSegment = tokenParts.length > 0 ? `\x1B[38;2;129;162;190m${tokenParts.join(" ")}\x1B[0m` : "";
    const usingSubscription = state.model ? this.session.modelRegistry.isUsingOAuth(state.model) : false;
    let costSegment = "";
    if (totalCost || usingSubscription) {
      costSegment = `\x1B[38;2;181;189;104m$${totalCost.toFixed(3)}${usingSubscription ? " (sub)" : ""}\x1B[0m`;
    }
    const mode = getStatuslineMode();
    if (mode === "off") {
      return [];
    }
    const dot = " \x1B[38;2;102;102;102m\xB7\x1B[0m ";
    let activeSegments;
    let showExtStatus = true;
    if (mode === "custom") {
      const items = getStatuslineItems();
      activeSegments = [];
      if (items.cwd)
        activeSegments.push(pwdSegment);
      if (items.context)
        activeSegments.push(ctxSegment);
      if (items.tokens && tokenSegment)
        activeSegments.push(tokenSegment);
      if (items.cost && costSegment)
        activeSegments.push(costSegment);
      if (items.model)
        activeSegments.push(modelSegment);
      showExtStatus = items.extension_status;
    } else if (mode === "full" || width >= 160) {
      activeSegments = [pwdSegment, modelSegment, ctxSegment, tokenSegment, costSegment].filter(Boolean);
    } else if (mode === "standard") {
      activeSegments = [pwdSegment, modelSegment, ctxSegment, tokenSegment].filter(Boolean);
    } else {
      activeSegments = [pwdSegment, modelSegment, ctxSegment].filter(Boolean);
    }
    if (mode === "custom") {
      const items = getStatuslineItems();
      if (!items.cwd && items.context && items.model && !items.tokens && !items.cost) {
        const leftSide = `${ctxColor}Context ${contextPercent}% used\x1B[0m`;
        const providerName = state.model?.provider || "openai-codex";
        const rightSide = `\x1B[38;2;184;152;50m${providerName} \u2022 ${modelName}${thinkingLevel}\x1B[0m`;
        const leftWidth = visibleWidth(leftSide);
        const rightWidth = visibleWidth(rightSide);
        if (leftWidth + rightWidth + 2 <= width) {
          const pad = " ".repeat(width - leftWidth - rightWidth);
          return [leftSide + pad + rightSide];
        }
      }
    }
    let leftText = activeSegments.join(dot);
    let rightText = "";
    const extensionStatuses = this.footerData?.getExtensionStatuses();
    if (showExtStatus && extensionStatuses && extensionStatuses.size > 0) {
      const entries = Array.from(extensionStatuses.entries());
      const sorted = entries.sort(([a], [b]) => a.localeCompare(b)).map(([, t]) => String(t).replace(/[\r\n\t]/g, " ").trim());
      rightText = `\x1B[38;2;150;156;167m${sorted.join(" ")}\x1B[0m`;
    }
    let leftLen = visibleWidth(leftText);
    let rightLen = visibleWidth(rightText);
    if (leftLen + (rightLen ? rightLen + 2 : 0) > width && rightLen > 0) {
      rightText = "";
      rightLen = 0;
    }
    if (leftLen > width && costSegment) {
      activeSegments = [pwdSegment, modelSegment, ctxSegment, tokenSegment].filter(Boolean);
      leftText = activeSegments.join(dot);
      leftLen = visibleWidth(leftText);
    }
    if (leftLen > width && tokenSegment) {
      activeSegments = [pwdSegment, modelSegment, ctxSegment].filter(Boolean);
      leftText = activeSegments.join(dot);
      leftLen = visibleWidth(leftText);
    }
    if (leftLen + (rightLen ? rightLen + 2 : 0) <= width) {
      const pad = " ".repeat(Math.max(1, width - leftLen - rightLen));
      return [leftText + (rightText ? pad + rightText : "")];
    }
    return [truncateToWidth(leftText, width, "...")];
  };
  proto.__littleCoderFooterPatched = true;
}
patchToolExecutionComponent();
patchFooterComponent();

// .pi/extensions/_shared/display.ts
import { spawnSync } from "child_process";
import { Markdown } from "@earendil-works/pi-tui";
function resolveBatBin() {
  if (process.env.BAT_BIN)
    return process.env.BAT_BIN;
  try {
    const { execSync } = __require("child_process");
    const p = execSync("which bat 2>/dev/null || true", { encoding: "utf-8" }).trim();
    if (p)
      return p;
  } catch {}
  return "bat";
}
var BAT_BIN = resolveBatBin();
var commandHighlightCache = new Map;
var MAX_HIGHLIGHT_CACHE = 200;
function highlightShellCommand(command) {
  if (!command || !command.trim())
    return command;
  const cached = commandHighlightCache.get(command);
  if (cached !== undefined)
    return cached;
  try {
    const res = spawnSync(BAT_BIN, [
      "--color=always",
      "--plain",
      "--language=bash",
      "--paging=never"
    ], {
      input: command,
      encoding: "utf-8",
      timeout: 2000
    });
    if (res.status === 0 && res.stdout) {
      const highlighted = res.stdout.trimEnd();
      if (commandHighlightCache.size >= MAX_HIGHLIGHT_CACHE) {
        commandHighlightCache.clear();
      }
      commandHighlightCache.set(command, highlighted);
      return highlighted;
    }
  } catch {}
  return command;
}
function formatTurnDuration(ms) {
  if (ms < 1000)
    return `${Math.max(1, Math.round(ms / 1000))}s`;
  const secs = Math.round(ms / 1000);
  if (secs < 60)
    return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (remSecs === 0)
    return `${mins}m`;
  return `${mins}m ${remSecs}s`;
}
function formatTime(d = new Date) {
  let hours = d.getHours();
  const mins = d.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${mins} ${ampm}`;
}
function formatRelativeAgo(msAgo) {
  const secs = Math.max(0, Math.round(msAgo / 1000));
  if (secs < 30)
    return "just now";
  if (secs < 60)
    return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60)
    return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  return `${hours}h ago`;
}
function formatTurnStatus(durationMs, timestamp = new Date) {
  const timeStr = formatTime(timestamp);
  const durStr = formatTurnDuration(durationMs);
  const agoStr = formatRelativeAgo(0);
  return `  \x1B[2m${timeStr} \u2022 ${agoStr} \u2022 Worked for ${durStr}\x1B[0m`;
}

// .pi/extensions/passive-ui/src/basic-tool-grouping.ts
var STRUCTURAL_TOOL_ICONS = {
  read: "\u25A0",
  grep: "\u25A0",
  find: "\u25A0",
  ls: "\u25A0",
  edit: "\u270F",
  write: "\uD83D\uDDB9",
  revert_file: "\u21A9",
  revert: "\u21A9",
  ast_search: "\u25B2",
  "ast-search": "\u25B2",
  shell: "\uF120",
  sh: "\uF120",
  web_search: "\u25B2",
  web_fetch: "\u21F2",
  web_control: "\u2699",
  web_source: "\uD83D\uDDB9",
  outline: "\u2637",
  repo_map: "\u25A0",
  scratchpad: "\uD83D\uDDB9",
  session: "\u26A1",
  command_history: "\u25F7",
  project_context: "\u2338",
  model_router: "\u2338",
  goal: "\u26A1",
  schedule: "\u25F7",
  recap: "\uD83D\uDDB9",
  ctx_record: "\uD83D\uDDB9",
  ctx_packet: "\u25A0",
  ctx_inject: "\u26A1",
  file_checkpoint: "\u25A0",
  grove_read: "\u25A0",
  grove_write: "\u270F",
  grove_search: "\u25B2",
  grove_promote: "\u25B3",
  doc_read: "\u25A0",
  doc_ocr: "\u25B2",
  doc_extract: "\uD83D\uDDB9",
  "basic-tools": "\u2699",
  basic_tools: "\u2699"
};
function isStructuralTool(toolName) {
  return Object.prototype.hasOwnProperty.call(STRUCTURAL_TOOL_ICONS, toolName);
}
function getToolRoleIcon(toolName) {
  return STRUCTURAL_TOOL_ICONS[toolName] ?? "\u2022";
}
function getStatusBullet(status = "success", hollow = false) {
  const sym = hollow ? "\u25CB" : "\u25CF";
  switch (status) {
    case "running":
      return `\x1B[36m${sym}\x1B[0m`;
    case "error":
      return `\x1B[31m${sym}\x1B[0m`;
    case "warning":
      return `\x1B[33m${sym}\x1B[0m`;
    case "success":
    default:
      return `\x1B[32m${sym}\x1B[0m`;
  }
}

class ToolGroupingTracker {
  currentTurnTools = [];
  consecutiveStructuralCount = 0;
  firstToolIdInGroup = null;
  toolCallMap = new Map;
  turnStartTime = Date.now();
  agentStartTime = Date.now();
  reset() {
    this.currentTurnTools = [];
    this.consecutiveStructuralCount = 0;
    this.firstToolIdInGroup = null;
    this.toolCallMap.clear();
  }
  setAgentStart(time = Date.now()) {
    this.agentStartTime = time;
    this.turnStartTime = time;
  }
  setTurnStart(time = Date.now()) {
    this.turnStartTime = time;
  }
  getTurnDuration(now = Date.now()) {
    return Math.max(0, now - this.agentStartTime);
  }
  recordToolStart(toolCallId, toolName) {
    this.currentTurnTools.push(toolName);
    const structural = isStructuralTool(toolName);
    if (structural) {
      this.consecutiveStructuralCount++;
      if (this.consecutiveStructuralCount === 1) {
        this.firstToolIdInGroup = toolCallId;
      }
    } else {
      this.consecutiveStructuralCount = 0;
      this.firstToolIdInGroup = null;
    }
    const isGrouped = this.consecutiveStructuralCount > 1;
    const isFirst = this.consecutiveStructuralCount === 1;
    if (isGrouped && this.firstToolIdInGroup) {
      const firstInfo = this.toolCallMap.get(this.firstToolIdInGroup);
      if (firstInfo && !firstInfo.isGrouped) {
        firstInfo.isGrouped = true;
        firstInfo.isFirst = true;
        const firstIcon = getToolRoleIcon(firstInfo.toolName);
        firstInfo.prefix = `\u250F ${firstIcon} `;
      }
    }
    const icon = getToolRoleIcon(toolName);
    const prefix = isGrouped ? `\u2523 ${icon} ` : `${icon} `;
    const info = {
      toolCallId,
      toolName,
      isGrouped,
      isFirst,
      isLast: false,
      prefix
    };
    this.toolCallMap.set(toolCallId, info);
    return info;
  }
  recordToolEnd(toolCallId, isLastInTurn = false) {
    const info = this.toolCallMap.get(toolCallId);
    if (!info)
      return;
    if (info.isGrouped && isLastInTurn) {
      info.isLast = true;
      const icon = getToolRoleIcon(info.toolName);
      info.prefix = `\u2517 ${icon} `;
    }
    return info;
  }
  getInfo(toolCallId) {
    return this.toolCallMap.get(toolCallId);
  }
  formatHeader(toolName, callText, isGrouped, isLast, isFirst = false) {
    const icon = getToolRoleIcon(toolName);
    if (!isGrouped) {
      return `${icon} ${callText}`;
    }
    const glyph = isFirst ? "\u250F" : isLast ? "\u2517" : "\u2523";
    return `${glyph} ${icon} ${callText}`;
  }
}
var defaultTracker = new ToolGroupingTracker;
var basicToolGroupingItemSchema = Type.Object({
  toolName: Type.String({ description: "Tool name to check or format" }),
  callText: Type.Optional(Type.String({ description: "Call text preview" })),
  isGrouped: Type.Optional(Type.Boolean({ description: "Whether tool is part of a consecutive group" })),
  isLast: Type.Optional(Type.Boolean({ description: "Whether tool is last in group" })),
  isFirst: Type.Optional(Type.Boolean({ description: "Whether tool is first in group" }))
});
var basicToolGroupingSchema = Type.Object({
  ops: Type.Optional(Type.Array(basicToolGroupingItemSchema, { description: "Batch operations array" })),
  toolName: Type.Optional(Type.String({ description: "Tool name to check or format" })),
  callText: Type.Optional(Type.String({ description: "Call text preview" })),
  isGrouped: Type.Optional(Type.Boolean({ description: "Whether tool is part of a consecutive group" })),
  isLast: Type.Optional(Type.Boolean({ description: "Whether tool is last in group" })),
  isFirst: Type.Optional(Type.Boolean({ description: "Whether tool is first in group" }))
});
function registerBasicToolGrouping(pi, tracker = defaultTracker) {
  pi.on("agent_start", () => {
    tracker.setAgentStart(Date.now());
  });
  pi.on("turn_start", () => {
    tracker.setTurnStart(Date.now());
    tracker.reset();
  });
  pi.on("tool_execution_start", (event) => {
    if (event?.toolCallId && event?.toolName) {
      tracker.recordToolStart(event.toolCallId, event.toolName);
    }
  });
  pi.on("tool_execution_end", (event) => {
    if (event?.toolCallId) {
      tracker.recordToolEnd(event.toolCallId);
    }
  });
  pi.on("turn_end", () => {
    tracker.reset();
  });
  pi.on("agent_end", (event, ctx) => {
    const elapsed = tracker.getTurnDuration();
    const statusLine = formatTurnStatus(elapsed, new Date);
    try {
      const messages = event?.messages || [];
      const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
      if (lastAssistantMsg) {
        lastAssistantMsg.turnDurationBadge = statusLine;
      }
    } catch {}
    if (ctx?.ui?.setStatus) {
      try {
        ctx.ui.setStatus("turn-worked", statusLine.trim());
      } catch {}
    }
  });
  for (const toolName of Object.keys(STRUCTURAL_TOOL_ICONS)) {
    registerToolDefinitionOverride(toolName, {
      renderCall(args, theme, context) {
        const info = context?.toolCallId ? tracker.getInfo(context.toolCallId) : undefined;
        const isGrouped = info?.isGrouped ?? false;
        const isFirst = info?.isFirst ?? false;
        const isLast = info?.isLast ?? false;
        const icon = getToolRoleIcon(toolName);
        const shouldSuppressSpacer = isGrouped && !isFirst;
        if (context) {
          context.isGrouped = shouldSuppressSpacer;
          context.suppressLeadingSpacer = shouldSuppressSpacer;
          if (context.component) {
            context.component.isGrouped = shouldSuppressSpacer;
            context.component.suppressLeadingSpacer = shouldSuppressSpacer;
          }
        }
        const rawGlyph = isGrouped ? isFirst ? "\u250F " : isLast ? "\u2517 " : "\u2523 " : "";
        const glyph = rawGlyph ? `\x1B[1m\x1B[97m${rawGlyph}\x1B[0m` : "";
        const isError = Boolean(context?.isError);
        const isFinished = context?.isPartial === false || context?.result !== undefined;
        const bulletStatus = !isFinished ? "running" : isError ? "error" : "success";
        const isHollow = toolName === "recap";
        const bullet = getStatusBullet(bulletStatus, isHollow);
        let styled;
        if (toolName === "sh" || toolName === "shell") {
          const cmd = args?.command ?? (Array.isArray(args?.commands) ? args.commands[0] : "");
          const firstLineCmd = (cmd || "(empty)").split(`
`)[0].trim();
          const highlightedCmd = highlightShellCommand(firstLineCmd);
          const chevronColor = isFinished ? isError ? "error" : "success" : "accent";
          styled = `${glyph}${bullet} \x1B[1m\x1B[97mShell\x1B[0m ${theme.fg(chevronColor, "\u276F")} ${highlightedCmd}`;
        } else if (toolName === "read") {
          const files = args?.files ?? args?.ops ?? (args?.path ? [{ path: args.path, offset: args.offset, limit: args.limit }] : []);
          const first = files[0];
          const p = first?.path ?? "";
          const from = first?.offset ?? 1;
          const to = first?.limit ? `${from}-${Number(from) + Number(first.limit) - 1}` : `${from}..`;
          const range = files.length === 1 ? ` [${to}]` : ` [${files.length} files]`;
          styled = `${glyph}${bullet} ${theme.fg("toolTitle", "Read")} (${theme.fg("accent", p)})${theme.fg("dim", range)}`;
        } else if (toolName === "edit") {
          const edits = Array.isArray(args?.edits) ? args.edits : Array.isArray(args?.ops) ? args.ops : [];
          const p = (typeof args?.path === "string" ? args.path : typeof args?.file_path === "string" ? args.file_path : edits[0]?.path) ?? "";
          const shortPath = p.replace(/^\/home\/[^\/]+\//, "~/");
          const count = edits.length > 1 ? ` [${edits.length} edits]` : "";
          styled = `${glyph}${bullet} ${theme.fg("toolTitle", "Edit")} (${theme.fg("accent", shortPath || "unknown")})${theme.fg("dim", count)}`;
        } else if (toolName === "write") {
          const writes = args?.files ?? args?.ops ?? (args?.path ? [{ path: args.path }] : []);
          const first = writes[0];
          const p = first?.path ?? "";
          const count = writes.length > 1 ? ` [${writes.length} files]` : "";
          styled = `${glyph}${bullet} ${theme.fg("toolTitle", "Write")} (${theme.fg("accent", p)})${theme.fg("dim", count)}`;
        } else if (toolName === "web_search") {
          const q = args?.query ?? (Array.isArray(args?.ops) ? args.ops[0]?.query : "");
          const queryText = q ? ` ("${q.split(`
`)[0].slice(0, 50)}")` : "";
          styled = `${glyph}${bullet} ${theme.fg("toolTitle", "web_search")}${theme.fg("accent", queryText)}`;
        } else if (toolName === "web_fetch") {
          const u = args?.url ?? (Array.isArray(args?.urls) ? args.urls[0] : Array.isArray(args?.ops) ? args.ops[0]?.url : "");
          const urlText = u ? ` (${u.split(`
`)[0].slice(0, 60)})` : "";
          styled = `${glyph}${bullet} ${theme.fg("toolTitle", "web_fetch")}${theme.fg("accent", urlText)}`;
        } else if (toolName === "outline") {
          const p = args?.path ?? (Array.isArray(args?.ops) ? args.ops[0]?.path : "");
          const pathText = p ? ` (${p.split("/").pop() ?? p})` : "";
          styled = `${glyph}${bullet} ${theme.fg("toolTitle", "outline")}${theme.fg("accent", pathText)}`;
        } else if (toolName === "session") {
          const act = args?.action ?? (args?.command ? "exec" : "list");
          const id = args?.id ? ` [${args.id}]` : "";
          styled = `${glyph}${bullet} ${theme.fg("toolTitle", "session")} ${theme.fg("accent", `${act}${id}`)}`;
        } else {
          let label = toolName;
          if ((toolName === "basic-tools" || toolName === "basic_tools") && Array.isArray(args?.ops) && args.ops.length > 0) {
            const firstOp = args.ops[0];
            const opType = firstOp?.type ?? (firstOp?.command ? "sh" : firstOp?.edits ? "edit" : firstOp?.content ? "write" : "op");
            if (args.ops.length === 1) {
              const opTarget = firstOp?.command ? ` ${firstOp.command.split(`
`)[0].slice(0, 40)}` : firstOp?.path ? ` ${firstOp.path}` : "";
              label = `${toolName} (${opType}${opTarget})`;
            } else {
              label = `${toolName} (${args.ops.length} ops: ${opType}...)`;
            }
          }
          const titleText = `${label}`;
          styled = `${glyph}${bullet} ${theme.fg("toolTitle", titleText)}`;
        }
        return new Text(styled, 0, 0);
      }
    });
  }
}

// .pi/extensions/passive-ui/src/thinking-steps.ts
import { AssistantMessageComponent } from "@earendil-works/pi-coding-agent";
import { Markdown as Markdown2, Spacer, Text as Text2 } from "@earendil-works/pi-tui";
var THINKING_STEPS_REF_COUNT = Symbol.for("little-coder.thinking-steps.refCount");
var THINKING_STEPS_ORIG_UPDATE = Symbol.for("little-coder.thinking-steps.origUpdateContent");
var THINKING_STEPS_ORIG_RENDER = Symbol.for("little-coder.thinking-steps.origRender");
function parseThinkingSteps(rawThinking) {
  if (!rawThinking || !rawThinking.trim())
    return [];
  const parts = rawThinking.split(/\n\s*\n|(?=(?:^|\n)(?:Step\s+\d+:|Thought\s+\d+:|##\s+))/i).map((p) => p.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [rawThinking.trim()];
}
function formatThinkingStepsLabel(stepCount, baseLabel = "Thinking") {
  if (stepCount <= 1) {
    return `${baseLabel}...`;
  }
  return `${baseLabel} (${stepCount} steps)...`;
}
var formatThinkingText = (text) => `\x1B[3m\x1B[90m${text}\x1B[0m`;
var formatErrorText = (text) => `\x1B[31m${text}\x1B[0m`;
function patchAssistantMessageComponent() {
  const proto = AssistantMessageComponent.prototype;
  const currentCount = proto[THINKING_STEPS_REF_COUNT] ?? 0;
  if (currentCount > 0) {
    proto[THINKING_STEPS_REF_COUNT] = currentCount + 1;
    return proto[THINKING_STEPS_REF_COUNT];
  }
  proto[THINKING_STEPS_ORIG_UPDATE] = proto.updateContent;
  proto.updateContent = function(message) {
    this.lastMessage = message;
    this.contentContainer.clear();
    const hasVisibleContent = message?.content?.some((c) => c.type === "text" && c.text?.trim() || c.type === "thinking" && c.thinking?.trim());
    if (hasVisibleContent) {
      this.contentContainer.addChild(new Spacer(1));
    }
    const items = message?.content || [];
    for (let i = 0;i < items.length; i++) {
      const content = items[i];
      if (content.type === "text" && content.text?.trim()) {
        this.contentContainer.addChild(new Markdown2(content.text.trim(), 1, 0, this.markdownTheme));
      } else if (content.type === "thinking" && content.thinking?.trim()) {
        const hasVisibleContentAfter = items.slice(i + 1).some((c) => c.type === "text" && c.text?.trim() || c.type === "thinking" && c.thinking?.trim());
        const steps = parseThinkingSteps(content.thinking);
        if (this.hideThinkingBlock) {
          const label = formatThinkingStepsLabel(steps.length, this.hiddenThinkingLabel || "Thinking");
          this.contentContainer.addChild(new Text2(`\x1B[32m\u25CB\x1B[0m ${formatThinkingText(label)}`, 1, 0));
          if (hasVisibleContentAfter) {
            this.contentContainer.addChild(new Spacer(1));
          }
        } else {
          const thoughtBullet = "\x1B[32m\u25CB\x1B[0m \x1B[1m\x1B[97mThought:\x1B[0m ";
          for (let sIdx = 0;sIdx < steps.length; sIdx++) {
            const stepText = steps[sIdx];
            const cleanStep = stepText.replace(/^(?:Step\s+\d+:|Thought\s+\d+:|Thought:)\s*/i, "");
            const prefix = steps.length > 1 ? `\x1B[32m\u25CB\x1B[0m \x1B[1m\x1B[97mThought [${sIdx + 1}/${steps.length}]:\x1B[0m ` : thoughtBullet;
            this.contentContainer.addChild(new Markdown2(prefix + cleanStep, 1, 0, this.markdownTheme, {
              color: (text) => formatThinkingText(text),
              italic: true
            }));
            if (sIdx < steps.length - 1) {
              this.contentContainer.addChild(new Spacer(1));
            }
          }
          if (hasVisibleContentAfter) {
            this.contentContainer.addChild(new Spacer(1));
          }
        }
      }
    }
    const hasToolCalls = items.some((c) => c.type === "toolCall");
    this.hasToolCalls = hasToolCalls;
    if (!hasToolCalls && message?.errorMessage) {
      const abortMessage = message.errorMessage !== "Request was aborted" ? message.errorMessage : null;
      if (abortMessage) {
        this.contentContainer.addChild(new Spacer(1));
        this.contentContainer.addChild(new Text2(formatErrorText(abortMessage), 1, 0));
      }
    }
  };
  proto[THINKING_STEPS_ORIG_RENDER] = proto.render;
  proto.render = function(width) {
    const origRenderFn = proto[THINKING_STEPS_ORIG_RENDER] || Object.getPrototypeOf(proto).render;
    const lines = origRenderFn.call(this, width);
    const badge = this.turnDurationBadge || this.lastMessage?.turnDurationBadge;
    if (badge) {
      if (lines.length === 0) {
        return ["", badge];
      }
      return [...lines, "", badge];
    }
    return lines;
  };
  proto[THINKING_STEPS_REF_COUNT] = 1;
  return 1;
}
function unpatchAssistantMessageComponent() {
  const proto = AssistantMessageComponent.prototype;
  const currentCount = proto[THINKING_STEPS_REF_COUNT] ?? 0;
  if (currentCount <= 1) {
    if (proto[THINKING_STEPS_ORIG_UPDATE]) {
      proto.updateContent = proto[THINKING_STEPS_ORIG_UPDATE];
      delete proto[THINKING_STEPS_ORIG_UPDATE];
    }
    if (proto[THINKING_STEPS_ORIG_RENDER]) {
      proto.render = proto[THINKING_STEPS_ORIG_RENDER];
      delete proto[THINKING_STEPS_ORIG_RENDER];
    }
    proto[THINKING_STEPS_REF_COUNT] = 0;
    return 0;
  }
  proto[THINKING_STEPS_REF_COUNT] = currentCount - 1;
  return proto[THINKING_STEPS_REF_COUNT];
}
function getThinkingStepsPatchRefCount() {
  const proto = AssistantMessageComponent.prototype;
  return proto[THINKING_STEPS_REF_COUNT] ?? 0;
}
var thinkingStepsItemSchema = Type.Object({
  rawThinking: Type.String({ description: "Raw thinking text to parse" }),
  baseLabel: Type.Optional(Type.String({ description: "Base label for thinking indicator" }))
});
var thinkingStepsSchema = Type.Object({
  ops: Type.Optional(Type.Array(thinkingStepsItemSchema, { description: "Batch operations array" })),
  rawThinking: Type.Optional(Type.String({ description: "Raw thinking text to parse" })),
  baseLabel: Type.Optional(Type.String({ description: "Base label for thinking indicator" }))
});

// .pi/extensions/passive-ui/src/passive-ui.ts
var passiveUiItemSchema = Type.Object({
  action: Type.Optional(Type.Union([
    Type.Literal("status"),
    Type.Literal("enable"),
    Type.Literal("disable")
  ]))
});
var passiveUiSchema = Type.Object({
  ops: Type.Optional(Type.Array(passiveUiItemSchema, { description: "Batch operations array" })),
  action: Type.Optional(Type.Union([
    Type.Literal("status", { description: "Get passive UI status (default)" }),
    Type.Literal("enable", { description: "Enable passive UI features" }),
    Type.Literal("disable", { description: "Disable passive UI features" })
  ], { description: "Action to perform" }))
});
async function executePassiveUiOp(_toolCallId, params, _signal, _onUpdate, _ctx) {
  if (Array.isArray(params.ops) && params.ops.length > 0) {
    if (params.ops.length === 1) {
      return executePassiveUiOp(_toolCallId, { ...params.ops[0], ops: undefined }, _signal, _onUpdate, _ctx);
    }
    const results = await Promise.all(params.ops.map((op) => executePassiveUiOp(_toolCallId, op, _signal, _onUpdate, _ctx)));
    return {
      content: [{ type: "text", text: results.map((r) => r.content[0].text).join(`
`) }],
      isError: false,
      details: {
        totalOps: results.length,
        results: results.map((r) => r.details)
      }
    };
  }
  const action = params.action ?? "status";
  if (action === "enable") {
    patchAssistantMessageComponent();
  } else if (action === "disable") {
    unpatchAssistantMessageComponent();
  }
  const refCount = getThinkingStepsPatchRefCount();
  const statusMsg = `Passive UI active: tool-grouping=enabled, thinking-steps=${refCount > 0 ? "enabled" : "disabled"} (refCount=${refCount})`;
  return {
    content: [{ type: "text", text: statusMsg }],
    isError: false,
    details: {
      toolGrouping: "enabled",
      thinkingSteps: refCount > 0 ? "enabled" : "disabled",
      thinkingStepsRefCount: refCount
    }
  };
}
function registerPassiveUi(pi, tracker = defaultTracker) {
  registerBasicToolGrouping(pi, tracker);
  patchAssistantMessageComponent();
  pi.registerTool({
    name: "passive_ui",
    label: "Passive UI",
    description: "Inspect or configure passive UI features (tool grouping and thinking steps).",
    promptSnippet: "Passive UI inspector and configuration",
    promptGuidelines: ["Use passive_ui to check or toggle UI enhancements."],
    parameters: passiveUiSchema,
    renderCall(args, theme) {
      const action = args?.action ?? "status";
      const text = theme.fg("toolTitle", "passive_ui ") + theme.fg("accent", action);
      return new Text3(text, 0, 0);
    },
    renderResult(result, { expanded }, theme) {
      const details = result?.details;
      const text = theme.fg("muted", `Passive UI (grouping: ${details?.toolGrouping}, thinking: ${details?.thinkingSteps})`);
      return new Text3(text, 0, 0);
    },
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return executePassiveUiOp(toolCallId, params, signal, onUpdate, ctx);
    }
  });
  if (typeof pi.registerCommand === "function") {
    pi.registerCommand("statusline", {
      description: "Configure statusline preset or toggle elements: /statusline [minimal|standard|full|off]",
      handler: async (args, ctx) => {
        const target = (args || "").trim().toLowerCase();
        if (target === "minimal" || target === "standard" || target === "full" || target === "custom" || target === "off") {
          setStatuslineMode(target);
          saveStatuslineSetting(target, getStatuslineItems(), ctx?.cwd || process.cwd());
          if (ctx?.ui?.notify) {
            ctx.ui.notify(`Statusline mode set and saved to: ${target}`, "info");
          }
          return;
        }
        const presets = [
          { id: "minimal", title: "Minimal (Default)", desc: "\u2026/repo (branch) \xB7 model \xB7 Context X%" },
          { id: "standard", title: "Standard", desc: "\u2026/repo (branch) \xB7 model \xB7 Context X% \xB7 \u2191\u2193 tokens" },
          { id: "full", title: "Full (Detailed)", desc: "\u2026/repo (branch) \xB7 model \xB7 Context X% \xB7 \u2191\u2193 tokens \xB7 $cost" },
          { id: "custom", title: "Custom (Configured below)", desc: "Toggle individual elements below" },
          { id: "off", title: "Off", desc: "Disable statusline completely" }
        ];
        const itemDefs = [
          { key: "cwd", label: "current-dir & git-branch", desc: "Working directory path and current git branch" },
          { key: "model", label: "model-with-reasoning", desc: "Current model name, provider, and thinking level" },
          { key: "context", label: "context-used", desc: "Percentage of context window used and token total" },
          { key: "tokens", label: "traffic-tokens", desc: "Total input, output, and cache read/write tokens" },
          { key: "cost", label: "estimated-cost", desc: "Total estimated session cost in USD or subscription indicator" },
          { key: "extension_status", label: "extension-statuses", desc: "Right-aligned active extension states" }
        ];
        const rows = [
          ...presets.map((p) => ({ type: "preset", preset: p })),
          ...itemDefs.map((i) => ({ type: "item", item: i }))
        ];
        let currentMode = getStatuslineMode();
        let currentItems = { ...getStatuslineItems() };
        let selectedIndex = presets.findIndex((p) => p.id === currentMode);
        if (selectedIndex === -1)
          selectedIndex = 0;
        if (typeof ctx?.ui?.custom === "function") {
          try {
            await ctx.ui.custom((_tui, theme, _keybindings, done) => {
              const comp = new Text3("", 0, 0);
              const updateText = () => {
                const lines = [
                  "\u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Configure Status Line \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E",
                  "\u2502 Select preset or press Space to toggle items. Enter to save.          \u2502",
                  "\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524"
                ];
                for (let i = 0;i < rows.length; i++) {
                  const row = rows[i];
                  const isCursor = i === selectedIndex;
                  const cursorGlyph = isCursor ? "\u276F" : " ";
                  if (i === presets.length) {
                    lines.push("\u251C\u2500 Toggle Components (Space to toggle) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
                  }
                  if (row.type === "preset") {
                    const isActive = row.preset.id === currentMode;
                    const check = isActive ? "[\u25CF]" : "[\u25CB]";
                    const titleText = `${cursorGlyph} ${check} ${row.preset.title}`;
                    const paddedTitle = titleText.padEnd(71);
                    const paddedDesc = `      ${row.preset.desc}`.padEnd(71);
                    if (isCursor) {
                      lines.push(`\u2502 ${theme.fg("accent", paddedTitle)} \u2502`);
                      lines.push(`\u2502 ${theme.fg("muted", paddedDesc)} \u2502`);
                    } else {
                      lines.push(`\u2502 ${theme.fg(isActive ? "success" : "white", paddedTitle)} \u2502`);
                      lines.push(`\u2502 ${theme.fg("dim", paddedDesc)} \u2502`);
                    }
                  } else {
                    const isChecked = Boolean(currentItems[row.item.key]);
                    const check = isChecked ? "[x]" : "[ ]";
                    const titleText = `${cursorGlyph} ${check} ${row.item.label}`;
                    const paddedTitle = titleText.padEnd(71);
                    const paddedDesc = `      ${row.item.desc}`.padEnd(71);
                    if (isCursor) {
                      lines.push(`\u2502 ${theme.fg("accent", paddedTitle)} \u2502`);
                      lines.push(`\u2502 ${theme.fg("muted", paddedDesc)} \u2502`);
                    } else {
                      lines.push(`\u2502 ${theme.fg(isChecked ? "white" : "dim", paddedTitle)} \u2502`);
                      lines.push(`\u2502 ${theme.fg("dim", paddedDesc)} \u2502`);
                    }
                  }
                }
                lines.push("\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
                lines.push("\u2502 Space: Toggle element \xB7 Enter: Save & Close \xB7 Esc/q: Cancel           \u2502");
                lines.push("\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F");
                comp.text = lines.join(`
`);
              };
              updateText();
              comp.handleInput = (key) => {
                if (key === "up" || key === "k") {
                  selectedIndex = (selectedIndex - 1 + rows.length) % rows.length;
                  updateText();
                  return true;
                }
                if (key === "down" || key === "j") {
                  selectedIndex = (selectedIndex + 1) % rows.length;
                  updateText();
                  return true;
                }
                if (key === "space") {
                  const row = rows[selectedIndex];
                  if (row.type === "item") {
                    currentItems[row.item.key] = !currentItems[row.item.key];
                    currentMode = "custom";
                    setStatuslineItems(currentItems);
                    setStatuslineMode("custom");
                    updateText();
                    return true;
                  }
                  if (row.type === "preset") {
                    currentMode = row.preset.id;
                    setStatuslineMode(currentMode);
                    updateText();
                    return true;
                  }
                }
                if (key === "return" || key === "enter") {
                  const row = rows[selectedIndex];
                  if (row.type === "preset") {
                    currentMode = row.preset.id;
                  } else {
                    currentMode = "custom";
                  }
                  setStatuslineMode(currentMode);
                  setStatuslineItems(currentItems);
                  saveStatuslineSetting(currentMode, currentItems, ctx?.cwd || process.cwd());
                  if (ctx?.ui?.notify) {
                    ctx.ui.notify(`Statusline updated: ${currentMode}`, "info");
                  }
                  done(true);
                  return true;
                }
                if (key === "escape" || key === "q") {
                  done(false);
                  return true;
                }
                return false;
              };
              return comp;
            }, { overlay: true });
            return;
          } catch {}
        }
        const current = getStatuslineMode();
        const items = getStatuslineItems();
        const msg = [
          `Current statusline mode: ${current}`,
          `Components:`,
          `  cwd:              ${items.cwd ? "enabled" : "disabled"}`,
          `  model:            ${items.model ? "enabled" : "disabled"}`,
          `  context:          ${items.context ? "enabled" : "disabled"}`,
          `  tokens:           ${items.tokens ? "enabled" : "disabled"}`,
          `  cost:             ${items.cost ? "enabled" : "disabled"}`,
          `  extension_status: ${items.extension_status ? "enabled" : "disabled"}`,
          ``,
          `Presets: /statusline [minimal|standard|full|custom|off]`
        ].join(`
`);
        if (ctx?.ui?.notify) {
          ctx.ui.notify(msg, "info");
        }
      }
    });
    pi.registerCommand("quickinfo", {
      description: "Display quickinfo modal with session metrics (tokens, context, cost, duration)",
      handler: async (_args, ctx) => {
        const state = ctx?.session?.state;
        let totalInput = 0;
        let totalOutput = 0;
        let totalCacheRead = 0;
        let totalCacheWrite = 0;
        let totalCost = 0;
        const entries = ctx?.session?.sessionManager?.getEntries?.() || [];
        for (const entry of entries) {
          if (entry.type === "message" && entry.message.role === "assistant") {
            totalInput += entry.message.usage?.input || 0;
            totalOutput += entry.message.usage?.output || 0;
            totalCacheRead += entry.message.usage?.cacheRead || 0;
            totalCacheWrite += entry.message.usage?.cacheWrite || 0;
            totalCost += entry.message.usage?.cost?.total || 0;
          }
        }
        const contextUsage = ctx?.session?.getContextUsage?.();
        const contextWindow = contextUsage?.contextWindow ?? state?.model?.contextWindow ?? 0;
        const pct = contextUsage?.percent !== null && contextUsage?.percent !== undefined ? `${contextUsage.percent.toFixed(1)}%` : "?";
        const fmtK = (n) => {
          if (n >= 1e6)
            return `${(n / 1e6).toFixed(2)}M`;
          if (n >= 1000)
            return `${(n / 1000).toFixed(1)}k`;
          return String(n);
        };
        const modalLines = [
          `\u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Session Quick Info \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E`,
          `\u2502 Model:    ${(state?.model?.id ?? "default").padEnd(44)} \u2502`,
          `\u2502 Provider: ${(state?.model?.provider ?? "unknown").padEnd(44)} \u2502`,
          `\u2502 Thinking: ${(state?.thinkingLevel ?? "off").padEnd(44)} \u2502`,
          `\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524`,
          `\u2502 Context:  ${`${pct} / ${fmtK(contextWindow)} tokens`.padEnd(44)} \u2502`,
          `\u2502 Input:    ${`${fmtK(totalInput)} tokens`.padEnd(44)} \u2502`,
          `\u2502 Output:   ${`${fmtK(totalOutput)} tokens`.padEnd(44)} \u2502`,
          `\u2502 Cache R:  ${`${fmtK(totalCacheRead)} tokens`.padEnd(44)} \u2502`,
          `\u2502 Cache W:  ${`${fmtK(totalCacheWrite)} tokens`.padEnd(44)} \u2502`,
          `\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524`,
          `\u2502 Total Cost: ${`$${totalCost.toFixed(4)}`.padEnd(42)} \u2502`,
          `\u2502 Statusline: ${getStatuslineMode().padEnd(42)} \u2502`,
          `\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F`,
          `  (Press Esc or Enter to dismiss)`
        ];
        if (typeof ctx?.ui?.custom === "function") {
          try {
            await ctx.ui.custom((_tui, theme, _keybindings, done) => {
              const formatted = modalLines.map((line, idx) => {
                if (idx === 0 || idx === 4 || idx === 10 || idx === 13) {
                  return theme.fg("accent", line);
                }
                if (idx === 14) {
                  return theme.fg("dim", line);
                }
                return theme.fg("white", line);
              }).join(`
`);
              const comp = new Text3(formatted, 0, 0);
              comp.handleInput = (key) => {
                if (key === "escape" || key === "return" || key === "enter" || key === "q") {
                  done(true);
                  return true;
                }
                return false;
              };
              return comp;
            }, { overlay: true });
            return;
          } catch {}
        }
        if (ctx?.ui?.notify) {
          ctx.ui.notify(modalLines.join(`
`), "info");
        }
      }
    });
  }
}

// .pi/extensions/passive-ui/index.ts
function passiveUiExtension(pi) {
  registerPassiveUi(pi);
}
export {
  passiveUiExtension as default
};
