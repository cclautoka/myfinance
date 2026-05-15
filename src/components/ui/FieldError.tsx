export function FieldError({
  id,
  message,
}: {
  id: string;
  message: string | null | undefined;
}) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs font-semibold text-rose-700 dark:text-rose-300" role="alert">
      {message}
    </p>
  );
}
