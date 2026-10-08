export function FieldError({ fields, name }: { fields?: Record<string, string>; name: string }) {
  const message = fields?.[name];
  return message ? <span className="field-error">{message}</span> : null;
}
