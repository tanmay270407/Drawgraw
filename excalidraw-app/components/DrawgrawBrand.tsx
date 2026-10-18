import "./DrawgrawBrand.scss";

export const DrawgrawMark = () => (
  <svg
    aria-hidden="true"
    className="drawgraw-mark"
    fill="none"
    viewBox="0 0 32 32"
  >
    <path d="M7 5h8a11 11 0 0 1 0 22H7V5Z" />
    <path d="M13 11h2a5 5 0 0 1 0 10h-2V11Z" />
  </svg>
);

export const DrawgrawWordmark = () => (
  <span className="drawgraw-wordmark">
    <DrawgrawMark />
    <span>Drawgraw</span>
  </span>
);
