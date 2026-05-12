/**
 * Root shell — providers mount once here; routing lives in `routes/AppRoutes.tsx`.
 */
import { AppStateProvider } from './contexts/AppStateProvider';
import { AppRoutes } from './routes/AppRoutes';

export default function App() {
  return (
    <AppStateProvider>
      <AppRoutes />
    </AppStateProvider>
  );
}
