import { useUserProfile } from '../../store/UserProfileContext';
import { useAppStore } from '../../store/AppContext';
import AnalystWorkspace from './AnalystWorkspace';
import { analystDashboardModel, type RequestIntent } from './dashboardModel';

interface Props { usuario: string; onNav: (view: string) => void; onOpenRequests?: (intent: RequestIntent) => void; }
export default function AnalistaDashboard({ onNav, onOpenRequests }: Props) {
  const { profile } = useUserProfile();
  const { state } = useAppStore();
  return <AnalystWorkspace data={analystDashboardModel(state.requerimientos, state.cotizaciones, profile)}
    quotesUnavailable={Boolean(state.cotizacionesError)} onNav={onNav} onOpenRequests={onOpenRequests} />;
}
