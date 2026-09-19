import { createBrowserRouter } from 'react-router';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Workspace from './pages/Workspace';
import NewTest from './pages/NewTest';
import Test from './pages/Test';
import AgentDetail from './pages/AgentDetail';
import Personas from './pages/Personas';
import { LegacyAgent, LegacyRun } from './pages/Legacy';

// The product has three places: your tests, a new test, and personas. A test is one page (Live and
// Results tabs); an agent is a page under its test.
export const router = createBrowserRouter([
  {
    Component: Layout,
    children: [
      { index: true, Component: Landing },
      { path: 'login', Component: Login },
      { path: 'workspace', Component: Workspace },
      { path: 'new', Component: NewTest },
      { path: 'tests/:runId', Component: Test },
      { path: 'tests/:runId/agents/:id', Component: AgentDetail },
      { path: 'personas', Component: Personas },
      // Links from before the restructure keep working.
      { path: 'tools', Component: LegacyRun },
      { path: 'insights', Component: LegacyRun },
      { path: 'populations', Component: LegacyRun },
      { path: 'populations/new', Component: Personas },
      { path: 'populations/custom', Component: Personas },
      { path: 'populations/data', Component: Personas },
      { path: 'populations/:id', Component: LegacyAgent },
    ],
  },
]);
