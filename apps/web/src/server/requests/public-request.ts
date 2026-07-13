type RequestRow = {
  organizationId?: unknown;
  branchId?: unknown;
  [key: string]: unknown;
};

/** Keep tenant routing keys internal to the server-side request model. */
export function toPublicServiceRequest<Row extends RequestRow>(request: Row) {
  const { organizationId: _organizationId, branchId: _branchId, ...publicRequest } = request;
  return publicRequest;
}
