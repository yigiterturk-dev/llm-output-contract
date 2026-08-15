import type { ErrorObject, JSONSchemaType } from "ajv";

export type CandidateSource = "raw" | "fence" | "balanced";

export interface ContractOptions {
  maxBytes?: number;
  maxDepth?: number;
  maxCandidates?: number;
}

export interface ContractMeta {
  source: CandidateSource;
  inputBytes: number;
  candidateIndex: number;
}

export interface ContractSuccess<T> {
  ok: true;
  value: T;
  meta: ContractMeta;
}

export type ContractErrorCode =
  | "INPUT_TOO_LARGE"
  | "NO_JSON_CANDIDATE"
  | "INVALID_JSON"
  | "SCHEMA_VALIDATION_FAILED"
  | "UNSAFE_KEY"
  | "MAX_DEPTH_EXCEEDED";

export interface SafeValidationError {
  instancePath: string;
  schemaPath: string;
  keyword: string;
  message: string;
}

export interface ContractFailure {
  ok: false;
  error: {
    code: ContractErrorCode;
    message: string;
    details: SafeValidationError[];
  };
}

export type ContractResult<T> = ContractSuccess<T> | ContractFailure;

export interface OutputContract<T> {
  parse(text: string): ContractResult<T>;
  schema: JSONSchemaType<T> | object;
}

export type AjvErrors = ErrorObject[] | null | undefined;
