export function Field({ label, value }: { readonly label: string; readonly value: string | number }) {
  return (
    <div className="field-row">
      <span className="field-label">{label}</span>
      <span className="field-value">{value}</span>
    </div>
  );
}

export function Badge({ kind, children }: { readonly kind: "authoritative" | "advisory" | "allow" | "deny" | "warn"; readonly children: string }) {
  return <span className={`badge badge-${kind}`}>{children}</span>;
}
