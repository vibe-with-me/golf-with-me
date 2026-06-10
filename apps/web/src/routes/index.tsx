import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  return (
    <main>
      <h1>withme-starter</h1>
      <p>NFC tap-to-connect reference implementation. Routes arrive in deliverable step 6.</p>
    </main>
  );
}
