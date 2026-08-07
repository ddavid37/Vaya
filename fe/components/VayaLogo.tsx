// Inline Vaya wordmark so the logo never depends on static-asset URL wiring.

export function VayaLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 276 70"
      width={90}
      height={23}
      fill="none"
      className={className}
      aria-label="Vaya"
      role="img"
    >
      <path
        d="M14,8 L38,60 L62,8"
        stroke="#C94B18"
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M80,60 L104,8 L128,60"
        stroke="#1A1510"
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M146,8 L170,34 M194,8 L170,34 M170,34 L170,60"
        stroke="#1A1510"
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M212,60 L236,8 L260,60"
        stroke="#1A1510"
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
