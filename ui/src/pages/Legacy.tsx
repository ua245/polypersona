// Redirects for URLs from before tests became a single page.
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router';
import { agentPath, testPath } from '../lib/derive';

export function LegacyRun() {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const run = params.get('run');
  if (!run) return <Navigate to={pathname === '/tools' ? '/new' : pathname === '/populations' ? '/personas' : '/workspace'} replace />;
  return <Navigate to={testPath(run, pathname === '/insights' ? 'results' : 'live')} replace />;
}

export function LegacyAgent() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const { hash } = useLocation();
  const run = params.get('run');
  return <Navigate to={run ? agentPath(run, id) + hash : '/workspace'} replace />;
}
