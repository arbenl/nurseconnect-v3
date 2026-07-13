const LIBPQ_URI_PARAMETERS = new Map([
  ["host", "PGHOST"],
  ["hostaddr", "PGHOSTADDR"],
  ["connect_timeout", "PGCONNECT_TIMEOUT"],
  ["target_session_attrs", "PGTARGETSESSIONATTRS"],
  ["options", "PGOPTIONS"],
  ["channel_binding", "PGCHANNELBINDING"],
  ["gssencmode", "PGGSSENCMODE"],
  ["gsslib", "PGGSSLIB"],
  ["krbsrvname", "PGKRBSRVNAME"],
  ["require_auth", "PGREQUIREAUTH"],
  ["requirepeer", "PGREQUIREPEER"],
  ["requiressl", "PGREQUIRESSL"],
  ["sslcert", "PGSSLCERT"],
  ["sslcrl", "PGSSLCRL"],
  ["sslcrldir", "PGSSLCRLDIR"],
  ["sslkey", "PGSSLKEY"],
  ["ssl_max_protocol_version", "PGSSLMAXPROTOCOLVERSION"],
  ["ssl_min_protocol_version", "PGSSLMINPROTOCOLVERSION"],
  ["sslmode", "PGSSLMODE"],
  ["sslnegotiation", "PGSSLNEGOTIATION"],
  ["sslpassword", "PGSSLPASSWORD"],
  ["sslrootcert", "PGSSLROOTCERT"],
  ["sslsni", "PGSSLSNI"],
]);

export function libpqTransportEnvironment(url) {
  const environment = {};
  for (const [parameter, variable] of LIBPQ_URI_PARAMETERS) {
    const value = url.searchParams.get(parameter);
    if (value !== null) environment[variable] = value;
  }
  return environment;
}
