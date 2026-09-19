import { createBrowserRouter, Navigate } from 'react-router';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import SignIn from './pages/SignIn';
import Workspace from './pages/Workspace';
import NewTest from './pages/NewTest';
import TestMonitor from './pages/TestMonitor';
import Personas from './pages/Personas';
import AgentDetail from './pages/AgentDetail';
import Insights from './pages/Insights';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: Landing },
      { path: 'signin', Component: SignIn },
      { path: 'tests', Component: Workspace },
      { path: 'tests/new', Component: NewTest },
      { path: 'tests/:id', Component: TestMonitor },
      { path: 'personas', Component: Personas },
      { path: 'personas/:id', Component: AgentDetail },
      { path: 'insights', Component: Insights },
    ],
  },
  { path: '*', element: <Navigate to="/tests" replace /> },
], { basename: import.meta.env.BASE_URL });
