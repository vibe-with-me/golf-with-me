import { createRouter } from '@tanstack/react-router';
import { ErrorCard, NotFoundCard, PendingCard } from './components/CalmStates.tsx';
import { scopeRouterToAccount } from './lib/account-scope.ts';
import { routeTree } from './routeTree.gen';

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    // The resolver is the product and must be unbreakable: every failure
    // mode resolves to a calm card, and slow resolves show the card shell
    // instead of a blank page (taps happen on venue Wi-Fi).
    defaultNotFoundComponent: NotFoundCard,
    defaultErrorComponent: ErrorCard,
    defaultPendingComponent: PendingCard,
    defaultPendingMs: 150,
    defaultPendingMinMs: 300,
  });
  // Loader data belongs to the signed-in account (see lib/account-scope.ts).
  scopeRouterToAccount(router);
  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
