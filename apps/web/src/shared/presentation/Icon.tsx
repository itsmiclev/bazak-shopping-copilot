export function Icon({
  name,
}: {
  name: "arrow" | "menu" | "plus" | "close" | "spark";
}) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "arrow" ? (
        <path d="M12 19V5m-6 6 6-6 6 6" />
      ) : name === "menu" ? (
        <>
          <path d="M4 6h16M4 12h10M4 18h16" />
        </>
      ) : name === "plus" ? (
        <path d="M12 5v14M5 12h14" />
      ) : name === "close" ? (
        <path d="m6 6 12 12M6 18 18 6" />
      ) : (
        <path d="m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7Z" />
      )}
    </svg>
  );
}
