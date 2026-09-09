/**
 * Renders a JSON-LD structured-data block. Server component — the payload is
 * serialized once at render time. `data` is trusted (built from our own catalog
 * and store settings), but `<` is still escaped so a stray value can never break
 * out of the <script> element.
 */
export function JsonLd({
  data,
}: {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
}) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}
