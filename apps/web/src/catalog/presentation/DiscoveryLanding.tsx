import type { ReactNode } from "react";
const samples = [
  "A little desk upgrade",
  "A gift under $50",
  "Help me find a new fragrance",
];
export function DiscoveryLanding({
  composer,
  onSuggest,
  disabled,
}: {
  composer: ReactNode;
  onSuggest: (text: string) => void;
  disabled: boolean;
}) {
  return (
    <main className="landing">
      <div className="hero-eyebrow">
        <span /> YOUR PERSONAL SHOPPING SIDEKICK
      </div>
      <h1>
        Less searching.
        <br />
        More <em>finding.</em>
      </h1>
      <p className="hero-description">
        Big ideas, little treats, and the things you didn’t know
        <br className="desktop-break" /> you needed. Let’s find something that
        feels like you.
      </p>
      <div className="landing-composer">{composer}</div>
      <div className="suggestions">
        <span>A little inspiration</span>
        {samples.map((s) => (
          <button key={s} disabled={disabled} onClick={() => onSuggest(s)}>
            {s}
            <span>↗</span>
          </button>
        ))}
      </div>
      <div className="floating-card float-one">
        <span className="card-sticker">MAKE ROOM FOR GOOD THINGS</span>
        <div className="decor-object lamp">
          <i />
          <b />
        </div>
        <span className="float-caption">
          Your space, upgraded <span>↗</span>
        </span>
      </div>
      <div className="floating-card float-two">
        <span className="small-label">THE EVERYDAY EDIT</span>
        <div className="decor-object bottle">
          <i />
          <b />
          <span>
            ESSENCE
            <br />
            <small>EAU DE PARFUM</small>
          </span>
        </div>
        <span className="float-caption">
          A new signature <span>↗</span>
        </span>
      </div>
      <div className="orbit orbit-one">✳</div>
      <div className="orbit orbit-two">✦</div>
      <div className="landing-footer">
        <span>CURATED BY CONVERSATION</span>
        <span>Real products. A little inspiration.</span>
        <span>POWERED BY CURIOSITY</span>
      </div>
    </main>
  );
}
