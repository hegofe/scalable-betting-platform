import { DataIntegrityError } from "./errors";

export type Item = Record<string, unknown>;

export class ItemReader {
  constructor(
    private readonly entity: string,
    private readonly item: Item,
  ) {}

  string(field: string): string {
    const value = this.item[field];
    if (typeof value !== "string" || value === "") {
      throw this.invalid(field, "a non-empty string");
    }
    return value;
  }

  number(field: string): number {
    const value = this.item[field];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw this.invalid(field, "a finite number");
    }
    return value;
  }

  date(field: string): Date {
    const value = new Date(this.string(field));
    if (Number.isNaN(value.getTime())) {
      throw this.invalid(field, "an ISO 8601 date");
    }
    return value;
  }

  oneOf<T extends string>(field: string, allowed: readonly T[]): T {
    const value = this.string(field);
    const match = allowed.find((candidate) => candidate === value);
    if (match === undefined) {
      throw this.invalid(field, `one of ${allowed.join(", ")}`);
    }
    return match;
  }

  private invalid(field: string, expected: string): DataIntegrityError {
    return new DataIntegrityError(`${this.entity} item field ${field} must be ${expected}`);
  }
}
