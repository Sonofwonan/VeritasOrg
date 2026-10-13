export function SessionLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="vw-loader vw-loader-failed" data-testid="session-load-error">
      <div className="vw-loader-content">
        <img className="vw-loader-logo" src="/veritas-logo.png" alt="" aria-hidden="true" />
        <p className="vw-loader-status" role="alert">We couldn't connect. Please try again.</p>
        <button type="button" className="vw-loader-retry" onClick={onRetry}>Try again</button>
      </div>
    </main>
  );
}
