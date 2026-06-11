import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  return (
    <main className="page">
      <div className="card">
        <h1 className="wordmark">withme</h1>
        <p className="bio">Tap a tag. Meet a person. Stay connected.</p>
        <p className="hint">
          This is the starter app — tags resolve at <code>/t/&lt;uid&gt;</code>.
        </p>
        {/* The tag link matches the seed script's claimed demo tag. */}
        {import.meta.env.VITE_DEMO_CREDENTIALS ? (
          <p className="hint">
            Try it: tap <a href="/t/04BBBBBBBBBBBB">a live demo tag</a>, or sign in as{' '}
            <code>{import.meta.env.VITE_DEMO_CREDENTIALS}</code>.
          </p>
        ) : null}
        <nav className="btn-row">
          <Link className="btn" to="/me">
            My profile
          </Link>
          <Link className="btn" to="/connections">
            Connections
          </Link>
        </nav>
      </div>
    </main>
  );
}
