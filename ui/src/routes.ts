import { createBrowserRouter } from 'react-router';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Workspace from './pages/Workspace';
import PopulationNew from './pages/PopulationNew';
import Populations from './pages/Populations';
import AgentDetail from './pages/AgentDetail';
import Tools from './pages/Tools';
import Insights from './pages/Insights';
import CustomerData from './pages/CustomerData';
import PopulationsCustom from './pages/PopulationsCustom';
import Login from './pages/Login';

export const router = createBrowserRouter([
  {
    Component: Layout,
    children: [
      { index: true, Component: Landing },
      { path: 'login', Component: Login },
      { path: 'workspace', Component: Workspace },
      { path: 'populations', Component: Populations },
      { path: 'populations/new', Component: PopulationNew },
      { path: 'populations/data', Component: CustomerData },
      { path: 'populations/custom', Component: PopulationsCustom },
      { path: 'populations/:id', Component: AgentDetail },
      { path: 'tools', Component: Tools },
      { path: 'insights', Component: Insights },
    ],
  },
]);
