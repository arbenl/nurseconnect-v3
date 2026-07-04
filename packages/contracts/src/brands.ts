declare const brand: unique symbol;

export type Brand<T, Tag extends string> = T & {
  readonly [brand]: Tag;
};

export type OrganizationId = Brand<string, "OrganizationId">;

export function brandValue<T, Tag extends string>(value: T): Brand<T, Tag> {
  return value as Brand<T, Tag>;
}

export function organizationId(value: string): OrganizationId {
  return brandValue<string, "OrganizationId">(value);
}
