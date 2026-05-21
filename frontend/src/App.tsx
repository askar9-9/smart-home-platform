import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { AreasPage } from './pages/AreasPage';
import { AreaDetailPage } from './pages/AreaDetailPage';
import { DevicesPage } from './pages/DevicesPage';
import { DeviceDetailPage } from './pages/DeviceDetailPage';
import { EntitiesPage } from './pages/EntitiesPage';
import { EntityDetailPage } from './pages/EntityDetailPage';
import { AutomationsPage } from './pages/AutomationsPage';
import { AutomationCreatePage } from './pages/AutomationCreatePage';
import { AutomationEditPage } from './pages/AutomationEditPage';
import { EnergyPage } from './pages/EnergyPage';
import { MlAnomaliesPage } from './pages/MlAnomaliesPage';
import { EventsPage } from './pages/EventsPage';
import { IntegrationsPage } from './pages/IntegrationsPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/areas" element={<AreasPage />} />
          <Route path="/areas/:id" element={<AreaDetailPage />} />
          <Route path="/devices" element={<DevicesPage />} />
          <Route path="/devices/:id" element={<DeviceDetailPage />} />
          <Route path="/entities" element={<EntitiesPage />} />
          <Route path="/entities/:entityId" element={<EntityDetailPage />} />
          <Route path="/automations" element={<AutomationsPage />} />
          <Route path="/automations/new" element={<AutomationCreatePage />} />
          <Route path="/automations/:id/edit" element={<AutomationEditPage />} />
          <Route path="/energy" element={<EnergyPage />} />
          <Route path="/ml/anomalies" element={<MlAnomaliesPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
