import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import SessionFlow from './pages/session/SessionFlow';
import ReportPage from './pages/session/ReportPage';
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import SessionDetailPage from './pages/admin/SessionDetailPage';
import QuestionnairesPage from './pages/admin/QuestionnairesPage';
import QuestionnaireEditor from './pages/admin/QuestionnaireEditor';
import SecurityPage from './pages/admin/SecurityPage';
import MusicPage from './pages/admin/MusicPage';
import StatsPage from './pages/admin/StatsPage';
import StatusPage from './pages/StatusPage';
import ErrorPage from './components/ErrorPage';
import { PlayerProvider } from './music/PlayerContext';
import MiniPlayer from './music/MiniPlayer';

export default function App() {
  return (
    <PlayerProvider>
      <MiniPlayer />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join/:pin" element={<Home />} />
        <Route path="/session" element={<SessionFlow />} />
        <Route path="/session/report" element={<ReportPage />} />
        <Route path="/status" element={<StatusPage />} />

        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="sessions/:id" element={<SessionDetailPage />} />
          <Route path="questionnaires" element={<QuestionnairesPage />} />
          <Route path="questionnaires/versions/:versionId" element={<QuestionnaireEditor />} />
          <Route path="security" element={<SecurityPage />} />
          <Route path="music" element={<MusicPage />} />
          <Route path="stats" element={<StatsPage />} />
        </Route>

        <Route path="/403" element={<ErrorPage variant="403" />} />
        <Route path="/500" element={<ErrorPage variant="500" />} />
        <Route path="*" element={<ErrorPage variant="404" />} />
      </Routes>
    </PlayerProvider>
  );
}
