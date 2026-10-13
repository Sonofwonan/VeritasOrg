export function BrandedLoader() {
  return (
    <main className="vw-loader" data-testid="branded-loader">
      <div className="vw-loader-content">
        <img
          className="vw-loader-logo"
          src="/veritas-logo.png"
          alt=""
          aria-hidden="true"
        />
        <div className="vw-loader-line" aria-hidden="true" />
        <p className="vw-loader-status" role="status" aria-live="polite">
          Loading
        </p>
      </div>
    </main>
  );
}
